// IT Help Desk - Frontend Application Logic

// Initialize Theme Immediately to prevent any color flash on page load
(function() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
  }
})();

// Application Global State
const state = {
  currentUser: null,
  users: [],
  categories: [],
  tickets: [],
  selectedTicket: null,
  attachedFiles: [],
  commentAttachedFiles: [],
  currentSection: 'sectionDashboard',
  currentTab: 'tabMyWork',
  editingTicketId: null,
  deletedAttachmentIds: [],
  closedTicketsLimit: 50,
  notificationsHistory: [],
  activeNotifFilter: 'all'
};

// HELPER: Parse datetime string safely supporting UTC and local timezones
function parseDateTime(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    if (dateStr.includes('Z') || dateStr.includes('+') || (dateStr.includes('T') && dateStr.match(/-\d{2}:\d{2}$/))) {
      return new Date(dateStr);
    }
    let iso = dateStr.replace(' ', 'T');
    if (!iso.includes('Z')) iso += 'Z';
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(dateStr);
}

// HELPER: Show elegant in-app Toast notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  else if (type === 'error') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  else icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 10000);
}

// HELPER: Audio bell synthesizer using Web Audio API (HTTP friendly)
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.06, startTime); // мягкий ненавязчивый уровень громкости
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    // Элегантный двухтональный корпоративный перезвон (соль-до)
    playTone(783.99, now, 0.4);       // G5
    playTone(1046.50, now + 0.12, 0.6); // C6
  } catch (err) {
    console.warn('Audio chime failed:', err);
  }
}

// HELPER: Native Browser Desktop Notification Trigger with audio fallback and persistent history
function triggerDesktopNotification(title, body, type = 'status_change', ticketId = null) {
  // Инициализировать звуковой колокольчик (работает на HTTP)
  playNotificationSound();

  // Отобразить красивый внутренний Toast как надежный дублирующий канал
  let toastType = 'info';
  if (type === 'new_ticket') toastType = 'info';
  else if (type === 'comment') toastType = 'success';
  else if (type === 'status_change') toastType = 'warning';

  showToast(`${title}\n${body}`, toastType);

  // Попытаться показать системное уведомление ОС (если разрешено и HTTPS)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: '/favicon.ico'
      });
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }

  // Записать в историю Центра уведомлений
  addNotificationToHistory(title, body, type, ticketId);
}

// HELPER: Generate UUID for Idempotency Checks
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// HELPER: Convert absolute API and upload paths to support subdirectory hosting dynamically
function getAbsoluteUrl(url) {
  if (url && (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/photos/'))) {
    const pathname = window.location.pathname;
    let basePath = pathname;
    if (basePath.endsWith('index.html')) {
      basePath = basePath.slice(0, -10); // remove "index.html"
    }
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1); // remove trailing slash
    }
    if (basePath && basePath !== '/') {
      return basePath + url;
    }
  }
  return url;
}

// HELPER: Check if running in development/simulation mode
function isSimulationMode() {
  if (state.allowSimulation === false) {
    return false;
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('sim')) {
    return urlParams.get('sim') === '1';
  }
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isDevPort = window.location.port && window.location.port !== '80' && window.location.port !== '443';
  return isLocal || isDevPort;
}

// HELPER: Fetch wrapper with Kerberos Authentication header injecting automatically
async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  
  if (isSimulationMode()) {
    // Retrieve simulated active user username from localStorage or default
    const activeUsername = localStorage.getItem('simulated_kerberos_user') || 'ivanova_ea';
    headers['X-Remote-User'] = activeUsername;
  }

  options.headers = headers;
  
  try {
    const response = await fetch(getAbsoluteUrl(url), options);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error(`API Fetch Error [${url}]:`, error);
    showToast(error.message, 'error');
    throw error;
  }
}

// Global background polling for live-updating the tickets list
let ticketsListPollingInterval = null;

function startTicketsListPolling() {
  if (ticketsListPollingInterval) clearInterval(ticketsListPollingInterval);
  ticketsListPollingInterval = setInterval(async () => {
    // Highly efficient: Skip background polling completely if the browser tab is hidden/inactive
    if (document.hidden) return;

    // Only poll if the user is in tickets-related sections
    if (state.currentSection === 'sectionDashboard' || state.currentSection === 'sectionMyTickets') {
      await refreshTicketsList();
    }
  }, 15000); // Poll every 15 seconds (reduced from 5s) for highly optimized dashboard updates
}

// ================= INITIALIZATION & AUTH ================= //
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadInitialConfiguration();
  
  // Prompt Web Notifications permission
  checkNotificationPermission();

  // Initialize Notification Center history and listeners
  initializeNotificationsCenter();

  // Start background live polling for new tickets and list updates
  startTicketsListPolling();
});

async function loadInitialConfiguration() {
  try {
    // Fetch system configuration from backend (public endpoint)
    const config = await apiFetch('/api/config').catch(() => ({ allowSimulation: false }));
    state.allowSimulation = config.allowSimulation;
  } catch (err) {
    state.allowSimulation = false;
  }

  // Hide/show simulator bar based on simulation eligibility
  const simulatorBar = document.querySelector('.dev-simulator-bar');
  if (simulatorBar) {
    if (isSimulationMode()) {
      simulatorBar.style.display = 'flex';
    } else {
      simulatorBar.style.display = 'none';
    }
  }

  // 1. Load system users for the dev simulation dropdown (only if simulation is active)
  if (isSimulationMode()) {
    try {
      state.users = await apiFetch('/api/users');
      populateUserSelector();
    } catch (err) {
      console.warn('⚠️ Ошибка загрузки списка пользователей для симулятора:', err);
      showToast('Не удалось загрузить список пользователей для симулятора', 'warning');
    }
  }

  // 2. Load categories справочник
  try {
    state.categories = await apiFetch('/api/categories');
    populateCategorySelectors();
  } catch (err) {
    console.warn('⚠️ Ошибка загрузки списка категорий:', err);
    state.categories = [];
    populateCategorySelectors(); // Will populate with empty defaults
  }

  // 3. Load active auth profile
  try {
    await refreshCurrentUser();
  } catch (err) {
    console.error('⚠️ Ошибка авторизации при запуске:', err);
  }
}

// Refresh profile based on active header configuration
async function refreshCurrentUser() {
  try {
    const authData = await apiFetch('/api/auth/me');
    if (!authData || !authData.user) {
      throw new Error('Профиль пользователя пуст. Возможно, вы не авторизованы.');
    }
    state.currentUser = authData.user;
    
    // Load users list for assignee dropdowns if the logged-in user is a specialist
    const isSpecialistOrManager = state.currentUser.role === 'adm' || ['specialist', 'manager', 'admin'].includes(state.currentUser.role);
    if (isSpecialistOrManager && (!state.users || state.users.length === 0)) {
      try {
        state.users = await apiFetch('/api/users');
      } catch (err) {
        console.warn('⚠️ Ошибка загрузки списка пользователей для распределения:', err);
      }
    }
    
    // Set simulated selector state safely
    const userSelector = document.getElementById('userSelector');
    if (userSelector && state.currentUser.username) {
      // Ensure the option exists, if not, add it dynamically
      let hasOption = false;
      for (let i = 0; i < userSelector.options.length; i++) {
        if (userSelector.options[i].value === state.currentUser.username) {
          hasOption = true;
          break;
        }
      }
      if (!hasOption) {
        const opt = document.createElement('option');
        opt.value = state.currentUser.username;
        opt.textContent = `${state.currentUser.full_name} (${getRussianRoleName(state.currentUser.role)})`;
        userSelector.appendChild(opt);
      }
      userSelector.value = state.currentUser.username;
    }
    
    const roleTag = document.getElementById('currentUserRole');
    if (roleTag) {
      roleTag.textContent = getRussianRoleName(state.currentUser.role);
      roleTag.className = `user-role-tag ${state.currentUser.role}`;
    }

    // Sidebar badge
    const nameEl = document.getElementById('userFullName');
    if (nameEl) nameEl.textContent = state.currentUser.full_name;

    const emailEl = document.getElementById('userEmail');
    if (emailEl) emailEl.textContent = state.currentUser.email || 'Email не указан';

    const userAvatarEl = document.getElementById('userAvatarChar');
    if (userAvatarEl) {
      userAvatarEl.innerHTML = renderUserAvatarHtml(state.currentUser.photo, state.currentUser.full_name);
      userAvatarEl.className = '';
    }

    // Apply role-based navigation item access filters
    applyRoleBasedUIAccess();

    // Clear tickets list cache to force a re-render when switching users and prevent false notifications
    state.tickets = [];

    // Load actual tickets
    await refreshTicketsList();
  } catch (err) {
    console.error('Ошибка обновления профиля текущего пользователя:', err);
    showToast('Ошибка загрузки профиля: ' + (err.message || err), 'error');
    handleAuthFailureState(err);
  }
}

// Beautiful glassmorphic fallback UI for unauthorized users
function handleAuthFailureState(err) {
  // Update sidebar profile card
  const fullNameEl = document.getElementById('userFullName');
  if (fullNameEl) fullNameEl.textContent = 'Не авторизован';
  
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = 'Ошибка входа в систему';

  const avatarFallback = document.getElementById('userAvatarChar');
  if (avatarFallback) {
    avatarFallback.textContent = '🔒';
    avatarFallback.className = 'avatar-fallback auth-error';
  }

  const roleTag = document.getElementById('currentUserRole');
  if (roleTag) {
    roleTag.textContent = 'Блокировано';
    roleTag.className = 'user-role-tag blocked';
  }

  // Render elegant glassmorphic alert inside active section to prevent infinite hanging load loop
  const activeSection = document.querySelector('.content-section.active');
  if (activeSection) {
    activeSection.innerHTML = `
      <div class="auth-error-card-container">
        <div class="glass-card auth-error-card">
          <div class="auth-error-icon-wrapper">
            <svg class="auth-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>Ошибка авторизации Kerberos</h2>
          <p class="auth-error-main-desc">
            Система IT Help Desk не смогла подтвердить вашу личность. Веб-сервер не передал заголовок <strong>X-Remote-User</strong>.
          </p>
          
          <div class="auth-error-details">
            <p><strong>Подробности ошибки:</strong> ${err.message || 'Заголовок X-Remote-User отсутствует или пуст.'}</p>
          </div>

          <div class="auth-error-instructions">
            <h3>Как войти в систему?</h3>
            <ol>
              <li>Убедитесь, что вы открыли страницу через официальный адрес корпоративного портала с настроенным прокси <strong>portal.company</strong>.</li>
              <li>Если вы зашли напрямую в обход Nginx/IIS (например, по IP-адресу или порту напрямую), Kerberos-авторизация не сработает.</li>
              <li>Если вы разработчик, включите <strong>режим симуляции</strong>, задав переменную <code>ALLOW_SIMULATION=true</code> в файле <code>.env</code> проекта и перезапустив сервер.</li>
            </ol>
          </div>

          ${state.allowSimulation !== false ? `
            <div class="auth-error-simulation-action">
              <p class="sim-notice">Поскольку в конфигурации сервера симуляция разрешена, вы можете включить её прямо сейчас:</p>
              <button id="btnEnableSimulationFromError" class="btn btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                Включить симуляцию Kerberos
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Add event listener to simulation bypass button
    const btnEnableSim = document.getElementById('btnEnableSimulationFromError');
    if (btnEnableSim) {
      btnEnableSim.addEventListener('click', () => {
        localStorage.setItem('simulated_kerberos_user', 'ivanova_ea');
        const url = new URL(window.location.href);
        url.searchParams.set('sim', '1');
        window.location.href = url.toString();
      });
    }
  }
}

function getRussianRoleName(role) {
  const map = {
    'usr': 'Пользователь (usr)',
    'adm': 'IT-Специалист (adm)',
    'employee': 'Пользователь (usr)',
    'specialist': 'IT-Специалист (adm)',
    'manager': 'IT-Специалист (adm)',
    'admin': 'IT-Специалист (adm)'
  };
  return map[role] || role;
}

// Filter Sidebar Options by User Privilege
function applyRoleBasedUIAccess() {
  const role = state.currentUser.role;
  
  const navDashboard = document.getElementById('navDashboard');
  const navMyTickets = document.getElementById('navMyTickets');
  const navCategories = document.getElementById('navCategories');
  const navReports = document.getElementById('navReports');
  const navGuide = document.getElementById('navGuide');

  const isAdm = role === 'adm' || ['specialist', 'manager', 'admin'].includes(role);
  const formGroupPriority = document.getElementById('formGroupPriority');
  if (formGroupPriority) {
    formGroupPriority.style.display = 'none';
  }
  const prioritySelect = document.getElementById('ticketPriority');
  if (prioritySelect) {
    prioritySelect.value = 'medium';
  }

  // Always show guide and notifications center for everyone
  if (navGuide) navGuide.style.display = 'flex';
  const navNotifications = document.getElementById('navNotifications');
  if (navNotifications) navNotifications.style.display = 'flex';

  // Hide or show sidebar controls
  if (role === 'wtch') {
    // Watcher (wtch) role has access to My Tickets and Reports & Analytics
    if (navDashboard) navDashboard.style.display = 'none';
    if (navCategories) navCategories.style.display = 'none';
    if (navReports) navReports.style.display = 'flex';
    if (navMyTickets) navMyTickets.style.display = 'flex';
    
    // Set employee view as active section by default for watchers
    switchSection('sectionMyTickets');

    // Pre-click watcher guide tab
    const btnGuideWtch = document.getElementById('btnGuideWtch');
    if (btnGuideWtch) btnGuideWtch.click();
  } else if (role === 'usr' || role === 'employee') {
    if (navDashboard) navDashboard.style.display = 'none';
    if (navCategories) navCategories.style.display = 'none';
    if (navReports) navReports.style.display = 'none';
    if (navMyTickets) navMyTickets.style.display = 'flex';
    
    // Set employee view as active section
    switchSection('sectionMyTickets');

    // Pre-click user guide tab
    const btnGuideUsr = document.getElementById('btnGuideUsr');
    if (btnGuideUsr) btnGuideUsr.click();
  } else {
    // adm role (and legacy admin/specialist/manager) has full access
    if (navDashboard) navDashboard.style.display = 'flex';
    if (navMyTickets) navMyTickets.style.display = 'flex';
    if (navCategories) navCategories.style.display = 'flex';
    if (navReports) navReports.style.display = 'flex';

    switchSection('sectionDashboard');

    // Нажать на вкладку "В работу (Новые)" (tabToWork) по умолчанию для специалистов (adm)
    const newWorkTab = document.querySelector('.tab-header[data-tab="tabToWork"]');
    if (newWorkTab) {
      newWorkTab.click();
    }

    // Pre-click admin guide tab
    const btnGuideAdm = document.getElementById('btnGuideAdm');
    if (btnGuideAdm) btnGuideAdm.click();
  }
}

// Populating Kerberos Simulation Controls
function populateUserSelector() {
  const selector = document.getElementById('userSelector');
  selector.innerHTML = '';
  
  state.users.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user.username;
    opt.textContent = `${user.full_name} (${getRussianRoleName(user.role)})`;
    selector.appendChild(opt);
  });
}

function populateCategorySelectors() {
  // 1. Filter panel category dropdown
  const filterCat = document.getElementById('filterCategory');
  filterCat.innerHTML = '<option value="">Все категории</option>';
  
  // 2. New Ticket Form Category dropdown
  const formCat = document.getElementById('ticketCategory');
  formCat.innerHTML = '<option value="">-- Выберите из справочника --</option>';

  // 3. Inline Category editor
  const inlineCat = document.getElementById('selectInlineCategory');
  inlineCat.innerHTML = '';

  // 4. Report export filter
  const exportCat = document.getElementById('exportCategory');
  exportCat.innerHTML = '<option value="">Все категории</option>';

  state.categories.forEach(cat => {
    if (cat.is_active) {
      const opt1 = document.createElement('option');
      opt1.value = cat.id;
      opt1.textContent = cat.name;
      filterCat.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = cat.id;
      opt2.textContent = cat.name;
      formCat.appendChild(opt2);

      const opt3 = document.createElement('option');
      opt3.value = cat.id;
      opt3.textContent = cat.name;
      inlineCat.appendChild(opt3);

      const opt4 = document.createElement('option');
      opt4.value = cat.id;
      opt4.textContent = cat.name;
      exportCat.appendChild(opt4);
    }
  });
}


