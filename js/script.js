document.addEventListener('DOMContentLoaded', function () {
    // Accordion functionality
    const accordions = document.querySelectorAll('.accordion');

    accordions.forEach(accordion => {
        const header = accordion.querySelector('.accordion-header');
        const content = accordion.querySelector('.accordion-content');
        const icon = header.querySelector('.accordion-icon');

        if (header && content && icon) {
            header.addEventListener('click', () => {
                const isOpen = content.style.display === 'block';
                content.style.display = isOpen ? 'none' : 'block';
                icon.textContent = isOpen ? '+' : '-';
                if (icon.style.transform === 'rotate(45deg)') {
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    icon.style.transform = 'rotate(45deg)';
                }
            });
        }
    });

    // Preview toggle functionality (existing)
    const toggleButtons = document.querySelectorAll('.preview-toggle');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetId = this.dataset.previewTarget;
            const targetContent = document.getElementById(targetId);

            if (targetContent) {
                if (targetContent.style.display === 'none' || targetContent.style.display === '') {
                    targetContent.style.display = 'block';
                    this.textContent = 'Скрыть превью';
                } else {
                    targetContent.style.display = 'none';
                    this.textContent = 'Показать превью';
                }
            }
        });
    });

    // Theme switching code (existing, if any - assuming it might not be present based on previous file)
    // If theme switcher exists in your HTML with id 'theme-switcher'
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
        const currentTheme = localStorage.getItem('theme') || 'dark';

        if (currentTheme === 'light') {
            document.body.classList.add('light-theme');
        }

        themeSwitcher.addEventListener('click', function () {
            document.body.classList.toggle('light-theme');
            const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
        });
    }
});
