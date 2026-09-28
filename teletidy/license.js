/**
 * TeleTidy License Validator & Generator
 * Алгоритм генерации и проверки лицензионных ключей с поддержкой привязки к Telegram ID.
 * Работает полностью автономно (оффлайн), без необходимости внешних баз данных.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const lib = factory();
    root.TeleTidyLicense = lib;
    root.TeleSwipeLicense = lib; // Для обратной совместимости
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const SALT = 'TELETIDY_PRO_2026_SECRET_SEED_v1';

  // Хэширование строки (DJB2 с модификацией)
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  // Генерация случайного 4-значного hex-блока (nonce)
  function randomNonce() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1)
      .toUpperCase();
  }

  // Вычисление контрольного блока на основе соли, ID и nonce
  function computeChecksum(idPart, nonce) {
    const raw = `${SALT}:${idPart}-${nonce}`;
    const h = hashString(raw);
    return h.substring(0, 4); // первые 4 символа хэша
  }

  // Константы официального лимита для контроля целостности
  const OFFICIAL_FREE_LIMIT = 100;
  const OFFICIAL_LIMIT_HASH = '9432EFD0'; // hashString('OFFICIAL_LIMIT_100:' + SALT)

  // Вычисление контрольной суммы лимита
  function computeLimitHash(val) {
    return hashString(`OFFICIAL_LIMIT_${val}:${SALT}`);
  }

  // Вычисление цифровой подписи состояния хранилища
  function computeStateSignature(swiped, deleted, kept, tgId) {
    const idStr = tgId ? String(tgId).trim() : 'ANON';
    return hashString(`STATE:${swiped}:${deleted}:${kept}:${idStr}:${SALT}`);
  }

  return {
    /**
     * Проверка целостности системного лимита (защита от редактирования в исходном коде)
     * @param {number} candidateLimit
     * @returns {{ valid: boolean, limit: number, reason?: string }}
     */
    verifyLimitIntegrity: function (candidateLimit) {
      if (typeof candidateLimit !== 'number' || candidateLimit !== OFFICIAL_FREE_LIMIT) {
        return {
          valid: false,
          limit: 0,
          reason: 'LIMIT_VALUE_MISMATCH'
        };
      }
      const computed = computeLimitHash(candidateLimit);
      if (computed !== OFFICIAL_LIMIT_HASH) {
        return {
          valid: false,
          limit: 0,
          reason: 'LIMIT_CHECKSUM_FAILED'
        };
      }
      return {
        valid: true,
        limit: OFFICIAL_FREE_LIMIT
      };
    },

    /**
     * Создание криптографической подписи для состояния локального хранилища
     */
    computeStateSignature: function (swiped, deleted, kept, tgId) {
      return computeStateSignature(swiped || 0, deleted || 0, kept || 0, tgId);
    },

    /**
     * Проверка подлинности состояния локального хранилища (защита от сброса счетчиков в DevTools)
     */
    verifyStateSignature: function (swiped, deleted, kept, tgId, signature) {
      const s = swiped || 0;
      const d = deleted || 0;
      const k = kept || 0;
      // Новый пользователь без сохраненной сессии
      if (s === 0 && d === 0 && k === 0 && !signature) {
        return true;
      }
      if (!signature) return false;
      const expected = computeStateSignature(s, d, k, tgId);
      const expectedAnon = computeStateSignature(s, d, k, null);
      return signature === expected || signature === expectedAnon;
    },

    /**
     * Строгая проверка PRO-статуса (исключает подделку флага isPro в storage без ключа)
     */
    isProStrict: function (licenseKey, currentTgId) {
      if (!licenseKey || typeof licenseKey !== 'string') return false;
      const res = this.checkKey(licenseKey, currentTgId);
      return res.valid === true;
    },
    /**
     * Генерирует лицензионный ключ
     * @param {string|number} [tgId] - Telegram User ID покупателя для персональной привязки
     * @returns {string} Формат: TIDY-<TG_ID>-<NONCE>-<CHECKSUM> или TIDY-ALL-<NONCE>-<CHECKSUM>
     */
    generateKey: function (tgId) {
      const nonce = randomNonce();
      const idPart = (tgId !== undefined && tgId !== null && String(tgId).trim() !== '')
        ? String(tgId).trim()
        : 'ALL';
      const checksum = computeChecksum(idPart, nonce);
      return `TIDY-${idPart}-${nonce}-${checksum}`;
    },

    /**
     * Подробная проверка лицензионного ключа
     * @param {string} key
     * @param {string|number} [currentTgId] - Текущий Telegram ID в открытом Telegram Web
     * @returns {{ valid: boolean, reason: string, type?: string, boundId?: string, currentId?: string }}
     */
    checkKey: function (key, currentTgId) {
      if (!key || typeof key !== 'string') {
        return { valid: false, reason: 'EMPTY' };
      }

      const clean = key.trim().toUpperCase();
      const parts = clean.split('-');

      if (parts.length !== 4) {
        return { valid: false, reason: 'FORMAT' };
      }

      const [prefix, idPart, nonce, checksum] = parts;

      if (prefix !== 'TIDY' && prefix !== 'SWIPE') {
        return { valid: false, reason: 'INVALID_PREFIX' };
      }

      // Проверка математической контрольной суммы
      const expectedChecksum = computeChecksum(idPart, nonce);
      if (checksum !== expectedChecksum) {
        return { valid: false, reason: 'INVALID_CHECKSUM' };
      }

      // Универсальный мастер-ключ разработчика (ALL или legacy 4-значный hex)
      if (idPart === 'ALL' || (idPart.length === 4 && /^[0-9A-F]{4}$/.test(idPart))) {
        return { valid: true, reason: 'OK', type: 'UNIVERSAL' };
      }

      // Персональный ключ с привязкой к Telegram ID
      const curIdStr = (currentTgId !== undefined && currentTgId !== null) ? String(currentTgId).trim() : null;

      if (curIdStr && curIdStr !== idPart) {
        return {
          valid: false,
          reason: 'ID_MISMATCH',
          boundId: idPart,
          currentId: curIdStr
        };
      }

      return {
        valid: true,
        reason: 'OK',
        type: 'PERSONAL',
        boundId: idPart
      };
    },

    /**
     * Быстрая булева проверка (для обратной совместимости)
     * @param {string} key
     * @param {string|number} [currentTgId]
     * @returns {boolean}
     */
    validateKey: function (key, currentTgId) {
      const res = this.checkKey(key, currentTgId);
      return res.valid === true;
    }
  };
});