// ================= EVENT LISTENERS SETUP ================= //
function setupEventListeners() {
  // Sidebar navigation switching
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetSectionId = item.getAttribute('data-target');
      switchSection(targetSectionId);
    });
  });

  // Theme Toggle Button click handler
  const themeToggle = document.getElementById('btnThemeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
      localStorage.setItem('theme', theme);
      showToast(theme === 'light' ? 'Светлая тема активирована ☀️' : 'Темная тема активирована 🌙', 'success');
    });
  }

  // Kerberos User selector change simulation
  document.getElementById('userSelector').addEventListener('change', async (e) => {
    const username = e.target.value;
    localStorage.setItem('simulated_kerberos_user', username);
    showToast(`Имитация авторизации Kerberos: ${username}`, 'info');
    await refreshCurrentUser();
  });

  // Notification Perm button
  document.getElementById('btnEnableNotifications').addEventListener('click', requestNotificationPermission);
  
  // Show Notification blocked guide instructions
  const btnShowNotifGuide = document.getElementById('btnShowNotifGuide');
  if (btnShowNotifGuide) {
    btnShowNotifGuide.addEventListener('click', () => {
      const guideSteps = document.getElementById('notifGuideSteps');
      if (guideSteps) {
        if (guideSteps.style.display === 'none') {
          guideSteps.style.display = 'block';
          btnShowNotifGuide.textContent = 'Скрыть';
        } else {
          guideSteps.style.display = 'none';
          btnShowNotifGuide.textContent = 'Как разрешить?';
        }
      }
    });
  }
  
  // Test desktop notification trigger
  const btnTestNotif = document.getElementById('btnTestNotification');
  if (btnTestNotif) {
    btnTestNotif.addEventListener('click', () => {
      triggerDesktopNotification('IT Help Desk', 'Тестовое уведомление! Все системы работают отлично.');
    });
  }

  // Create Ticket Modal triggers
  document.getElementById('btnNewTicketSection').addEventListener('click', openNewTicketModal);
  const btnNewTicketDashboard = document.getElementById('btnNewTicketDashboard');
  if (btnNewTicketDashboard) {
    btnNewTicketDashboard.addEventListener('click', openNewTicketModal);
  }
  document.getElementById('btnCloseNewTicketModal').addEventListener('click', closeNewTicketModal);
  document.getElementById('btnCancelNewTicket').addEventListener('click', closeNewTicketModal);

  // Feedback Modal triggers
  const btnFeedback = document.getElementById('btnFeedback');
  if (btnFeedback) {
    btnFeedback.addEventListener('click', openFeedbackModal);
  }
  document.getElementById('btnCloseFeedbackModal').addEventListener('click', closeFeedbackModal);
  document.getElementById('btnCancelFeedback').addEventListener('click', closeFeedbackModal);
  document.getElementById('formFeedback').addEventListener('submit', handleFeedbackSubmit);

  // Edit Ticket click trigger
  const btnEditTicketUser = document.getElementById('btnEditTicketUser');
  if (btnEditTicketUser) {
    btnEditTicketUser.addEventListener('click', () => {
      const ticket = state.selectedTicket.ticket;
      state.editingTicketId = ticket.id;
      
      document.getElementById('ticketDescription').value = ticket.description;
      document.getElementById('ticketCategory').value = ticket.category_id || '';
      document.getElementById('ticketPriority').value = ticket.priority || 'medium';
      
      const modalNewTicket = document.getElementById('modalNewTicket');
      const modalTitle = modalNewTicket.querySelector('.modal-header h2');
      if (modalTitle) {
        modalTitle.textContent = `Редактирование заявки ${ticket.ticket_number}`;
      }
      const btnSubmit = document.getElementById('btnSubmitNewTicket');
      if (btnSubmit) {
        btnSubmit.textContent = 'Сохранить изменения';
      }
      
      // Allow uploading new files during editing
      state.attachedFiles = [];
      state.deletedAttachmentIds = [];
      renderSelectedFiles();
      renderExistingAttachments();
      
      const fileGroup = document.getElementById('ticketFileGroup');
      if (fileGroup) {
        fileGroup.style.display = 'block';
      }
      
      modalNewTicket.classList.add('active');
    });
  }
  
  // Drag & drop file listeners
  const dragZone = document.getElementById('fileDragZone');
  dragZone.addEventListener('dragover', (e) => { e.preventDefault(); dragZone.classList.add('dragover'); });
  dragZone.addEventListener('dragleave', () => { dragZone.classList.remove('dragover'); });
  dragZone.addEventListener('drop', handleFileDrop);
  dragZone.addEventListener('click', () => document.getElementById('ticketFileInput').click());
  document.getElementById('ticketFileInput').addEventListener('change', handleFileSelect);

  // Form Ticket Submit
  document.getElementById('formNewTicket').addEventListener('submit', handleTicketFormSubmit);

  // Specialist Tab Switching
  const tabs = document.querySelectorAll('.tab-header');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetPaneId = tab.getAttribute('data-tab');
      
      const panes = document.querySelectorAll('.tab-pane');
      panes.forEach(p => p.classList.remove('active'));
      document.getElementById(targetPaneId).classList.add('active');
      
      state.currentTab = targetPaneId;
    });
  });

  // Filter and search live listeners
  document.getElementById('dashboardSearch').addEventListener('input', debounce(() => {
    state.closedTicketsLimit = 50;
    refreshTicketsList();
  }, 300));
  
  document.getElementById('filterCategory').addEventListener('change', () => {
    state.closedTicketsLimit = 50;
    refreshTicketsList();
  });
  
  document.getElementById('filterPriority').addEventListener('change', () => {
    state.closedTicketsLimit = 50;
    refreshTicketsList();
  });
  
  document.getElementById('filterAssignee').addEventListener('change', () => {
    state.closedTicketsLimit = 50;
    refreshTicketsList();
  });
  
  document.getElementById('dashboardSortBy').addEventListener('change', () => {
    state.closedTicketsLimit = 50;
    refreshTicketsList();
  });
  
  const dbIncludeArchive = document.getElementById('dashboardIncludeArchive');
  if (dbIncludeArchive) {
    dbIncludeArchive.addEventListener('change', () => {
      state.closedTicketsLimit = 50;
      refreshTicketsList();
    });
  }

  document.getElementById('btnClearFilters').addEventListener('click', () => {
    state.closedTicketsLimit = 50;
    document.getElementById('dashboardSearch').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterPriority').value = '';
    document.getElementById('filterAssignee').value = '';
    document.getElementById('dashboardSortBy').value = 'created_at';
    if (dbIncludeArchive) {
      dbIncludeArchive.checked = false;
    }
    refreshTicketsList();
  });

  // Modals close on outer overlay click (with safe mousedown/mouseup validation)
  let overlayMouseDownTarget = null;
  window.addEventListener('mousedown', (e) => {
    overlayMouseDownTarget = e.target;
  });
  window.addEventListener('mouseup', (e) => {
    const modal1 = document.getElementById('modalNewTicket');
    const modal2 = document.getElementById('modalTicketDetail');
    const modalFeedback = document.getElementById('modalFeedback');
    const lightbox = document.getElementById('lightboxModal');
    
    // Only trigger close if both mousedown and mouseup targeted the background overlay itself
    if (e.target === overlayMouseDownTarget) {
      if (e.target === modal2) closeTicketDetailModal();
      if (e.target === modalFeedback) closeFeedbackModal();
      if (e.target === lightbox) closeLightbox();
    }
    overlayMouseDownTarget = null;
  });

  // Close modals on Escape key press
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lightbox = document.getElementById('lightboxModal');
      if (lightbox && lightbox.classList.contains('active')) {
        closeLightbox();
      } else {
        const modal1 = document.getElementById('modalNewTicket');
        const modal2 = document.getElementById('modalTicketDetail');
        const modalFeedback = document.getElementById('modalFeedback');
        if (modal1 && modal1.classList.contains('active')) closeNewTicketModal();
        if (modal2 && modal2.classList.contains('active')) closeTicketDetailModal();
        if (modalFeedback && modalFeedback.classList.contains('active')) closeFeedbackModal();
      }
    }
  });

  // Ticket Detail Close Trigger
  document.getElementById('btnCloseTicketDetailModal').addEventListener('click', closeTicketDetailModal);

  // Lightbox close trigger
  const btnLightboxClose = document.getElementById('btnLightboxClose');
  if (btnLightboxClose) {
    btnLightboxClose.addEventListener('click', closeLightbox);
  }

  // Inline Category editing
  document.getElementById('btnEditCategoryInline').addEventListener('click', () => {
    document.getElementById('inlineCategoryEditBox').style.display = 'block';
    document.getElementById('btnEditCategoryInline').style.display = 'none';
    document.getElementById('selectInlineCategory').value = state.selectedTicket.ticket.category_id;
  });
  document.getElementById('btnCancelInlineCategory').addEventListener('click', () => {
    document.getElementById('inlineCategoryEditBox').style.display = 'none';
    document.getElementById('btnEditCategoryInline').style.display = 'inline-block';
  });
  document.getElementById('btnSaveInlineCategory').addEventListener('click', handleSaveInlineCategory);

  // Inline Priority editing
  document.getElementById('btnEditPriorityInline').addEventListener('click', () => {
    document.getElementById('inlinePriorityEditBox').style.display = 'block';
    document.getElementById('btnEditPriorityInline').style.display = 'none';
    document.getElementById('selectInlinePriority').value = state.selectedTicket.ticket.priority;
  });
  document.getElementById('btnCancelInlinePriority').addEventListener('click', () => {
    document.getElementById('inlinePriorityEditBox').style.display = 'none';
    document.getElementById('btnEditPriorityInline').style.display = 'inline-block';
  });
  document.getElementById('btnSaveInlinePriority').addEventListener('click', handleSaveInlinePriority);
  
  // Inline Initiator editing
  const btnEditInitiatorInline = document.getElementById('btnEditInitiatorInline');
  if (btnEditInitiatorInline) {
    btnEditInitiatorInline.addEventListener('click', () => {
      const inlineInitiatorEditBox = document.getElementById('inlineInitiatorEditBox');
      if (inlineInitiatorEditBox) inlineInitiatorEditBox.style.display = 'block';
      btnEditInitiatorInline.style.display = 'none';
      
      // Populate selectInlineInitiator select dropdown with users and select the current initiator
      const select = document.getElementById('selectInlineInitiator');
      if (select) {
        select.innerHTML = '<option value="">-- Выберите инициатора --</option>';
        const sortedUsers = [...(state.users || [])].sort((a, b) => {
          const nameA = a.full_name || '';
          const nameB = b.full_name || '';
          return nameA.localeCompare(nameB);
        });
        sortedUsers.forEach(u => {
          const deptText = u.department ? ` (${u.department})` : '';
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = `${u.full_name}${deptText}`;
          if (u.id === state.selectedTicket.ticket.initiator_id) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });
      }
    });
  }

  const btnCancelInlineInitiator = document.getElementById('btnCancelInlineInitiator');
  if (btnCancelInlineInitiator) {
    btnCancelInlineInitiator.addEventListener('click', () => {
      const inlineInitiatorEditBox = document.getElementById('inlineInitiatorEditBox');
      if (inlineInitiatorEditBox) inlineInitiatorEditBox.style.display = 'none';
      const btnEditInitiatorInline = document.getElementById('btnEditInitiatorInline');
      if (btnEditInitiatorInline) btnEditInitiatorInline.style.display = 'inline-block';
    });
  }

  const btnSaveInlineInitiator = document.getElementById('btnSaveInlineInitiator');
  if (btnSaveInlineInitiator) {
    btnSaveInlineInitiator.addEventListener('click', handleSaveInlineInitiator);
  }

  // Assignee Dropdown selector
  document.getElementById('selectAssignee').addEventListener('change', handleAssigneeChange);
  document.getElementById('btnTakeToMe').addEventListener('click', () => {
    document.getElementById('selectAssignee').value = state.currentUser.id;
    handleAssigneeChange({ target: { value: state.currentUser.id } });
  });

  // Specialist Status Action Buttons
  document.getElementById('btnActionWork').addEventListener('click', () => submitStatusUpdate('in_progress'));
  document.getElementById('btnActionPending').addEventListener('click', () => openJustificationBox('pending'));
  document.getElementById('btnActionResolve').addEventListener('click', () => openJustificationBox('resolved'));
  document.getElementById('btnActionReject').addEventListener('click', () => openJustificationBox('rejected'));
  document.getElementById('btnCancelStatusAction').addEventListener('click', closeJustificationBox);
  document.getElementById('btnSubmitStatusAction').addEventListener('click', handleJustificationActionSubmit);

  // Add comment submit
  document.getElementById('formAddComment').addEventListener('submit', handleCommentFormSubmit);

  // Initiator Ticket Cancel Actions
  const btnActionCancelTicket = document.getElementById('btnActionCancelTicket');
  if (btnActionCancelTicket) {
    btnActionCancelTicket.addEventListener('click', window.openCancelJustificationBox);
  }
  const btnCancelCancelTicket = document.getElementById('btnCancelCancelTicket');
  if (btnCancelCancelTicket) {
    btnCancelCancelTicket.addEventListener('click', window.closeCancelJustificationBox);
  }
  const btnSubmitCancelTicket = document.getElementById('btnSubmitCancelTicket');
  if (btnSubmitCancelTicket) {
    btnSubmitCancelTicket.addEventListener('click', handleCancelTicketSubmit);
  }

  // Comment file selection change listener
  const commentFileInput = document.getElementById('commentFileInput');
  if (commentFileInput) {
    commentFileInput.addEventListener('change', function(e) {
      if (this.files && this.files.length > 0) {
        addCommentFiles(this.files);
        this.value = ''; // Reset selection
      }
    });
  }

  // Comment Drag and Drop handlers
  const chatCard = document.querySelector('.chat-card');
  const chatDragOverlay = document.getElementById('chatDragOverlay');
  if (chatCard && chatDragOverlay) {
    chatCard.addEventListener('dragenter', (e) => {
      e.preventDefault();
      chatDragOverlay.style.display = 'flex';
    });

    chatDragOverlay.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    chatDragOverlay.addEventListener('dragleave', (e) => {
      e.preventDefault();
      chatDragOverlay.style.display = 'none';
    });

    chatDragOverlay.addEventListener('drop', (e) => {
      e.preventDefault();
      chatDragOverlay.style.display = 'none';
      if (e.dataTransfer && e.dataTransfer.files) {
        addCommentFiles(e.dataTransfer.files);
      }
    });
  }

  // Dynamic resize and Enter-to-send behavior for commentText textarea (WhatsApp/Telegram style)
  const commentTextarea = document.getElementById('commentText');
  if (commentTextarea) {
    commentTextarea.addEventListener('input', function() {
      this.style.height = '38px';
      this.style.height = Math.max(38, this.scrollHeight) + 'px';
    });

    commentTextarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const form = document.getElementById('formAddComment');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    });

    // Clipboard image pasting support inside comment text chat
    commentTextarea.addEventListener('paste', handleCommentTextPaste);
  }

  // Clipboard image pasting support inside New/Edit Ticket modal
  const modalNewTicketEl = document.getElementById('modalNewTicket');
  if (modalNewTicketEl) {
    modalNewTicketEl.addEventListener('paste', handleModalNewTicketPaste);
  }

  // Category Directory Form Submit
  document.getElementById('formCategory').addEventListener('submit', handleCategoryFormSubmit);
  document.getElementById('btnCancelCategoryEdit').addEventListener('click', resetCategoryForm);

  // Excel/CSV Report Export Submit
  const formExport = document.getElementById('formExport');
  if (formExport) {
    formExport.addEventListener('submit', handleReportExportSubmit);
  }

  // XLSX Dynamic Reports Export Button Click
  const btnExportXLSXCustom = document.getElementById('btnExportXLSXCustom');
  if (btnExportXLSXCustom) {
    btnExportXLSXCustom.addEventListener('click', handleXLSXCustomReportExport);
  }

  // Active Dashboard Table Export Button Click
  const btnExportClosedTabXLSX = document.getElementById('btnExportClosedTabXLSX');
  if (btnExportClosedTabXLSX) {
    btnExportClosedTabXLSX.addEventListener('click', handleXLSXActiveTableExport);
  }

  // Presets listeners
  const btnPresetPrevWeek = document.getElementById('btnPresetPrevWeek');
  if (btnPresetPrevWeek) {
    btnPresetPrevWeek.addEventListener('click', fillPresetPrevWeek);
  }
  const btnPresetWorkWeek = document.getElementById('btnPresetWorkWeek');
  if (btnPresetWorkWeek) {
    btnPresetWorkWeek.addEventListener('click', fillPresetWorkWeek);
  }
  const btnPresetCurrentMonth = document.getElementById('btnPresetCurrentMonth');
  if (btnPresetCurrentMonth) {
    btnPresetCurrentMonth.addEventListener('click', fillPresetCurrentMonth);
  }
  const btnPresetClearDates = document.getElementById('btnPresetClearDates');
  if (btnPresetClearDates) {
    btnPresetClearDates.addEventListener('click', clearExportDates);
  }

  const exportStartDate = document.getElementById('exportStartDate');
  if (exportStartDate) {
    exportStartDate.addEventListener('change', refreshReportsStats);
  }
  const exportEndDate = document.getElementById('exportEndDate');
  if (exportEndDate) {
    exportEndDate.addEventListener('change', refreshReportsStats);
  }

  // Guide Tabs Switching
  const btnGuideUsr = document.getElementById('btnGuideUsr');
  const btnGuideWtch = document.getElementById('btnGuideWtch');
  const guideUsrContent = document.getElementById('guideUsrContent');
  const guideWtchContent = document.getElementById('guideWtchContent');

  const btnGuideAdm = document.getElementById('btnGuideAdm');
  const guideAdmContent = document.getElementById('guideAdmContent');

  if (btnGuideUsr && btnGuideWtch && btnGuideAdm) {
    btnGuideUsr.addEventListener('click', () => {
      btnGuideUsr.style.borderColor = '#10b981';
      btnGuideUsr.style.color = '#10b981';
      btnGuideUsr.style.background = 'rgba(16, 185, 129, 0.05)';

      btnGuideWtch.style.borderColor = 'rgba(255,255,255,0.08)';
      btnGuideWtch.style.color = '';
      btnGuideWtch.style.background = '';

      btnGuideAdm.style.borderColor = 'rgba(255,255,255,0.08)';
      btnGuideAdm.style.color = '';
      btnGuideAdm.style.background = '';

      if (guideUsrContent) guideUsrContent.style.display = 'block';
      if (guideWtchContent) guideWtchContent.style.display = 'none';
      if (guideAdmContent) guideAdmContent.style.display = 'none';
    });

    btnGuideWtch.addEventListener('click', () => {
      btnGuideWtch.style.borderColor = '#3b82f6';
      btnGuideWtch.style.color = '#3b82f6';
      btnGuideWtch.style.background = 'rgba(59, 130, 246, 0.05)';

      btnGuideUsr.style.borderColor = 'rgba(255,255,255,0.08)';
      btnGuideUsr.style.color = '';
      btnGuideUsr.style.background = '';

      btnGuideAdm.style.borderColor = 'rgba(255,255,255,0.08)';
      btnGuideAdm.style.color = '';
      btnGuideAdm.style.background = '';

      if (guideWtchContent) guideWtchContent.style.display = 'block';
      if (guideUsrContent) guideUsrContent.style.display = 'none';
      if (guideAdmContent) guideAdmContent.style.display = 'none';
    });

    btnGuideAdm.addEventListener('click', () => {
      btnGuideAdm.style.borderColor = '#a855f7';
      btnGuideAdm.style.color = '#a855f7';
      btnGuideAdm.style.background = 'rgba(168, 85, 247, 0.05)';

      btnGuideUsr.style.borderColor = 'rgba(255,255,255,0.08)';
      btnGuideUsr.style.color = '';
      btnGuideUsr.style.background = '';

      btnGuideWtch.style.borderColor = 'rgba(255,255,255,0.08)';
      btnGuideWtch.style.color = '';
      btnGuideWtch.style.background = '';

      if (guideAdmContent) guideAdmContent.style.display = 'block';
      if (guideUsrContent) guideUsrContent.style.display = 'none';
      if (guideWtchContent) guideWtchContent.style.display = 'none';
    });
  }
}


// ================= CORE FUNCTIONS & FLOWS ================= //

function switchSection(sectionId) {
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(sec => sec.classList.remove('active'));
  
  const targetSec = document.getElementById(sectionId);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-target') === sectionId) {
      item.classList.add('active');
    }
  });

  state.currentSection = sectionId;

  // Clear ticket list cache to force a fresh render of the newly selected section
  state.tickets = [];

  // Refresh view contents based on selected section
  if (sectionId === 'sectionCategories') {
    renderCategoriesTable();
  } else if (sectionId === 'sectionReports') {
    refreshReportsStats();
  } else if (sectionId === 'sectionNotifications') {
    renderNotificationsCenter();
  } else {
    refreshTicketsList();
  }
}

// Fetch and render tickets dynamically with concurrency protection
let activeRefreshPromise = null;

async function refreshTicketsList() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    // Проверить, открыто ли модальное окно создания/редактирования заявки
    const modalNewTicket = document.getElementById('modalNewTicket');
    const isModalActive = modalNewTicket && modalNewTicket.classList.contains('active');

    // Проверить, сфокусирован ли пользователь на каком-либо поле ввода (пишет комментарий, ищет или заполняет форму)
    const isUserTyping = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    if (isModalActive || isUserTyping) {
      // Мягко пропускаем обновление списков, чтобы не сбить фокус и не перезаписать DOM
      return;
    }

    const urlParams = new URLSearchParams();

    if (state.currentSection === 'sectionMyTickets') {
      urlParams.append('initiator_id', state.currentUser.id);
    } else {
      const q = document.getElementById('dashboardSearch').value;
      const category_id = document.getElementById('filterCategory').value;
      const priority = document.getElementById('filterPriority').value;
      const assignee_id = document.getElementById('filterAssignee').value;

      if (q) urlParams.append('q', q);
      if (category_id) urlParams.append('category_id', category_id);
      if (priority) urlParams.append('priority', priority);
      if (assignee_id) urlParams.append('assignee_id', assignee_id);

      const dbIncludeArchive = document.getElementById('dashboardIncludeArchive');
      if (dbIncludeArchive && dbIncludeArchive.checked) {
        urlParams.append('include_archive', 'true');
      }
    }

    const sort_by = document.getElementById('dashboardSortBy').value;
    if (sort_by) {
      urlParams.append('sort_by', sort_by);
      urlParams.append('sort_order', sort_by === 'created_at' ? 'desc' : 'asc');
    }

    const paramsStr = urlParams.toString();
    const isFilterChanged = state.lastUrlParams !== undefined && state.lastUrlParams !== paramsStr;
    state.lastUrlParams = paramsStr;

    try {
      const fetchedTickets = await apiFetch(`/api/tickets?${paramsStr}`);
      
      // Check if this is the initial load (to avoid spamming notifications)
      const isFirstLoad = !state.tickets || state.tickets.length === 0;
      const skipNotifications = isFirstLoad || isFilterChanged;
      
      // Compare new list with current state.tickets
      const hasChanged = JSON.stringify(fetchedTickets) !== JSON.stringify(state.tickets);
      
      if (hasChanged) {
        if (!state.lastCommentIdsMap) {
          state.lastCommentIdsMap = {};
        }

        if (!skipNotifications) {
          const isAdm = state.currentUser.role === 'adm' || ['specialist', 'manager', 'admin'].includes(state.currentUser.role);
          
          // 1. Detect new background comments in any chats
          fetchedTickets.forEach(ticket => {
            if (ticket.last_comment_id) {
              const oldLastCommentId = state.lastCommentIdsMap[ticket.id];
              if (oldLastCommentId && ticket.last_comment_id > oldLastCommentId) {
                if (ticket.last_comment_author_id !== state.currentUser.id) {
                  // Only notify if the ticket details modal for this specific ticket is NOT open
                  const isModalOpenForThisTicket = state.selectedTicket && state.selectedTicket.ticket.id === ticket.id;
                  if (!isModalOpenForThisTicket) {
                    let shouldNotify = false;
                    
                    if (ticket.status === 'created' && isAdm) {
                      shouldNotify = true; // Rule 1: 'created' tickets comments go to all Adm
                    } else if (ticket.status === 'in_progress' && ticket.assignee_id === state.currentUser.id) {
                      shouldNotify = true; // Rule 2: 'in_progress' tickets comments go only to assignee
                    } else if (ticket.status === 'pending' && isAdm) {
                      shouldNotify = true; // Rule 3: 'pending' tickets comments go to all Adm
                    }
                    
                    // Regular user: always notify if they are the initiator
                    if (ticket.initiator_id === state.currentUser.id) {
                      shouldNotify = true;
                    }

                    if (shouldNotify) {
                      triggerDesktopNotification(
                        `Новый комментарий к заявке ${ticket.ticket_number}`,
                        `${ticket.last_comment_author_name}: "${ticket.last_comment_content}"`,
                        'comment',
                        ticket.id
                      );
                    }
                  }
                }
              }
            }
          });

          // 2. Detect list-level updates (New tickets / status updates)
          const oldTicketsMap = new Map(state.tickets.map(t => [t.id, t]));
          fetchedTickets.forEach(ticket => {
            const oldTicket = oldTicketsMap.get(ticket.id);
            const isNewTicket = !oldTicket;
            const isStatusChanged = oldTicket && oldTicket.status !== ticket.status;

            if (isNewTicket || isStatusChanged) {
              // Rule 1: 'created' (New) -> Notify all Adm
              if (ticket.status === 'created') {
                if (isAdm) {
                  triggerDesktopNotification(
                    `Новая заявка в очереди: ${ticket.ticket_number}`,
                    `Инициатор: ${ticket.initiator_name}\nТема: "${ticket.title}"`,
                    'new_ticket',
                    ticket.id
                  );
                }
              }
              // Rule 2: 'in_progress' (In work) -> Notify only the assignee
              else if (ticket.status === 'in_progress') {
                if (ticket.assignee_id === state.currentUser.id) {
                  triggerDesktopNotification(
                    `Вам назначена заявка: ${ticket.ticket_number}`,
                    `Вы назначены исполнителем.\nТема: "${ticket.title}"`,
                    'status_change',
                    ticket.id
                  );
                }
              }
              // Rule 3: 'pending' (Hold) -> Notify all Adm
              else if (ticket.status === 'pending') {
                if (isAdm) {
                  triggerDesktopNotification(
                    `Заявка приостановлена: ${ticket.ticket_number}`,
                    `Тема: "${ticket.title}"\nИсполнитель: ${ticket.assignee_name || 'Не назначен'}`,
                    'status_change',
                    ticket.id
                  );
                }
              }
              // Rule 4: 'resolved' or 'rejected' (Closed) -> Notify regular user initiator
              else if (ticket.status === 'resolved' || ticket.status === 'rejected') {
                if (ticket.initiator_id === state.currentUser.id) {
                  triggerDesktopNotification(
                    `Заявка выполнена: ${ticket.ticket_number}`,
                    `Новый статус: "${getRussianStatusName(ticket.status)}"\nТема: "${ticket.title}"`,
                    'status_change',
                    ticket.id
                  );
                }
              }
            }
          });
        }

        // Always synchronize lastCommentIdsMap state
        fetchedTickets.forEach(ticket => {
          if (ticket.last_comment_id) {
            state.lastCommentIdsMap[ticket.id] = ticket.last_comment_id;
          }
        });

        state.tickets = fetchedTickets;
        
        // Update corresponding dashboard view based on active section
        if (state.currentSection === 'sectionMyTickets') {
          renderEmployeeDashboard();
        } else {
          renderSpecialistDashboard();
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки заявок:', err);
    }
  })();

  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
}

// RENDER: Specialist Queues
function renderSpecialistDashboard() {
  const myWorkBody = document.getElementById('tableMyWorkBody');
  const toWorkBody = document.getElementById('tableToWorkBody');
  const pendingBody = document.getElementById('tablePendingBody');
  const closedBody = document.getElementById('tableClosedBody');
  const allWorkBody = document.getElementById('tableAllWorkBody');

  // Clear tables
  myWorkBody.innerHTML = '';
  toWorkBody.innerHTML = '';
  pendingBody.innerHTML = '';
  closedBody.innerHTML = '';
  if (allWorkBody) {
    allWorkBody.innerHTML = '';
  }

  let countMyWork = 0;
  let countToWork = 0;
  let countPending = 0;
  let countClosed = 0;
  let countAllWork = 0;

  // Populate specialist assignee selection dropdown if empty
  const filterAssignee = document.getElementById('filterAssignee');
  const currentSelectedFilter = filterAssignee.value;
  filterAssignee.innerHTML = '<option value="">Все исполнители</option>';
  
  const specialists = state.users.filter(u => u.role !== 'usr' && u.role !== 'employee');
  specialists.forEach(spec => {
    const opt = document.createElement('option');
    opt.value = spec.id;
    opt.textContent = spec.full_name;
    filterAssignee.appendChild(opt);
  });
  filterAssignee.value = currentSelectedFilter;

  // Distribute tickets into corresponding tabs
  state.tickets.forEach(ticket => {
    const dateFormatted = parseDateTime(ticket.created_at).toLocaleString('ru-RU');
    
    // Format description preview
    const rawDesc = (ticket.description || '').trim();
    // Collapse consecutive multiple empty lines to keep previews dense and aligned
    const cleanDesc = rawDesc.replace(/\n\s*\n/g, '\n');
    const shortDesc = cleanDesc.length > 400 ? cleanDesc.slice(0, 400) + '...' : cleanDesc;
    const escapedDesc = rawDesc.replace(/"/g, '&quot;');
    
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openTicketDetailModal(ticket.id));
    row.classList.add(`prio-${ticket.priority || 'medium'}`);
    if (ticket.category_name === 'Портал') {
      row.classList.add('category-portal');
    }

    const statusBadge = `<span class="status-tag ${ticket.status}">${getRussianStatusName(ticket.status)}</span>`;
    const priorityCell = `<span class="priority-tag ${ticket.priority}">${getRussianPriorityName(ticket.priority)}</span>`;

    // TAB: MY WORK (tickets in progress or pending assigned to current user)
    if ((ticket.status === 'in_progress' || ticket.status === 'pending') && ticket.assignee_id === state.currentUser.id) {
      countMyWork++;
      const rowMyWork = document.createElement('tr');
      rowMyWork.style.cursor = 'pointer';
      rowMyWork.addEventListener('click', () => openTicketDetailModal(ticket.id));
      rowMyWork.classList.add(`prio-${ticket.priority || 'medium'}`);
      if (ticket.category_name === 'Портал') {
        rowMyWork.classList.add('category-portal');
      }
      rowMyWork.innerHTML = `
        <td class="ticket-row-number">${ticket.ticket_number}</td>
        <td class="ticket-row-title" title="${escapedDesc}">
          <div style="display: flex; align-items: flex-start; gap: 8px; width: 100%;">
            ${ticket.status === 'pending' ? '<span class="status-tag pending" style="padding: 1px 6px; font-size: 10px; border-radius: 4px; flex-shrink: 0; margin-top: 2px;">В ожидании</span>' : ''}
            <div class="ticket-desc-preview" style="flex-grow: 1; min-width: 0;">${shortDesc}</div>
          </div>
        </td>
        <td class="ticket-row-initiator">${renderUserCellHtml(ticket.initiator_photo, ticket.initiator_name)}</td>
        <td class="ticket-row-category">${ticket.category_name || 'Не указана'}</td>
        <td class="ticket-row-status">${priorityCell}</td>
        <td class="ticket-row-date">${dateFormatted}</td>
        <td class="ticket-row-actions"><button class="btn btn-xs btn-primary">Посмотреть</button></td>
      `;
      myWorkBody.appendChild(rowMyWork);
    }

    // TAB: TO WORK (created tickets with no assignee)
    if (ticket.status === 'created') {
      countToWork++;
      row.innerHTML = `
        <td class="ticket-row-number">${ticket.ticket_number}</td>
        <td class="ticket-row-title" title="${escapedDesc}">
          <div class="ticket-desc-preview">${shortDesc}</div>
        </td>
        <td class="ticket-row-initiator">${renderUserCellHtml(ticket.initiator_photo, ticket.initiator_name)}</td>
        <td class="ticket-row-category">${ticket.category_name || 'Не указана'}</td>
        <td class="ticket-row-status">${priorityCell}</td>
        <td class="ticket-row-date">${dateFormatted}</td>
        <td class="ticket-row-actions"><button class="btn btn-xs btn-outline">Взять в работу</button></td>
      `;
      toWorkBody.appendChild(row);
    } 
    // TAB: PENDING (tickets on hold / waiting)
    else if (ticket.status === 'pending') {
      countPending++;
      row.innerHTML = `
        <td class="ticket-row-number">${ticket.ticket_number}</td>
        <td class="ticket-row-title" title="${escapedDesc}">
          <div class="ticket-desc-preview">${shortDesc}</div>
        </td>
        <td class="ticket-row-initiator">${renderUserCellHtml(ticket.initiator_photo, ticket.initiator_name)}</td>
        <td class="ticket-row-category">${ticket.category_name || 'Не указана'}</td>
        <td class="ticket-row-status">${priorityCell}</td>
        <td class="ticket-row-assignee">${renderUserCellHtml(ticket.assignee_photo, ticket.assignee_name || 'Не назначен')}</td>
        <td class="ticket-row-date">${parseDateTime(ticket.updated_at).toLocaleString('ru-RU')}</td>
        <td class="ticket-row-actions"><button class="btn btn-xs btn-primary">Посмотреть</button></td>
      `;
      pendingBody.appendChild(row);
    } 
    // TAB: CLOSED (resolved or rejected)
    else if (ticket.status === 'resolved' || ticket.status === 'rejected') {
      countClosed++;
    }

    // TAB: ALL WORK (all tickets currently in status 'in_progress')
    if (ticket.status === 'in_progress') {
      countAllWork++;
      if (allWorkBody) {
        const allWorkRow = document.createElement('tr');
        allWorkRow.style.cursor = 'pointer';
        allWorkRow.addEventListener('click', () => openTicketDetailModal(ticket.id));
        allWorkRow.classList.add(`prio-${ticket.priority || 'medium'}`);
        if (ticket.category_name === 'Портал') {
          allWorkRow.classList.add('category-portal');
        }
        allWorkRow.innerHTML = `
          <td class="ticket-row-number">${ticket.ticket_number}</td>
          <td class="ticket-row-title" title="${escapedDesc}">
            <div class="ticket-desc-preview">${shortDesc}</div>
          </td>
          <td class="ticket-row-initiator">${renderUserCellHtml(ticket.initiator_photo, ticket.initiator_name)}</td>
          <td class="ticket-row-category">${ticket.category_name || 'Не указана'}</td>
          <td class="ticket-row-status">${priorityCell}</td>
          <td class="ticket-row-assignee">${renderUserCellHtml(ticket.assignee_photo, ticket.assignee_name || 'Не назначен')}</td>
          <td class="ticket-row-date">${dateFormatted}</td>
          <td class="ticket-row-actions"><button class="btn btn-xs btn-primary">Посмотреть</button></td>
        `;
        allWorkBody.appendChild(allWorkRow);
      }
    }
  });

  // Sort and render Closed Tickets (recently closed first - sorted by closure time descending)
  const closedTickets = state.tickets.filter(t => t.status === 'resolved' || t.status === 'rejected');
  closedTickets.sort((a, b) => {
    const dateA = new Date(a.closed_at || a.updated_at || a.created_at);
    const dateB = new Date(b.closed_at || b.updated_at || b.created_at);
    return dateB - dateA;
  });

  // PERFORMANCE: Show first 50 closed tickets, load more on button click
  const limit = state.closedTicketsLimit || 50;
  const displayedClosed = closedTickets.slice(0, limit);

  displayedClosed.forEach(ticket => {
    const rawDesc = (ticket.description || '').trim();
    const cleanDesc = rawDesc.replace(/\n\s*\n/g, '\n');
    const shortDesc = cleanDesc.length > 400 ? cleanDesc.slice(0, 400) + '...' : cleanDesc;
    const escapedDesc = rawDesc.replace(/"/g, '&quot;');
    
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => openTicketDetailModal(ticket.id));
    row.classList.add(`prio-${ticket.priority || 'medium'}`);
    if (ticket.category_name === 'Портал') {
      row.classList.add('category-portal');
    }

    const statusBadge = `<span class="status-tag ${ticket.status}">${getRussianStatusName(ticket.status)}</span>`;
    const closedDateFormatted = parseDateTime(ticket.closed_at || ticket.updated_at || ticket.created_at).toLocaleString('ru-RU');

    row.innerHTML = `
      <td class="ticket-row-number">${ticket.ticket_number}</td>
      <td class="ticket-row-title" title="${escapedDesc}">
        <div class="ticket-desc-preview">${shortDesc}</div>
      </td>
      <td class="ticket-row-initiator">${renderUserCellHtml(ticket.initiator_photo, ticket.initiator_name)}</td>
      <td class="ticket-row-category">${ticket.category_name || 'Не указана'}</td>
      <td class="ticket-row-status">${statusBadge}</td>
      <td class="ticket-row-assignee">${renderUserCellHtml(ticket.assignee_photo, ticket.assignee_name || 'Не назначен')}</td>
      <td class="ticket-row-date">${closedDateFormatted}</td>
      <td class="ticket-row-actions"><button class="btn btn-xs btn-outline">Посмотреть</button></td>
    `;
    closedBody.appendChild(row);
  });

  // Display "Показать ещё 50 заявок" button spanning full width if there are more closed tickets
  if (closedTickets.length > limit) {
    const actionRow = document.createElement('tr');
    actionRow.className = 'table-action-row';
    actionRow.innerHTML = `
      <td colspan="8" style="text-align: center; padding: 16px; background: rgba(255,255,255,0.015); border-top: 1px solid var(--border-color);">
        <button id="btnLoadMoreClosed" class="btn btn-sm btn-outline" style="width: 100%; max-width: 320px; display: inline-block;">
          Показать ещё 50 заявок
        </button>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
          Показано ${limit} из ${closedTickets.length} закрытых заявок
        </div>
      </td>
    `;
    closedBody.appendChild(actionRow);

    // Attach load more click handler
    document.getElementById('btnLoadMoreClosed').addEventListener('click', (e) => {
      e.stopPropagation();
      state.closedTicketsLimit += 50;
      renderSpecialistDashboard();
    });
  } else if (closedTickets.length > 50) {
    const infoRow = document.createElement('tr');
    infoRow.className = 'table-info-row';
    infoRow.innerHTML = `
      <td colspan="8" style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 16px; background: rgba(255,255,255,0.015); border-top: 1px solid var(--border-color); pointer-events: none;">
        Показаны все ${closedTickets.length} закрытых заявок.
      </td>
    `;
    closedBody.appendChild(infoRow);
  }

  // Render empty state if no tickets in tab
  if (countMyWork === 0) renderEmptyTableState(myWorkBody, 7);
  if (countToWork === 0) renderEmptyTableState(toWorkBody, 7);
  if (countPending === 0) renderEmptyTableState(pendingBody, 8);
  if (countClosed === 0) renderEmptyTableState(closedBody, 8);
  if (countAllWork === 0 && allWorkBody) renderEmptyTableState(allWorkBody, 8);

  // Update tab headers badge counters
  document.getElementById('badgeMyWork').textContent = countMyWork;
  document.getElementById('badgeToWork').textContent = countToWork;
  document.getElementById('badgePending').textContent = countPending;
  document.getElementById('badgeClosed').textContent = countClosed;
  const badgeAllWork = document.getElementById('badgeAllWork');
  if (badgeAllWork) {
    badgeAllWork.textContent = countAllWork;
  }
}

function renderEmptyTableState(tbody, colSpan) {
  tbody.innerHTML = `
    <tr>
      <td colspan="${colSpan}" class="empty-state-text">Заявки в этой вкладке отсутствуют</td>
    </tr>
  `;
}

// RENDER: Employee Card Board
function renderEmployeeDashboard() {
  const activeList = document.getElementById('activeTicketsList');
  const closedList = document.getElementById('closedTicketsList');

  activeList.innerHTML = '';
  closedList.innerHTML = '';

  let countActive = 0;
  let countClosed = 0;

  state.tickets.forEach(ticket => {
    // Format description preview
    const rawDesc = (ticket.description || '').trim();
    // Collapse consecutive multiple empty lines to keep previews dense and aligned
    const cleanDesc = rawDesc.replace(/\n\s*\n/g, '\n');
    const shortDesc = cleanDesc.length > 400 ? cleanDesc.slice(0, 400) + '...' : cleanDesc;
    const escapedDesc = rawDesc.replace(/"/g, '&quot;');

    const card = document.createElement('div');
    card.className = 'emp-ticket-item';
    card.classList.add(`prio-${ticket.priority || 'medium'}`);
    if (ticket.category_name === 'Портал') {
      card.classList.add('category-portal');
    }
    card.addEventListener('click', () => openTicketDetailModal(ticket.id));

    const dateFormatted = parseDateTime(ticket.created_at).toLocaleDateString('ru-RU');
    const statusBadge = `<span class="status-tag ${ticket.status}">${getRussianStatusName(ticket.status)}</span>`;

    card.innerHTML = `
      <div class="emp-ticket-item-left">
        <div class="emp-ticket-meta">
          <span class="emp-ticket-num">${ticket.ticket_number}</span>
          <span class="bullet">•</span>
          <span>${dateFormatted}</span>
        </div>
        <div class="emp-ticket-title" title="${escapedDesc}">${shortDesc}</div>
      </div>
      <div class="emp-ticket-item-right">
        ${statusBadge}
      </div>
    `;

    if (ticket.status === 'resolved' || ticket.status === 'rejected') {
      countClosed++;
      closedList.appendChild(card);
    } else {
      countActive++;
      activeList.appendChild(card);
    }
  });

  if (countActive === 0) {
    activeList.innerHTML = '<p class="empty-state-text">У вас нет активных заявок</p>';
  }
  if (countClosed === 0) {
    closedList.innerHTML = '<p class="empty-state-text">Архив закрытых заявок пуст</p>';
  }
}

function getRussianStatusName(status) {
  const map = {
    'created': 'Создана',
    'in_progress': 'В работе',
    'pending': 'В ожидании',
    'resolved': 'Решено',
    'rejected': 'Отклонен'
  };
  return map[status] || status;
}

function getRussianPriorityName(priority) {
  const map = {
    'low': 'Низкий',
    'medium': 'Средний',
    'high': 'Высокий',
    'urgent': 'Критический'
  };
  return map[priority] || priority;
}


// ================= MODAL ACTIONS: TICKET REGISTRATION ================= //

function openNewTicketModal() {
  document.getElementById('modalNewTicket').classList.add('active');
  // Generate and set unique idempotency key for this draft form opening
  document.getElementById('ticketIdempotencyKey').value = generateUUID();
  
  // Clear form
  document.getElementById('formNewTicket').reset();
  state.attachedFiles = [];
  renderSelectedFiles();

  // Handle administrator initiator selection
  const formGroupAdminInitiator = document.getElementById('formGroupAdminInitiator');
  if (formGroupAdminInitiator) {
    if (state.currentUser && (state.currentUser.role === 'adm' || state.currentUser.role === 'admin')) {
      formGroupAdminInitiator.style.display = 'block';
      const selectInitiator = document.getElementById('ticketInitiator');
      if (selectInitiator) {
        selectInitiator.innerHTML = '<option value="">-- Выберите инициатора (создать от лица) --</option>';
        
        // Sort users alphabetically
        const sortedUsers = [...(state.users || [])].sort((a, b) => {
          const nameA = a.full_name || '';
          const nameB = b.full_name || '';
          return nameA.localeCompare(nameB);
        });

        sortedUsers.forEach(u => {
          const deptText = u.department ? ` (${u.department})` : '';
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = `${u.full_name}${deptText}`;
          if (u.id === state.currentUser.id) {
            opt.selected = true; // Default to current user (the admin)
          }
          selectInitiator.appendChild(opt);
        });
      }
    } else {
      formGroupAdminInitiator.style.display = 'none';
    }
  }
}

function closeNewTicketModal() {
  document.getElementById('modalNewTicket').classList.remove('active');
  state.editingTicketId = null;
  state.deletedAttachmentIds = [];
  
  const existingContainer = document.getElementById('existingAttachmentsContainer');
  if (existingContainer) {
    existingContainer.style.display = 'none';
  }
  
  const modalNewTicket = document.getElementById('modalNewTicket');
  const modalTitle = modalNewTicket.querySelector('.modal-header h2');
  if (modalTitle) {
    modalTitle.textContent = 'Регистрация новой заявки в IT';
  }
  const btnSubmit = document.getElementById('btnSubmitNewTicket');
  if (btnSubmit) {
    btnSubmit.textContent = 'Отправить заявку';
  }
  const fileGroup = document.getElementById('ticketFileGroup');
  if (fileGroup) {
    fileGroup.style.display = 'block';
  }
  // Hide admin initiator selection on close
  const formGroupAdminInitiator = document.getElementById('formGroupAdminInitiator');
  if (formGroupAdminInitiator) {
    formGroupAdminInitiator.style.display = 'none';
  }
}

// ================= FEEDBACK MODAL ACTIONS ================= //

function openFeedbackModal() {
  document.getElementById('modalFeedback').classList.add('active');
  document.getElementById('formFeedback').reset();
}

function closeFeedbackModal() {
  document.getElementById('modalFeedback').classList.remove('active');
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  
  const type = document.getElementById('feedbackType').value;
  const rawDesc = document.getElementById('feedbackDescription').value;
  
  const typeNames = {
    suggestion: 'Предложение',
    remark: 'Замечание'
  };
  
  const typeLabel = typeNames[type] || 'Обратная связь';
  const title = `[Обратная связь] ${typeLabel}`;
  const description = rawDesc.trim();
  
  const portalCat = state.categories.find(c => c.name === 'Портал');
  if (!portalCat) {
    alert('Категория "Портал" еще не загружена. Пожалуйста, подождите или обновите страницу.');
    return;
  }
  
  const btnSubmit = document.getElementById('btnSubmitFeedback');
  if (btnSubmit) btnSubmit.disabled = true;
  
  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category_id', portalCat.id);
    formData.append('priority', 'medium');
    formData.append('idempotency_key', generateUUID());
    
    const response = await fetch(getAbsoluteUrl('/api/tickets'), {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Ошибка при отправке обращения');
    }
    
    document.getElementById('formFeedback').reset();
    document.getElementById('modalFeedback').classList.remove('active');
    
    triggerDesktopNotification('Успех', 'Спасибо! Ваше обращение успешно отправлено.');
    showToast('Ваше обращение принято! Спасибо за обратную связь.', 'success');
    
    await refreshTicketsList();
  } catch (err) {
    console.error('Feedback submit error:', err);
    showToast(err.message, 'error');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

// File Selecting Handling
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  addFilesToState(files);
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('fileDragZone').classList.remove('dragover');
  
  if (e.dataTransfer.files) {
    const files = Array.from(e.dataTransfer.files);
    addFilesToState(files);
  }
}

function addFilesToState(files) {
  if (state.attachedFiles.length + files.length > 5) {
    showToast('Вы можете прикрепить не более 5 файлов', 'warning');
    return;
  }
  
  files.forEach(file => {
    // Only accept image, doc, pdf, excel files up to 5MB
    if (file.size > 5 * 1024 * 1024) {
      showToast(`Файл "${file.name}" слишком большой. Лимит 5 МБ.`, 'warning');
      return;
    }
    state.attachedFiles.push(file);
  });

  renderSelectedFiles();
}

function renderSelectedFiles() {
  const list = document.getElementById('selectedFilesList');
  list.innerHTML = '';

  state.attachedFiles.forEach((file, idx) => {
    const sizeKB = (file.size / 1024).toFixed(1);
    const item = document.createElement('div');
    item.className = 'file-preview-item';
    item.innerHTML = `
      <div class="file-preview-item-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--text-muted);"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        <span class="file-preview-name" title="${file.name}">${file.name}</span>
        <span class="file-preview-size">(${sizeKB} KB)</span>
      </div>
      <button type="button" class="btn-remove-file" onclick="removeAttachedFile(${idx})">&times;</button>
    `;
    list.appendChild(item);
  });
}

// Accessible from inline onclick trigger
window.removeAttachedFile = function(idx) {
  state.attachedFiles.splice(idx, 1);
  renderSelectedFiles();
};

function renderExistingAttachments() {
  const container = document.getElementById('existingAttachmentsContainer');
  const list = document.getElementById('existingAttachmentsList');
  if (!container || !list) return;

  const selected = state.selectedTicket;
  const attachments = selected ? selected.attachments : [];

  if (state.editingTicketId && attachments && attachments.length > 0) {
    container.style.display = 'block';
    list.innerHTML = '';

    attachments.forEach(file => {
      const isDeleted = state.deletedAttachmentIds.includes(file.id);
      const item = document.createElement('div');
      item.className = 'file-preview-item' + (isDeleted ? ' deleted-file' : '');
      item.style.opacity = isDeleted ? '0.4' : '1';
      item.style.textDecoration = isDeleted ? 'line-through' : 'none';
      
      item.innerHTML = `
        <div class="file-preview-item-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--text-muted);"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
          <span class="file-preview-name" title="${file.file_name}">${file.file_name}</span>
          <span class="file-preview-size">(${file.file_size})</span>
        </div>
        <button type="button" class="btn-remove-file" style="color: ${isDeleted ? 'var(--success)' : 'var(--danger)'}; font-size: 16px;" onclick="toggleExistingAttachment(${file.id})">
          ${isDeleted ? '↺' : '&times;'}
        </button>
      `;
      list.appendChild(item);
    });
  } else {
    container.style.display = 'none';
    list.innerHTML = '';
  }
}

window.toggleExistingAttachment = function(id) {
  const idx = state.deletedAttachmentIds.indexOf(id);
  if (idx > -1) {
    state.deletedAttachmentIds.splice(idx, 1);
  } else {
    state.deletedAttachmentIds.push(id);
  }
  renderExistingAttachments();
};

// CREATE OR EDIT TICKET FORM SUBMIT
async function handleTicketFormSubmit(e) {
  e.preventDefault();

  const btnSubmit = document.getElementById('btnSubmitNewTicket');
  
  // Disable button immediately to prevent double submissions (ТЗ 4.11)
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Отправка...';

  if (state.editingTicketId) {
    const formData = new FormData();
    formData.append('description', document.getElementById('ticketDescription').value);
    formData.append('category_id', document.getElementById('ticketCategory').value);
    formData.append('priority', document.getElementById('ticketPriority').value);

    state.attachedFiles.forEach(file => {
      formData.append('files', file);
    });

    state.deletedAttachmentIds.forEach(id => {
      formData.append('deletedAttachmentIds', id);
    });

    try {
      const result = await apiFetch(`/api/tickets/${state.editingTicketId}`, {
        method: 'PUT',
        body: formData
      });
      
      showToast(`Изменения в заявке ${result.ticket_number} успешно сохранены!`, 'success');
      
      closeNewTicketModal();
      closeTicketDetailModal();
      await refreshTicketsList();
    } catch (err) {
      showToast('Ошибка при сохранении изменений', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Сохранить изменения';
    }
    return;
  }

  const formData = new FormData();
  formData.append('title', ''); // Автогенерация на сервере
  formData.append('description', document.getElementById('ticketDescription').value);
  formData.append('category_id', document.getElementById('ticketCategory').value);
  formData.append('priority', document.getElementById('ticketPriority').value);
  formData.append('idempotency_key', document.getElementById('ticketIdempotencyKey').value);

  const selectInitiator = document.getElementById('ticketInitiator');
  if (selectInitiator && selectInitiator.value) {
    formData.append('initiator_id', selectInitiator.value);
  }

  state.attachedFiles.forEach(file => {
    formData.append('files', file);
  });

  try {
    const result = await apiFetch('/api/tickets', {
      method: 'POST',
      body: formData
    });

    const descVal = document.getElementById('ticketDescription').value;
    const shortDesc = descVal.split('\n')[0].slice(0, 60) + (descVal.length > 60 ? '...' : '');

    showToast(`Заявка ${result.ticket_number} успешно зарегистрирована!`, 'success');
    triggerDesktopNotification('Help Desk - Новая заявка', `Зарегистрирована заявка ${result.ticket_number}: "${shortDesc}"`);
    
    closeNewTicketModal();
    await refreshTicketsList();
  } catch (err) {
    showToast('Ошибка при подаче заявки', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Отправить заявку';
  }
}


// ================= TICKET DETAILS & ACTION TIMELINE BOARD ================= //

let detailPollingInterval = null;

function startDetailPolling(ticketId) {
  stopDetailPolling(); // Clear any existing just in case
  detailPollingInterval = setInterval(async () => {
    // Highly efficient: Skip background polling completely if the browser tab is hidden/inactive
    if (document.hidden) return;

    if (state.selectedTicket && state.selectedTicket.ticket.id === ticketId) {
      try {
        const ticketData = await apiFetch(`/api/tickets/${ticketId}`);
        
        // Detect if anything changed to avoid heavy DOM rebuilds
        const oldCommentsCount = state.selectedTicket.comments ? state.selectedTicket.comments.length : 0;
        const newCommentsCount = ticketData.comments ? ticketData.comments.length : 0;
        
        const oldHistoryCount = state.selectedTicket.history ? state.selectedTicket.history.length : 0;
        const newHistoryCount = ticketData.history ? ticketData.history.length : 0;
        
        const oldStatus = state.selectedTicket.ticket.status;
        const newStatus = ticketData.ticket.status;
        
        const oldAssignee = state.selectedTicket.ticket.assignee_id;
        const newAssignee = ticketData.ticket.assignee_id;

        const oldCategory = state.selectedTicket.ticket.category_id;
        const newCategory = ticketData.ticket.category_id;

        if (
          oldCommentsCount !== newCommentsCount || 
          oldHistoryCount !== newHistoryCount || 
          oldStatus !== newStatus ||
          oldAssignee !== newAssignee ||
          oldCategory !== newCategory
        ) {
          // Live notification for new comment added by someone else
          if (newCommentsCount > oldCommentsCount) {
            const lastComment = ticketData.comments[ticketData.comments.length - 1];
            if (lastComment.author_id !== state.currentUser.id) {
              triggerDesktopNotification(
                `Help Desk - Новый комментарий к заявке ${ticketData.ticket.ticket_number}`,
                `${lastComment.author_name}: "${lastComment.content}"`
              );
            }
          }

          // Live notification for status change
          if (oldStatus && oldStatus !== newStatus) {
            triggerDesktopNotification(
              `Help Desk - Изменение статуса ${ticketData.ticket.ticket_number}`,
              `Новый статус: "${getRussianStatusName(newStatus)}"`
            );
          }

          state.selectedTicket = ticketData;
          renderTicketDetails();
          
          if (oldStatus !== newStatus || oldAssignee !== newAssignee || oldCategory !== newCategory) {
            await refreshTicketsList();
          }
        }
      } catch (err) {
        console.error('Ошибка автообновления заявки:', err);
      }
    } else {
      stopDetailPolling();
    }
  }, 8000); // Poll every 8 seconds (reduced from 4s) for a snappier and lightweight experience
}

function stopDetailPolling() {
  if (detailPollingInterval) {
    clearInterval(detailPollingInterval);
    detailPollingInterval = null;
  }
}

async function openTicketDetailModal(id) {
  try {
    state.commentAttachedFiles = [];
    const list = document.getElementById('commentFilesList');
    if (list) {
      list.style.display = 'none';
      list.innerHTML = '';
    }

    const ticketData = await apiFetch(`/api/tickets/${id}`);
    state.selectedTicket = ticketData;
    
    document.getElementById('modalTicketDetail').classList.add('active');
    
    renderTicketDetails();
    startDetailPolling(id);
  } catch (err) {
    showToast('Не удалось открыть подробности заявки', 'error');
  }
}

function closeTicketDetailModal() {
  document.getElementById('modalTicketDetail').classList.remove('active');
  state.selectedTicket = null;
  state.commentAttachedFiles = [];
  const list = document.getElementById('commentFilesList');
  if (list) {
    list.style.display = 'none';
    list.innerHTML = '';
  }
  closeJustificationBox();
  closeCancelJustificationBox();
  stopDetailPolling();
}

// RENDER: Detailed card elements
function renderTicketDetails() {
  const { ticket, comments, history, attachments } = state.selectedTicket;

  // Header Title
  document.getElementById('detailTicketNumber').textContent = ticket.ticket_number;
  
  const statusTag = document.getElementById('detailTicketStatus');
  statusTag.textContent = getRussianStatusName(ticket.status);
  statusTag.className = `status-tag ${ticket.status}`;

  // Description Card
  document.getElementById('detailTicketTitle').textContent = `Описание проблемы (${ticket.category_name || 'Без категории'})`;
  document.getElementById('detailTicketDesc').textContent = ticket.description;

  // File Attachments
  const attachmentsBox = document.getElementById('detailAttachmentsBox');
  const attachmentsList = document.getElementById('detailAttachmentsList');
  attachmentsList.innerHTML = '';

  if (attachments && attachments.length > 0) {
    attachmentsBox.style.display = 'block';
    const canDelete = state.currentUser.role === 'adm' || ticket.initiator_id === state.currentUser.id;

    attachments.forEach(file => {
      const isImage = /\.(apng|avif|gif|jpg|jpeg|jfif|pjpeg|pjpg|png|svg|webp)$/i.test(file.file_name);
      if (isImage) {
        // Render a beautiful thumbnail preview with premium hover scale effect and optional delete button
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'attachment-image-wrapper';
        
        const deleteBtnHtml = canDelete ? `
          <button class="attachment-delete-btn" onclick="event.preventDefault(); event.stopPropagation(); deleteAttachment(${ticket.id}, ${file.id}, this)" title="Удалить файл">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        ` : '';

        imgWrapper.innerHTML = `
          ${deleteBtnHtml}
          <a href="${getAbsoluteUrl(file.file_path)}" target="_blank" class="attachment-image-link" onclick="event.preventDefault(); openLightbox('${getAbsoluteUrl(file.file_path)}', '${file.file_name.replace(/'/g, "\\'")}', '${file.file_size}')">
            <img class="attachment-image-thumb" src="${getAbsoluteUrl(file.file_path)}" alt="${file.file_name}">
          </a>
          <div class="attachment-image-info">
            <span class="attachment-image-name" title="${file.file_name}">${file.file_name}</span>
            <span class="attachment-image-size">(${file.file_size})</span>
          </div>
        `;
        attachmentsList.appendChild(imgWrapper);
      } else {
        const filePill = document.createElement('a');
        filePill.className = 'attachment-file-pill';
        filePill.href = getAbsoluteUrl(file.file_path);
        filePill.download = file.file_name;
        filePill.target = '_blank';
        
        const deleteBtnHtml = canDelete ? `
          <button class="attachment-delete-btn-pill" onclick="event.preventDefault(); event.stopPropagation(); deleteAttachment(${ticket.id}, ${file.id}, this)" title="Удалить файл">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px;height:10px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        ` : '';

        filePill.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;" title="${file.file_name}">${file.file_name}</span>
          <span style="color:var(--text-muted);font-size:10px;flex-shrink:0;">(${file.file_size})</span>
          ${deleteBtnHtml}
        `;
        attachmentsList.appendChild(filePill);
      }
    });
  } else {
    attachmentsBox.style.display = 'none';
  }


  // Sidebar Metadata with Premium Avatar support
  const avatarEl = document.getElementById('detailInitiatorAvatar');
  if (avatarEl) {
    avatarEl.innerHTML = renderUserAvatarHtml(ticket.initiator_photo, ticket.initiator_name);
  }
  const detailInitiatorNameEl = document.getElementById('detailInitiatorName');
  if (detailInitiatorNameEl) {
    detailInitiatorNameEl.textContent = ticket.initiator_name;
  }
  
  let contactInfo = `Тел: ${ticket.initiator_phone || 'нет'} | Email: ${ticket.initiator_email || 'нет'}`;
  if (ticket.initiator_cabinet) {
    contactInfo += ` | Каб: ${ticket.initiator_cabinet}`;
  }
  if (ticket.initiator_position || ticket.initiator_department) {
    const parts = [];
    if (ticket.initiator_department) parts.push(ticket.initiator_department);
    if (ticket.initiator_position) parts.push(ticket.initiator_position);
    contactInfo += `\n${parts.join(' - ')}`;
  }
  const contactsEl = document.getElementById('detailInitiatorContacts');
  if (contactsEl) {
    contactsEl.innerText = contactInfo;
  }


  // Toggle visibility of the Edit Button
  const btnEditTicketUser = document.getElementById('btnEditTicketUser');
  if (btnEditTicketUser) {
    if (ticket.initiator_id === state.currentUser.id && ticket.status === 'created' && ticket.assignee_id === null) {
      btnEditTicketUser.style.display = 'inline-flex';
    } else {
      btnEditTicketUser.style.display = 'none';
    }
  }

  document.getElementById('detailCreatedAt').textContent = parseDateTime(ticket.created_at).toLocaleString('ru-RU');
  
  const prioTag = document.getElementById('detailPriorityTag');
  prioTag.textContent = getRussianPriorityName(ticket.priority);
  prioTag.className = `meta-val priority-tag ${ticket.priority}`;

  document.getElementById('detailCategoryName').textContent = ticket.category_name || 'Не указана';

  // Populating Assignee selection controls
  const isSpecialistOrManager = state.currentUser.role === 'adm' || ['specialist', 'manager', 'admin'].includes(state.currentUser.role);
  
  const detailPriorityRow = document.getElementById('detailPriorityRow');
  if (detailPriorityRow) {
    detailPriorityRow.style.display = isSpecialistOrManager ? 'flex' : 'none';
  }

  const selectAssignee = document.getElementById('selectAssignee');
  const labelAssigneeText = document.getElementById('labelAssigneeText');
  const btnTakeToMe = document.getElementById('btnTakeToMe');
  const btnEditCategory = document.getElementById('btnEditCategoryInline');
  const btnEditPriority = document.getElementById('btnEditPriorityInline');
  const btnEditInitiator = document.getElementById('btnEditInitiatorInline');

  // Hide inline editor forms
  document.getElementById('inlineCategoryEditBox').style.display = 'none';
  document.getElementById('inlinePriorityEditBox').style.display = 'none';
  const inlineInitiatorEditBox = document.getElementById('inlineInitiatorEditBox');
  if (inlineInitiatorEditBox) {
    inlineInitiatorEditBox.style.display = 'none';
  }

  if (isSpecialistOrManager) {
    btnEditCategory.style.display = 'inline-block';
    
    if (state.currentUser.role === 'adm' || state.currentUser.role === 'admin') {
      btnEditPriority.style.display = 'inline-block';
      if (btnEditInitiator) btnEditInitiator.style.display = 'inline-block';
    } else {
      btnEditPriority.style.display = 'none';
      if (btnEditInitiator) btnEditInitiator.style.display = 'none';
    }
    
    // Assignee dropdown population
    selectAssignee.style.display = 'inline-block';
    labelAssigneeText.style.display = 'none';
    
    selectAssignee.innerHTML = '<option value="">Не назначен</option>';
    const specialists = state.users.filter(u => u.role !== 'usr' && u.role !== 'employee');
    specialists.forEach(spec => {
      const opt = document.createElement('option');
      opt.value = spec.id;
      opt.textContent = spec.full_name;
      selectAssignee.appendChild(opt);
    });
    selectAssignee.value = ticket.assignee_id || '';

    // "Take to me" button logic
    if (!ticket.assignee_id) {
      btnTakeToMe.style.display = 'inline-block';
    } else {
      btnTakeToMe.style.display = 'none';
    }
  } else {
    // Normal employees just see static text
    btnEditCategory.style.display = 'none';
    btnEditPriority.style.display = 'none';
    if (btnEditInitiator) btnEditInitiator.style.display = 'none';
    selectAssignee.style.display = 'none';
    labelAssigneeText.style.display = 'inline-block';
    labelAssigneeText.textContent = ticket.assignee_name || 'Ожидает распределения';
    btnTakeToMe.style.display = 'none';
  }

  // RENDER: Specialist Action Controls Area (В работу, Решить, Отклон)
  const specActionsBox = document.getElementById('specialistControlsBox');
  if (isSpecialistOrManager && ['created', 'in_progress', 'pending'].includes(ticket.status)) {
    specActionsBox.style.display = 'block';
    
    const btnWork = document.getElementById('btnActionWork');
    const btnPending = document.getElementById('btnActionPending');
    const btnResolve = document.getElementById('btnActionResolve');
    const btnReject = document.getElementById('btnActionReject');

    // Filter button display according to status lifecycle
    if (ticket.status === 'created') {
      btnWork.style.display = 'block';
      btnPending.style.display = 'none';
      btnResolve.style.display = 'block';
      btnReject.style.display = 'block';
    } else if (ticket.status === 'in_progress') {
      btnWork.style.display = 'none';
      btnPending.style.display = 'block';
      btnResolve.style.display = 'block';
      btnReject.style.display = 'block';
    } else if (ticket.status === 'pending') {
      btnWork.style.display = 'block'; // resume
      btnPending.style.display = 'none';
      btnResolve.style.display = 'block';
      btnReject.style.display = 'block';
    }
  } else {
    specActionsBox.style.display = 'none';
  }

  // RENDER: Initiator Action Controls Area (Отмена заявки)
  const initiatorBox = document.getElementById('initiatorControlsBox');
  if (initiatorBox) {
    const isInitiator = String(ticket.initiator_id) === String(state.currentUser.id);
    // Specialists/Managers do not need the initiator cancellation card (they already have the full solution management panel)
    if (isInitiator && !isSpecialistOrManager && ['created', 'in_progress', 'pending'].includes(ticket.status)) {
      initiatorBox.style.display = 'block';
    } else {
      initiatorBox.style.display = 'none';
    }
  }

  // RENDER: Chat Comments Feed
  renderCommentsList(comments);

  // RENDER: History/Lifecycle Timeline (ТЗ 4.9)
  renderHistoryTimeline(history);
}

// HELPER: Formats comment content by escaping HTML and converting markdown links and images
function formatCommentContent(content) {
  if (!content) return '';
  
  // 1. Escape HTML to prevent XSS
  let escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 2. Parse markdown images: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
  escaped = escaped.replace(imgRegex, (match, alt, url) => {
    return `<img src="${getAbsoluteUrl(url)}" class="chat-comment-image" alt="${alt || 'Изображение'}" style="max-width: 100%; max-height: 180px; object-fit: contain; display: block; border-radius: 8px; margin: 8px 0; cursor: pointer; border: 1px solid var(--border-color); background: var(--bg-hover); transition: transform 0.2s;" onclick="event.preventDefault(); openLightbox('${getAbsoluteUrl(url)}', '${(alt || 'Изображение').replace(/'/g, "\\'")}')">`;
  });

  // 3. Parse markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
  escaped = escaped.replace(linkRegex, (match, text, url) => {
    return `<a href="${getAbsoluteUrl(url)}" target="_blank" class="chat-comment-link" style="color: var(--primary-color); text-decoration: underline; font-weight: 500;">${text}</a>`;
  });

  // 4. Handle regular line breaks
  return escaped.replace(/\n/g, '<br>');
}

function renderCommentsList(comments) {
  const feed = document.getElementById('detailCommentsFeed');
  feed.innerHTML = '';

  if (comments && comments.length > 0) {
    comments.forEach(comment => {
      const bubble = document.createElement('div');
      
      const isMyMessage = comment.author_id === state.currentUser.id;
      bubble.className = `comment-bubble ${isMyMessage ? 'outgoing' : 'incoming'}`;
      
      const timeFormatted = parseDateTime(comment.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const roleBadge = getRussianRoleName(comment.author_role);

      bubble.innerHTML = `
        <div class="comment-header">
          <span class="comment-author">${comment.author_name} <span class="comment-author-role">(${roleBadge})</span></span>
          <span class="comment-time">${timeFormatted}</span>
        </div>
        <div class="comment-content">${formatCommentContent(comment.content)}</div>
      `;
      feed.appendChild(bubble);
    });

    // Auto scroll chat to bottom
    setTimeout(() => feed.scrollTop = feed.scrollHeight, 50);
  } else {
    feed.innerHTML = '<div class="comment-bubble system">Переписка пуста. Задайте вопрос специалисту или опишите ход решения.</div>';
  }
}

function renderHistoryTimeline(history) {
  const timeline = document.getElementById('detailHistoryTimeline');
  timeline.innerHTML = '';

  history.forEach(item => {
    const timeFormatted = parseDateTime(item.created_at).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const node = document.createElement('div');
    node.className = 'timeline-item';
    node.setAttribute('data-action', item.action);

    node.innerHTML = `
      <div class="timeline-act-row">
        <span class="timeline-act">${item.action}</span>
        <span class="timeline-time">${timeFormatted}</span>
      </div>
      <div class="timeline-details">${item.details || ''} (${item.user_name})</div>
    `;
    timeline.appendChild(node);
  });

  // Auto scroll timeline to bottom
  setTimeout(() => timeline.scrollTop = timeline.scrollHeight, 50);
}


// INLINE ACTIONS AND FORM SUBMITS

// 1. Inline Change Category (ТЗ 4.5.1)
async function handleSaveInlineCategory() {
  const category_id = document.getElementById('selectInlineCategory').value;
  if (!category_id) return;

  try {
    const result = await apiFetch(`/api/tickets/${state.selectedTicket.ticket.id}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id })
    });

    showToast('Категория успешно изменена!', 'success');
    document.getElementById('detailCategoryName').textContent = result.category_name;
    document.getElementById('inlineCategoryEditBox').style.display = 'none';
    document.getElementById('btnEditCategoryInline').style.display = 'inline-block';

    // Refresh underlying ticket detail and queues list
    await openTicketDetailModal(state.selectedTicket.ticket.id);
    await refreshTicketsList();
  } catch (err) {
    showToast('Не удалось обновить категорию', 'error');
  }
}

// 1.2 Inline Change Priority
async function handleSaveInlinePriority() {
  const priority = document.getElementById('selectInlinePriority').value;
  if (!priority) return;

  try {
    const result = await apiFetch(`/api/tickets/${state.selectedTicket.ticket.id}/priority`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority })
    });

    showToast('Приоритет успешно изменен!', 'success');
    document.getElementById('inlinePriorityEditBox').style.display = 'none';
    document.getElementById('btnEditPriorityInline').style.display = 'inline-block';

    // Refresh underlying ticket detail and queues list
    await openTicketDetailModal(state.selectedTicket.ticket.id);
    await refreshTicketsList();
  } catch (err) {
    showToast('Не удалось обновить приоритет', 'error');
  }
}

// 1.3 Inline Change Initiator (Only for adm)
async function handleSaveInlineInitiator() {
  const initiator_id = document.getElementById('selectInlineInitiator').value;
  if (!initiator_id) return;

  try {
    const result = await apiFetch(`/api/tickets/${state.selectedTicket.ticket.id}/initiator`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initiator_id })
    });

    showToast('Инициатор успешно изменен!', 'success');
    const inlineInitiatorEditBox = document.getElementById('inlineInitiatorEditBox');
    if (inlineInitiatorEditBox) inlineInitiatorEditBox.style.display = 'none';
    const btnEditInitiatorInline = document.getElementById('btnEditInitiatorInline');
    if (btnEditInitiatorInline) btnEditInitiatorInline.style.display = 'inline-block';

    // Refresh underlying ticket detail and queues list
    await openTicketDetailModal(state.selectedTicket.ticket.id);
    await refreshTicketsList();
  } catch (err) {
    showToast('Не удалось обновить инициатора заявки', 'error');
  }
}

// 2. Assignee selection updated
async function handleAssigneeChange(e) {
  const assignee_id = e.target.value;
  const ticketId = state.selectedTicket.ticket.id;

  try {
    const result = await apiFetch(`/api/tickets/${ticketId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: assignee_id ? parseInt(assignee_id) : null })
    });

    showToast(`Исполнитель успешно обновлен: ${result.assignee_name}`, 'success');
    triggerDesktopNotification('Help Desk - Назначение', `Назначен ответственный по заявке ${state.selectedTicket.ticket.ticket_number}: ${result.assignee_name}`);
    
    await openTicketDetailModal(ticketId);
    await refreshTicketsList();
  } catch (err) {
    showToast('Ошибка при назначении исполнителя', 'error');
  }
}

// 3. Status Action Handler (В работу, Решить, Отклонить, Приостановить)
let activeStatusActionTarget = ''; // holds 'pending' | 'resolved' | 'rejected'

function openJustificationBox(actionType) {
  activeStatusActionTarget = actionType;
  
  const box = document.getElementById('actionJustificationBox');
  const label = document.getElementById('justificationLabel');
  const txt = document.getElementById('actionJustificationText');

  box.style.display = 'flex';
  txt.value = '';

  if (actionType === 'pending') {
    label.textContent = 'Укажите причину приостановки выполнения заявки *';
    txt.placeholder = 'Например: Ожидание закупки сетевого адаптера или подтверждения от руководителя...';
  } else if (actionType === 'resolved') {
    label.textContent = 'Опишите результат выполнения заявки';
    txt.placeholder = 'Например: Принтер установлен и подключен по сети, драйверы обновлены, печать проверена...';
  } else if (actionType === 'rejected') {
    label.textContent = 'Опишите причину отказа в выполнении заявки *';
    txt.placeholder = 'Например: Отдел ЗУР не имеет лимита на закупку дополнительных МФУ в этом квартале...';
  }
}

function closeJustificationBox() {
  document.getElementById('actionJustificationBox').style.display = 'none';
  activeStatusActionTarget = '';
}

async function handleJustificationActionSubmit() {
  const details = document.getElementById('actionJustificationText').value.trim();
  if (!details && activeStatusActionTarget !== 'resolved') {
    showToast('Пожалуйста, введите комментарий/обоснование действия', 'warning');
    return;
  }

  await submitStatusUpdate(activeStatusActionTarget, details);
  closeJustificationBox();
}

async function submitStatusUpdate(status, details = '') {
  const ticketId = state.selectedTicket.ticket.id;
  const num = state.selectedTicket.ticket.ticket_number;

  try {
    const result = await apiFetch(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, details })
    });

    showToast(`Статус заявки успешно изменен на "${getRussianStatusName(status)}"!`, 'success');
    triggerDesktopNotification('Help Desk - Изменение статуса', `Заявка ${num} переведена в статус "${getRussianStatusName(status)}".`);

    await openTicketDetailModal(ticketId);
    await refreshTicketsList();
  } catch (err) {
    showToast('Ошибка при смене статуса заявки', 'error');
  }
}

// CLIPBOARD ATTACHMENT: Paste screenshots directly in New Ticket modal
function handleModalNewTicketPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault(); // Предотвращаем вставку бинарных данных как текста
      const file = items[i].getAsFile();
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Скриншот слишком большой. Лимит 5 МБ.', 'warning');
          return;
        }
        const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: 'image/png' });
        state.attachedFiles.push(namedFile);
        renderSelectedFiles();
        showToast('Скриншот из буфера добавлен к заявке!', 'success');
      }
    }
  }
}

// CLIPBOARD ATTACHMENT: Paste screenshots directly into comment chat (uploads via API and inserts Markdown)
async function handleCommentTextPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const items = clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault(); // Предотвращаем стандартную вставку
      const file = items[i].getAsFile();
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Изображение слишком большое. Лимит 5 МБ.', 'warning');
          return;
        }

        const txt = document.getElementById('commentText');
        const originalPlaceholder = txt.placeholder;
        txt.placeholder = 'Загрузка скриншота...';
        txt.disabled = true;

        const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: 'image/png' });
        const formData = new FormData();
        formData.append('file', namedFile);

        try {
          const ticketId = state.selectedTicket.ticket.id;
          const result = await apiFetch(`/api/tickets/${ticketId}/attachments`, {
            method: 'POST',
            body: formData
          });

          // Вставляем ссылку-разметку на изображение в текущую позицию курсора
          const startPos = txt.selectionStart;
          const endPos = txt.selectionEnd;
          const text = txt.value;
          const markdownImg = `\n![Изображение](${result.file_path})\n`;

          txt.value = text.substring(0, startPos) + markdownImg + text.substring(endPos);

          // Переводим фокус курсора за вставленный текст
          const newCursorPos = startPos + markdownImg.length;
          txt.selectionStart = newCursorPos;
          txt.selectionEnd = newCursorPos;

          // Растягиваем высоту поля, если необходимо
          txt.style.height = '38px';
          txt.style.height = Math.max(38, txt.scrollHeight) + 'px';

          showToast('Скриншот загружен в переписку!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Не удалось загрузить скриншот в переписку', 'error');
        } finally {
          txt.placeholder = originalPlaceholder;
          txt.disabled = false;
          txt.focus();
        }
      }
    }
  }
}

// 4. Comment submission form
async function handleCommentFormSubmit(e) {
  e.preventDefault();
  const txt = document.getElementById('commentText');
  const content = txt.value.trim();
  
  const hasFiles = state.commentAttachedFiles && state.commentAttachedFiles.length > 0;
  if (!content && !hasFiles) return;

  const ticketId = state.selectedTicket.ticket.id;
  const btnSubmit = e.target.querySelector('button[type="submit"]');

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Отправка...';
  }
  txt.disabled = true;

  try {
    let finalContent = content;

    if (hasFiles) {
      const uploadedUrls = [];
      for (const file of state.commentAttachedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadResult = await apiFetch(`/api/tickets/${ticketId}/attachments`, {
          method: 'POST',
          body: formData
        });
        uploadedUrls.push({
          filename: file.name,
          path: uploadResult.file_path,
          isImage: /\.(apng|avif|gif|jpg|jpeg|jfif|pjpeg|pjpg|png|svg|webp)$/i.test(file.name)
        });
      }

      uploadedUrls.forEach(up => {
        if (up.isImage) {
          finalContent += (finalContent ? '\n\n' : '') + `![${up.filename}](${up.path})`;
        } else {
          finalContent += (finalContent ? '\n\n' : '') + `📎 [${up.filename}](${up.path})`;
        }
      });
    }

    const newComment = await apiFetch(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: finalContent })
    });

    txt.value = '';
    txt.style.height = '';
    state.commentAttachedFiles = [];
    renderCommentSelectedFiles();
    
    // Refresh modal details (appends comment and history instantly)
    await openTicketDetailModal(ticketId);
  } catch (err) {
    showToast('Не удалось отправить комментарий', 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Отправить';
    }
    txt.disabled = false;
    txt.focus();
  }
}


// ================= REFERENCE DIRECTORY: CATEGORIES (ТЗ 4.8) ================= //

async function renderCategoriesTable() {
  const body = document.getElementById('tableCategoriesBody');
  body.innerHTML = '';

  try {
    // Reload categories list to capture any database changes
    state.categories = await apiFetch('/api/categories');
    populateCategorySelectors();

    state.categories.forEach(cat => {
      const row = document.createElement('tr');
      const statusText = cat.is_active 
        ? '<span class="status-tag resolved" style="padding: 2px 8px; font-size:10px;">Активна</span>' 
        : '<span class="status-tag low" style="padding: 2px 8px; font-size:10px;">Отключена</span>';

      row.innerHTML = `
        <td style="font-weight:600;color:var(--text-muted);">${cat.id}</td>
        <td style="font-weight:600;">${cat.name}</td>
        <td>${statusText}</td>
        <td>
          <div class="btn-row-sm">
            <button class="btn btn-xs btn-outline" onclick="startEditCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', ${cat.is_active})">Редактировать</button>
            <button class="btn btn-xs btn-outline text-red" onclick="deleteCategory(${cat.id})">Удалить</button>
          </div>
        </td>
      `;
      body.appendChild(row);
    });
  } catch (err) {
    showToast('Ошибка рендеринга списка категорий', 'error');
  }
}

window.startEditCategory = function(id, name, is_active) {
  document.getElementById('editCategoryId').value = id;
  document.getElementById('categoryInputName').value = name;
  document.getElementById('categoryInputActive').checked = is_active;

  document.getElementById('categoryFormTitle').textContent = 'Редактировать категорию';
  document.getElementById('btnSaveCategory').textContent = 'Сохранить';
  document.getElementById('btnCancelCategoryEdit').style.display = 'block';
  document.getElementById('catActiveGroup').style.display = 'flex';
};

function resetCategoryForm() {
  document.getElementById('editCategoryId').value = '';
  document.getElementById('formCategory').reset();

  document.getElementById('categoryFormTitle').textContent = 'Добавить категорию';
  document.getElementById('btnSaveCategory').textContent = 'Добавить';
  document.getElementById('btnCancelCategoryEdit').style.display = 'none';
  document.getElementById('catActiveGroup').style.display = 'none';
}

async function handleCategoryFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editCategoryId').value;
  const name = document.getElementById('categoryInputName').value.trim();
  const is_active = document.getElementById('categoryInputActive').checked;

  const body = { name };
  if (id) body.is_active = is_active;

  try {
    if (id) {
      // EDIT Existing Category
      await apiFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      showToast('Категория успешно обновлена!', 'success');
    } else {
      // CREATE New Category
      await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      showToast('Категория успешно добавлена в справочник!', 'success');
    }

    resetCategoryForm();
    await renderCategoriesTable();
  } catch (err) {
    // API errors handled by wrapper toast
  }
}

window.deleteCategory = async function(id) {
  if (!confirm('Вы действительно хотите удалить эту категорию из справочника? Если она используется в активных заявках, она будет временно деактивирована.')) {
    return;
  }

  try {
    const result = await apiFetch(`/api/categories/${id}`, {
      method: 'DELETE'
    });

    showToast(result.message, 'success');
    await renderCategoriesTable();
  } catch (err) {
    // API errors handled by wrapper toast
  }
};


// ================= STATISTICS & REPORTS (ТЗ 4.10) ================= //

async function refreshReportsStats() {
  try {
    const start_date = document.getElementById('exportStartDate') ? document.getElementById('exportStartDate').value : '';
    const end_date = document.getElementById('exportEndDate') ? document.getElementById('exportEndDate').value : '';

    const params = new URLSearchParams();
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);

    const stats = await apiFetch(`/api/reports/stats?${params.toString()}`);
    
    // 1. RENDER Metrics Cards
    document.getElementById('metricTotal').textContent = stats.summary.total;
    document.getElementById('metricInProgress').textContent = stats.summary.in_progress;
    document.getElementById('metricPending').textContent = stats.summary.pending;
    document.getElementById('metricResolved').textContent = stats.summary.resolved;

    // 2. RENDER Dynamic CSS bar chart (category aggregates)
    const chartContainer = document.getElementById('chartCategoryContainer');
    chartContainer.innerHTML = '';

    const maxCount = Math.max(...stats.byCategory.map(item => parseInt(item.cnt, 10)), 1);

    stats.byCategory.forEach(item => {
      const count = parseInt(item.cnt, 10);
      const percent = (count / maxCount) * 100;

      const barRow = document.createElement('div');
      barRow.className = 'chart-bar-item';
      barRow.innerHTML = `
        <div class="chart-bar-header">
          <span class="chart-bar-label">${item.name}</span>
          <span class="chart-bar-val">${count} шт.</span>
        </div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: 0%"></div>
        </div>
      `;
      chartContainer.appendChild(barRow);

      // Smooth fill transition
      setTimeout(() => {
        barRow.querySelector('.chart-bar-fill').style.width = `${percent}%`;
      }, 100);
    });

    if (stats.byCategory.length === 0) {
      chartContainer.innerHTML = '<p class="empty-state-text">Недостаточно данных для построения диаграммы. Создайте несколько заявок.</p>';
    }
  } catch (err) {
    console.error('Ошибка аналитического модуля:', err);
  }
}

// 3. EXPORT CSV / EXCEL DOWNLOAD (ТЗ 4.10)
function handleReportExportSubmit(e) {
  e.preventDefault();
  
  const start_date = document.getElementById('exportStartDate').value;
  const end_date = document.getElementById('exportEndDate').value;
  const category_id = document.getElementById('exportCategory').value;
  const params = new URLSearchParams();
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);
  if (category_id) params.append('category_id', category_id);
  params.append('include_archive', 'true');

  const downloadUrl = `/api/reports/export?${params.toString()}`;

  const fetchOptions = {};
  if (isSimulationMode()) {
    const activeUsername = localStorage.getItem('simulated_kerberos_user') || 'ivanova_ea';
    fetchOptions.headers = { 'X-Remote-User': activeUsername };
  }

  fetch(getAbsoluteUrl(downloadUrl), fetchOptions)
  .then(res => {
    if (!res.ok) throw new Error('Ошибка выгрузки отчета');
    return res.blob();
  })
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `helpdesk_report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Отчет успешно выгружен и сохранен!', 'success');
  })
  .catch(err => showToast('Не удалось загрузить файл отчета', 'error'));
}


// 4. XLSX EXPORT INTEGRATIONS (Dynamic and Screen-based SheetJS exports)

// Universal helper to format Date objects as 'YYYY-MM-DD HH:mm:ss' in user local time
function formatLocalDate(isoStr) {
  if (!isoStr) return '';
  const d = parseDateTime(isoStr);
  if (isNaN(d)) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Universal SheetJS workbook builder with advanced styling (auto column width, wrapped descriptions, vertical-align top)
// Universal ExcelJS workbook builder with advanced styling (auto column width, wrap text, zebra striping, colored priorities/statuses)
async function generateAndSaveXLSX(processedData, filename, sheetName) {
  if (typeof ExcelJS === 'undefined') {
    throw new Error('Библиотека ExcelJS не загружена. Обновите страницу и попробуйте снова.');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }] // Force grid lines to be visible in Excel!
  });

  // Populate data
  processedData.forEach((row, rowIndex) => {
    const r = worksheet.addRow(row);
    
    if (rowIndex === 0) {
      // Style header row
      r.height = 28;
      r.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2F3542' } // Elegant Dark Slate Grey (#2F3542)
        };
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' } // White text
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          right: { style: 'thin', color: { argb: 'FF475569' } }
        };
      });
    } else {
      // Style data rows
      r.height = 20; // Default height
      
      r.eachCell((cell, colIndex) => {
        cell.font = {
          name: 'Calibri',
          size: 10,
          color: { argb: 'FF333333' }
        };
        
        cell.alignment = {
          vertical: 'top',
          horizontal: (colIndex === 1 || colIndex === 8) ? 'center' : 'left', // Center Ticket Number and Status
          wrapText: true
        };
        
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Zebra striping for odd data rows
        if (rowIndex % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' } // Clean light slate tint
          };
        }

        // Highlight priorities
        if (colIndex === 3) { // Column C (Priority)
          const val = String(cell.value || '').trim();
          if (val === 'Критический' || val === 'critical' || val === 'urgent' || val === 'Urgent') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD2D2' } }; // Light Red
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFC0392B' } }; // Dark Red
          } else if (val === 'Высокий' || val === 'high' || val === 'High') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAA7' } }; // Light Orange
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD35400' } }; // Dark Orange
          } else if (val === 'Средний' || val === 'medium' || val === 'Medium') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFF9FB' } }; // Light Blue
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF2980B9' } }; // Dark Blue
          } else if (val === 'Низкий' || val === 'low' || val === 'Low') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3FCEF' } }; // Light Green
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF27AE60' } }; // Dark Green
          }
        }

        // Highlight statuses
        if (colIndex === 8) { // Column H (Status)
          const val = String(cell.value || '').trim();
          if (val === 'Решено' || val === 'resolved') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2FBEB' } }; // Light Emerald
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E7E34' } }; // Dark Emerald
          } else if (val === 'Отклонен' || val === 'rejected') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2F2' } }; // Light Rose
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF9B1C1C' } }; // Dark Rose
          }
        }
      });
    }
  });

  // Set explicit column widths to look extremely tidy
  worksheet.columns.forEach((column, index) => {
    let w = 12;
    if (index === 0) w = 18; // № Заявки
    else if (index === 1) w = 24; // Категория
    else if (index === 2) w = 14; // Приоритет
    else if (index === 3) w = 28; // Инициатор (ФИО)
    else if (index === 4) w = 32; // Контакты инициатора
    else if (index === 5) w = 60; // Описание проблемы
    else if (index === 6) w = 28; // Исполнитель
    else if (index === 7) w = 14; // Статус
    else if (index === 8 || index === 9 || index === 10) w = 20; // Dates
    else if (index === 11) w = 55; // Результат / Обоснование
    column.width = w;
  });

  // Calculate dynamic heights for data rows with multiline descriptions/contacts
  processedData.forEach((row, rowIndex) => {
    if (rowIndex > 0) {
      let maxLines = 1;
      row.forEach((cellValue) => {
        const linesCount = String(cellValue || '').split('\n').length;
        if (linesCount > maxLines) maxLines = linesCount;
      });
      if (maxLines > 1) {
        worksheet.getRow(rowIndex + 1).height = Math.min(maxLines * 14 + 10, 250);
      }
    }
  });

  // Write file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Handler A: Export closed tickets matching the selected period and category on the reports page
async function handleXLSXCustomReportExport() {
  const btn = document.getElementById('btnExportXLSXCustom');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="btn-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px; width: 18px; height: 18px;">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="16" stroke="currentColor" stroke-width="2.5" fill="none"></circle>
      </svg>
      Формирование XLSX...
    `;
  }

  try {
    const rawData = await apiFetch(`/api/reports/closed-tickets-data?include_archive=true`);
    if (!rawData || rawData.length === 0) {
      showToast('Нет закрытых заявок в базе данных.', 'warning');
      return;
    }

    const start_val = document.getElementById('exportStartDate').value;
    const end_val = document.getElementById('exportEndDate').value;
    const category_id = document.getElementById('exportCategory').value;

    const startDate = start_val ? ((start_val.includes('T') || start_val.includes(' ') || start_val.includes(':')) ? new Date(start_val) : new Date(start_val + 'T00:00:00')) : null;
    const endDate = end_val ? ((end_val.includes('T') || end_val.includes(' ') || end_val.includes(':')) ? new Date(end_val) : new Date(end_val + 'T23:59:59')) : null;

    const processedData = [];
    processedData.push([
      '№ Заявки',
      'Категория',
      'Приоритет',
      'Инициатор (ФИО)',
      'Контакты инициатора',
      'Описание проблемы',
      'Исполнитель',
      'Статус',
      'Время открытия',
      'Время взятия в работу',
      'Время закрытия',
      'Результат / Обоснование'
    ]);

    const priorityMap = {
      'low': 'Низкий',
      'medium': 'Средний',
      'high': 'Высокий',
      'urgent': 'Критический'
    };
    const statusMap = {
      'resolved': 'Решено',
      'rejected': 'Отклонен',
      'created': 'Создана',
      'in_progress': 'В работе',
      'pending': 'В ожидании'
    };
    const getRussianPriority = (p) => priorityMap[p] || p || 'Средний';
    const getRussianStatus = (s) => statusMap[s] || s || '';

    rawData.forEach(item => {
      const closeDate = item.closed_at ? new Date(item.closed_at) : null;

      // Apply timezone-aware period filters locally
      if (startDate && (!closeDate || closeDate < startDate)) return;
      if (endDate && (!closeDate || closeDate > endDate)) return;

      // Apply category filter
      if (category_id && item.category_id !== parseInt(category_id, 10)) return;

      // Format initiator contact block with line breaks
      const contactsParts = [];
      if (item.initiator_phone) contactsParts.push(`Тел: ${item.initiator_phone}`);
      if (item.initiator_email) contactsParts.push(`Email: ${item.initiator_email}`);
      if (item.initiator_cabinet) contactsParts.push(`Каб: ${item.initiator_cabinet}`);
      if (item.initiator_department) contactsParts.push(`Отдел: ${item.initiator_department}`);
      if (item.initiator_position) contactsParts.push(`Должн: ${item.initiator_position}`);
      const contactsStr = contactsParts.join('\n');

      processedData.push([
        item.ticket_number || '',
        item.category_name || 'Не указана',
        getRussianPriority(item.priority),
        item.initiator_name || '',
        contactsStr,
        item.description || '',
        item.assignee_name || 'Не назначен',
        getRussianStatus(item.status),
        formatLocalDate(item.created_at),
        formatLocalDate(item.taken_at),
        formatLocalDate(item.closed_at),
        item.resolution || ''
      ]);
    });

    if (processedData.length <= 1) {
      showToast('По выбранным критериям закрытых заявок не найдено.', 'warning');
      return;
    }

    // Sort rows chronologically by closing date (index 10)
    const header = processedData.shift();
    processedData.sort((a, b) => {
      const dateA = a[10] ? new Date(a[10].replace(' ', 'T')) : new Date(0);
      const dateB = b[10] ? new Date(b[10].replace(' ', 'T')) : new Date(0);
      return dateA - dateB;
    });
    processedData.unshift(header);

    const pad = (num) => String(num).padStart(2, '0');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const filename = `closed_tickets_report_${start_val || 'all'}_to_${end_val || todayStr}.xlsx`;

    await generateAndSaveXLSX(processedData, filename, "Закрытые за период");
    showToast(`Готово! Выгружено ${processedData.length - 1} заявок за выбранный период`, 'success');

  } catch (err) {
    console.error('Ошибка экспорта XLSX по фильтрам:', err);
    showToast(err.message || 'Ошибка генерации XLSX', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Handler B: Export exactly the closed tickets currently visible on the active Dashboard table screen
async function handleXLSXActiveTableExport() {
  const btn = document.getElementById('btnExportClosedTabXLSX');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="btn-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 6px; width: 14px; height: 14px;">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="16" stroke="currentColor" stroke-width="2.5" fill="none"></circle>
      </svg>
      Сборка...
    `;
  }

  try {
    const currentClosedTickets = state.tickets.filter(t => t.status === 'resolved' || t.status === 'rejected');
    if (!currentClosedTickets || currentClosedTickets.length === 0) {
      showToast('Нет закрытых заявок на экране для экспорта. Сбросьте или измените фильтры.', 'warning');
      return;
    }

    // Fetch raw detailed history dates (taken_at, closed_at, priority, resolution) matching dashboard archive setting
    const dbIncludeArchive = document.getElementById('dashboardIncludeArchive');
    const includeArchive = dbIncludeArchive ? dbIncludeArchive.checked : false;

    const rawData = await apiFetch(`/api/reports/closed-tickets-data?include_archive=${includeArchive}`);
    if (!rawData || rawData.length === 0) {
      showToast('Не удалось загрузить детальные даты истории выполнения.', 'warning');
      return;
    }

    const detailsMap = {};
    rawData.forEach(item => {
      detailsMap[item.id] = item;
    });

    const processedData = [];
    processedData.push([
      '№ Заявки',
      'Категория',
      'Приоритет',
      'Инициатор (ФИО)',
      'Контакты инициатора',
      'Описание проблемы',
      'Исполнитель',
      'Статус',
      'Время открытия',
      'Время взятия в работу',
      'Время закрытия',
      'Результат / Обоснование'
    ]);

    const priorityMap = {
      'low': 'Низкий',
      'medium': 'Средний',
      'high': 'Высокий',
      'urgent': 'Критический'
    };
    const statusMap = {
      'resolved': 'Решено',
      'rejected': 'Отклонен',
      'created': 'Создана',
      'in_progress': 'В работе',
      'pending': 'В ожидании'
    };
    const getRussianPriority = (p) => priorityMap[p] || p || 'Средний';
    const getRussianStatus = (s) => statusMap[s] || s || '';

    // Populate respecting active filters and custom sorting on screen
    currentClosedTickets.forEach(ticket => {
      const detailed = detailsMap[ticket.id] || {};
      
      const priorityVal = ticket.priority || detailed.priority || 'medium';
      const statusVal = ticket.status || detailed.status || 'resolved';

      // Format initiator contact block
      const contactsParts = [];
      const phone = detailed.initiator_phone || ticket.initiator_phone;
      const email = detailed.initiator_email || ticket.initiator_email;
      const cab = detailed.initiator_cabinet || ticket.initiator_cabinet;
      const dept = detailed.initiator_department || ticket.initiator_department;
      const pos = detailed.initiator_position || ticket.initiator_position;
      
      if (phone) contactsParts.push(`Тел: ${phone}`);
      if (email) contactsParts.push(`Email: ${email}`);
      if (cab) contactsParts.push(`Каб: ${cab}`);
      if (dept) contactsParts.push(`Отдел: ${dept}`);
      if (pos) contactsParts.push(`Должн: ${pos}`);
      const contactsStr = contactsParts.join('\n');

      processedData.push([
        ticket.ticket_number || detailed.ticket_number || '',
        ticket.category_name || detailed.category_name || 'Не указана',
        getRussianPriority(priorityVal),
        ticket.initiator_name || detailed.initiator_name || '',
        contactsStr,
        ticket.description || detailed.description || '',
        ticket.assignee_name || detailed.assignee_name || 'Не назначен',
        getRussianStatus(statusVal),
        formatLocalDate(ticket.created_at || detailed.created_at),
        formatLocalDate(detailed.taken_at),
        formatLocalDate(detailed.closed_at || ticket.updated_at),
        detailed.resolution || ''
      ]);
    });

    const pad = (num) => String(num).padStart(2, '0');
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const filename = `closed_tickets_filtered_${todayStr}.xlsx`;

    await generateAndSaveXLSX(processedData, filename, "Экран закрытых");
    showToast(`Готово! Успешно экспортировано ${processedData.length - 1} заявок с экрана`, 'success');

  } catch (err) {
    console.error('Ошибка экспорта текущих закрытых:', err);
    showToast(err.message || 'Ошибка генерации XLSX', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Preset Fillers
function fillPresetPrevWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const prevMonday = new Date(mondayThisWeek);
  prevMonday.setDate(mondayThisWeek.getDate() - 7);

  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  const pad = (num) => String(num).padStart(2, '0');
  const startStr = `${prevMonday.getFullYear()}-${pad(prevMonday.getMonth() + 1)}-${pad(prevMonday.getDate())}T00:00`;
  const endStr = `${prevSunday.getFullYear()}-${pad(prevSunday.getMonth() + 1)}-${pad(prevSunday.getDate())}T23:59`;

  document.getElementById('exportStartDate').value = startStr;
  document.getElementById('exportEndDate').value = endStr;

  showToast('Выбран период: Прошлая неделя (Пн 00:00 - Вс 23:59)', 'info');
  refreshReportsStats();
}

function fillPresetWorkWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const prevMonday = new Date(mondayThisWeek);
  prevMonday.setDate(mondayThisWeek.getDate() - 7);

  const prevFriday = new Date(mondayThisWeek);
  prevFriday.setDate(mondayThisWeek.getDate() - 3);

  const pad = (num) => String(num).padStart(2, '0');
  const startStr = `${prevMonday.getFullYear()}-${pad(prevMonday.getMonth() + 1)}-${pad(prevMonday.getDate())}T08:00`;
  const endStr = `${prevFriday.getFullYear()}-${pad(prevFriday.getMonth() + 1)}-${pad(prevFriday.getDate())}T20:00`;

  document.getElementById('exportStartDate').value = startStr;
  document.getElementById('exportEndDate').value = endStr;

  showToast('Выбран период: Рабочее время прошлой недели (Пн 08:00 - Пт 20:00)', 'info');
  refreshReportsStats();
}

function fillPresetCurrentMonth() {
  const today = new Date();
  const pad = (num) => String(num).padStart(2, '0');

  const startStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01T00:00`;
  const endStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59`;

  document.getElementById('exportStartDate').value = startStr;
  document.getElementById('exportEndDate').value = endStr;

  showToast('Выбран период: Текущий месяц', 'info');
  refreshReportsStats();
}

function clearExportDates() {
  document.getElementById('exportStartDate').value = '';
  document.getElementById('exportEndDate').value = '';
  showToast('Поля дат очищены', 'info');
  refreshReportsStats();
}


// ================= HELPER UTILITIES ================= //

// Debounce helper to prevent flooding API on fast typing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Notifications handling helpers
function checkNotificationPermission() {
  const card = document.getElementById('notifCard');
  const statePrompt = document.getElementById('notifStatePrompt');
  const stateActive = document.getElementById('notifStateActive');
  const stateBlocked = document.getElementById('notifStateBlocked');

  if (!card) return;

  if ('Notification' in window) {
    card.style.display = 'flex';
    if (Notification.permission === 'granted') {
      statePrompt.style.display = 'none';
      stateActive.style.display = 'flex';
      stateBlocked.style.display = 'none';
    } else if (Notification.permission === 'denied') {
      statePrompt.style.display = 'none';
      stateActive.style.display = 'none';
      stateBlocked.style.display = 'flex';
    } else {
      statePrompt.style.display = 'flex';
      stateActive.style.display = 'none';
      stateBlocked.style.display = 'none';
    }
  } else {
    card.style.display = 'none';
  }
}

function requestNotificationPermission() {
  if ('Notification' in window) {
    try {
      // Поддержка как Promise, так и классических callback-функций
      const handleResult = (permission) => {
        checkNotificationPermission();
        if (permission === 'granted') {
          showToast('Системные уведомления успешно включены!', 'success');
          triggerDesktopNotification('IT Help Desk', 'Браузерные уведомления включены! Теперь вы не пропустите изменения статуса ваших заявок.');
        } else if (permission === 'denied') {
          showToast('Уведомления заблокированы в браузере. Вы будете получать звуковые оповещения и Toast-окна внутри приложения.', 'warning');
        }
      };

      const promise = Notification.requestPermission(handleResult);
      if (promise && typeof promise.then === 'function') {
        promise.then(handleResult);
      }
    } catch (err) {
      console.warn('Notification permission request error:', err);
    }
  }
}

// User Avatar Rendering Helpers
function renderUserAvatarHtml(photoFilename, fullName) {
  if (!fullName) return `<div class="avatar-fallback-initials">?</div>`;
  
  const initials = fullName.split(' ').slice(0, 2).map(n => n.charAt(0)).join('');
  const photoUrl = photoFilename ? getAbsoluteUrl(`/photos/${photoFilename}`) : '';
  
  if (photoUrl) {
    return `
      <div class="user-avatar-container">
        <img class="user-profile-avatar" src="${photoUrl}" alt="${fullName}" onerror="handleAvatarError(this, '${initials}')">
      </div>
    `;
  } else {
    return `<div class="avatar-fallback-initials">${initials}</div>`;
  }
}

window.handleAvatarError = function(imgElement, initials) {
  const container = imgElement.parentElement;
  if (container) {
    container.innerHTML = `<div class="avatar-fallback-initials">${initials}</div>`;
  }
};

function renderUserCellHtml(photoFilename, fullName) {
  if (!fullName) return `<span class="user-cell-name">-</span>`;
  return `
    <div class="user-cell">
      ${renderUserAvatarHtml(photoFilename, fullName)}
      <span class="user-cell-name" title="${fullName}">${fullName}</span>
    </div>
  `;
}

// Global Lightbox Methods for Attachment Fullscreen Preview
window.openLightbox = function(url, filename, size) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImage');
  const nameLabel = document.getElementById('lightboxFilename');
  const sizeLabel = document.getElementById('lightboxFilesize');
  const downloadBtn = document.getElementById('lightboxDownloadBtn');
  
  if (modal && img) {
    img.src = url;
    if (nameLabel) nameLabel.textContent = filename;
    if (sizeLabel) sizeLabel.textContent = `(${size})`;
    if (downloadBtn) {
      downloadBtn.href = url;
      downloadBtn.setAttribute('download', filename);
    }
    modal.classList.add('active');
  }
};

window.closeLightbox = function() {
  const modal = document.getElementById('lightboxModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

// ================= PREMIUM NOTIFICATION CENTER LOGIC =================
function initializeNotificationsCenter() {
  // Load from localStorage
  try {
    const saved = localStorage.getItem('hd_notifications_history');
    state.notificationsHistory = saved ? JSON.parse(saved) : [];
  } catch (err) {
    state.notificationsHistory = [];
  }

  // Update badge count
  updateNotificationsBadge();

  // Wire up tabs
  const tabs = document.querySelectorAll('.btn-notif-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active-notif-tab'));
      tab.classList.add('active-notif-tab');
      state.activeNotifFilter = tab.getAttribute('data-filter');
      renderNotificationsCenter();
    });
  });

  // Wire up action buttons
  const btnMarkAllRead = document.getElementById('btnMarkAllNotifsRead');
  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', () => {
      if (state.notificationsHistory && state.notificationsHistory.length > 0) {
        state.notificationsHistory.forEach(n => n.read = true);
        localStorage.setItem('hd_notifications_history', JSON.stringify(state.notificationsHistory));
        updateNotificationsBadge();
        renderNotificationsCenter();
        showToast('Все уведомления отмечены как прочитанные', 'success');
      }
    });
  }

  const btnClearHistory = document.getElementById('btnClearNotifsHistory');
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      state.notificationsHistory = [];
      localStorage.setItem('hd_notifications_history', JSON.stringify([]));
      updateNotificationsBadge();
      renderNotificationsCenter();
      showToast('История уведомлений очищена', 'info');
    });
  }
}

function updateNotificationsBadge() {
  const badge = document.getElementById('badgeNotifications');
  if (!badge) return;

  const unreadCount = state.notificationsHistory
    ? state.notificationsHistory.filter(n => !n.read).length
    : 0;

  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function addNotificationToHistory(title, body, type, ticketId) {
  if (!state.notificationsHistory) {
    state.notificationsHistory = [];
  }

  const newNotif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title,
    body,
    type, // 'new_ticket', 'comment', 'status_change'
    ticketId,
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toLocaleDateString('ru-RU'),
    read: false
  };

  state.notificationsHistory.unshift(newNotif); // latest first

  // Limit to 200 items to prevent bloating
  if (state.notificationsHistory.length > 200) {
    state.notificationsHistory = state.notificationsHistory.slice(0, 200);
  }

  localStorage.setItem('hd_notifications_history', JSON.stringify(state.notificationsHistory));

  // Update badge count
  updateNotificationsBadge();

  // If currently viewing notifications, re-render
  if (state.currentSection === 'sectionNotifications') {
    renderNotificationsCenter();
  }
}

function renderNotificationsCenter() {
  const container = document.getElementById('notifHistoryList');
  if (!container) return;

  container.innerHTML = '';

  const filter = state.activeNotifFilter || 'all';
  const filtered = state.notificationsHistory
    ? state.notificationsHistory.filter(n => filter === 'all' || n.type === filter)
    : [];

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--text-muted); text-align: center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 16px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span style="font-size: 15px; font-weight: 500;">Уведомлений не найдено</span>
        <p style="font-size: 12px; margin-top: 4px; max-width: 300px; color: var(--text-muted);">В этом разделе будут собираться уведомления о новых событиях и действиях в системе.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(notif => {
    const card = document.createElement('div');
    card.className = `notif-history-card ${notif.read ? '' : 'unread'}`;

    // Map icons and styles based on type
    let iconSvg = '';
    if (notif.type === 'new_ticket') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
    } else if (notif.type === 'comment') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>';
    }

    card.innerHTML = `
      <div class="notif-icon-circle ${notif.type}">
        ${iconSvg}
      </div>
      <div class="notif-body-block">
        <div class="notif-title-row">
          <span class="notif-title-text">${notif.title}</span>
          <span class="notif-time-text">${notif.date} ${notif.time}</span>
        </div>
        <div class="notif-msg-text">${notif.body.replace(/\n/g, '<br>')}</div>
      </div>
      ${notif.read ? '' : '<span class="notif-dot-unread"></span>'}
    `;

    // Click behavior: Open ticket details if ticketId exists, and mark as read!
    card.addEventListener('click', async () => {
      // Mark as read
      if (!notif.read) {
        notif.read = true;
        localStorage.setItem('hd_notifications_history', JSON.stringify(state.notificationsHistory));
        updateNotificationsBadge();
        renderNotificationsCenter();
      }

      if (notif.ticketId) {
        openTicketDetailModal(notif.ticketId);
      }
    });

    // Hover (mouseenter) behavior: Mark as read instantly on hover!
    card.addEventListener('mouseenter', () => {
      if (!notif.read) {
        notif.read = true;
        localStorage.setItem('hd_notifications_history', JSON.stringify(state.notificationsHistory));
        updateNotificationsBadge();
        
        // Dynamic class/DOM update to prevent full list re-render (which would cause hover flicker)
        card.classList.remove('unread');
        const dot = card.querySelector('.notif-dot-unread');
        if (dot) dot.remove();
      }
    });

    container.appendChild(card);
  });
}

// ================= COMMENT ATTACHMENTS HELPERS =================

function addCommentFiles(files) {
  if (!state.commentAttachedFiles) {
    state.commentAttachedFiles = [];
  }
  
  if (state.commentAttachedFiles.length + files.length > 5) {
    showToast('Максимально можно прикрепить 5 файлов к сообщению', 'warning');
    return;
  }

  Array.from(files).forEach(file => {
    if (file.size > 5 * 1024 * 1024) {
      showToast(`Файл ${file.name} слишком большой. Лимит 5 МБ.`, 'warning');
      return;
    }
    state.commentAttachedFiles.push(file);
  });

  renderCommentSelectedFiles();
}

function renderCommentSelectedFiles() {
  const list = document.getElementById('commentFilesList');
  if (!list) return;

  if (!state.commentAttachedFiles || state.commentAttachedFiles.length === 0) {
    list.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  list.style.display = 'flex';
  list.innerHTML = '';

  state.commentAttachedFiles.forEach((file, idx) => {
    const sizeKB = (file.size / 1024).toFixed(1);
    const item = document.createElement('div');
    item.className = 'comment-file-preview-item';
    item.innerHTML = `
      <span class="comment-file-preview-name" title="${file.name}">${file.name}</span>
      <span class="comment-file-preview-size">(${sizeKB} KB)</span>
      <button type="button" class="comment-btn-remove-file" onclick="removeCommentAttachedFile(${idx})">&times;</button>
    `;
    list.appendChild(item);
  });
}

window.removeCommentAttachedFile = function(idx) {
  state.commentAttachedFiles.splice(idx, 1);
  renderCommentSelectedFiles();
};

// ================= INITIATOR TICKET CANCELLATION HELPERS =================

window.openCancelJustificationBox = function() {
  const box = document.getElementById('cancelJustificationBox');
  const btnCancel = document.getElementById('btnActionCancelTicket');
  if (box) box.style.display = 'block';
  if (btnCancel && btnCancel.parentElement) btnCancel.parentElement.style.display = 'none';
};

window.closeCancelJustificationBox = function() {
  const box = document.getElementById('cancelJustificationBox');
  const btnCancel = document.getElementById('btnActionCancelTicket');
  if (box) box.style.display = 'none';
  if (btnCancel && btnCancel.parentElement) btnCancel.parentElement.style.display = 'flex';
  const txt = document.getElementById('cancelJustificationText');
  if (txt) txt.value = '';
};

async function handleCancelTicketSubmit() {
  const text = document.getElementById('cancelJustificationText').value.trim();
  if (!text) {
    showToast('Пожалуйста, укажите причину отмены заявки', 'warning');
    return;
  }

  const ticketId = state.selectedTicket.ticket.id;
  const btnSubmit = document.getElementById('btnSubmitCancelTicket');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Отмена...';

  try {
    await apiFetch(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', details: text })
    });

    showToast('Заявка успешно отменена', 'success');
    window.closeCancelJustificationBox();
    await openTicketDetailModal(ticketId);
    await refreshTicketsList();
  } catch (err) {
    showToast('Не удалось отменить заявку', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Подтвердить отмену';
  }
}


// Client-side handler to delete an attachment from a ticket
window.deleteAttachment = async function(ticketId, attachmentId, btnEl) {
  if (!confirm('Вы действительно хотите удалить этот прикрепленный файл?')) return;
  
  try {
    const res = await fetch(getAbsoluteUrl(`/api/tickets/${ticketId}/attachments/${attachmentId}`), {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Не удалось удалить вложение');
    }
    
    showToast('Вложение успешно удалено', 'success');
    
    // Remove the attachment element from DOM dynamically with fade animation
    const wrapper = btnEl.closest('.attachment-image-wrapper') || btnEl.closest('.attachment-file-pill');
    if (wrapper) {
      wrapper.style.transition = 'all 0.3s ease';
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'scale(0.9)';
      setTimeout(() => {
        wrapper.remove();
        // If no attachments left, hide the box
        const list = document.getElementById('detailAttachmentsList');
        if (list && list.children.length === 0) {
          const box = document.getElementById('detailAttachmentsBox');
          if (box) box.style.display = 'none';
        }
      }, 300);
    }
    
    // Re-fetch ticket details in background to sync history timeline
    if (state.selectedTicket && state.selectedTicket.ticket && state.selectedTicket.ticket.id === ticketId) {
      const modal = document.getElementById('ticketDetailModal');
      if (modal && modal.style.display === 'flex') {
        // Quietly update details to refresh the history feed log
        const detailsRes = await fetch(getAbsoluteUrl(`/api/tickets/${ticketId}`));
        if (detailsRes.ok) {
          const updatedData = await detailsRes.json();
          state.selectedTicket = updatedData;
          if (typeof renderCommentsList === 'function' && updatedData.comments) {
            renderCommentsList(updatedData.comments);
          }
          if (typeof renderHistoryTimeline === 'function' && updatedData.history) {
            renderHistoryTimeline(updatedData.history);
          }
        }
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};
