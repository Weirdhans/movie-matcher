// ============================================
// UTILITY FUNCTIES
// ============================================

/**
 * Genereer of haal bestaande gebruiker ID op uit localStorage
 * @returns {string} Unieke gebruiker ID (UUID)
 */
export function getUserId() {
  try {
    // Probeer ID uit localStorage te halen
    let userId = localStorage.getItem('movieMatcherUserId');

    if (!userId) {
      // Genereer nieuwe UUID als er nog geen bestaat
      userId = generateUUID();
      localStorage.setItem('movieMatcherUserId', userId);
      console.log('✅ Nieuwe gebruiker ID aangemaakt:', userId);
    } else {
      console.log('✅ Bestaande gebruiker ID geladen:', userId);
    }

    return userId;
  } catch (error) {
    // Fallback voor incognito mode of als localStorage niet werkt
    console.warn('⚠️ localStorage niet beschikbaar, gebruik tijdelijke ID');

    if (!window._tempUserId) {
      window._tempUserId = generateUUID();
    }

    return window._tempUserId;
  }
}

/**
 * Genereer een eenvoudige UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
  // Gebruik crypto.randomUUID als beschikbaar (moderne browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback voor oudere browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Haal session ID uit URL query parameters
 * @returns {string|null} Session ID of null als niet aanwezig
 */
export function getSessionIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('session');
}

/**
 * Update URL met session ID zonder pagina refresh
 * @param {string} sessionId - Session ID om toe te voegen aan URL
 */
export function updateUrlWithSession(sessionId) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.pushState({}, '', url);
}

/**
 * Genereer deelbare link voor sessie
 * @param {string} sessionId - Session ID
 * @returns {string} Volledige URL om te delen
 */
export function generateShareLink(sessionId) {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?session=${sessionId}`;
}

/**
 * Kopieer tekst naar clipboard
 * @param {string} text - Tekst om te kopiëren
 * @returns {Promise<boolean>} True als succesvol, false bij fout
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('❌ Clipboard error:', error);

    // Fallback voor oudere browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (fallbackError) {
      console.error('❌ Fallback clipboard error:', fallbackError);
      return false;
    }
  }
}

/**
 * Formatteer datum naar leesbare string
 * @param {string|Date} date - Datum om te formatteren
 * @returns {string} Geformatteerde datum (bijv. "5 minuten geleden")
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Zojuist';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minuut' : 'minuten'} geleden`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'uur' : 'uur'} geleden`;
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'dag' : 'dagen'} geleden`;

  return past.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formatteer rating naar sterren visualisatie
 * @param {number} rating - Rating van 0-10
 * @returns {string} Sterren string (bijv. "★★★★☆")
 */
export function formatRatingStars(rating) {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 >= 1;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return '★'.repeat(fullStars) +
         (halfStar ? '½' : '') +
         '☆'.repeat(emptyStars);
}

/**
 * Truncate tekst tot maximaal aantal karakters
 * @param {string} text - Tekst om in te korten
 * @param {number} maxLength - Maximum aantal karakters
 * @returns {string} Ingekorte tekst met "..." indien nodig
 */
export function truncateText(text, maxLength = 150) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Debounce functie om te voorkomen dat functies te vaak worden aangeroepen
 * @param {Function} func - Functie om te debounce
 * @param {number} wait - Wachttijd in milliseconden
 * @returns {Function} Gedebouncede functie
 */
export function debounce(func, wait = 300) {
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

/**
 * Controleer of gebruiker online is
 * @returns {boolean} True als online, false als offline
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Show toast notificatie (vereist Alpine.js store)
 * @param {string} message - Bericht om te tonen
 * @param {string} type - Type: 'success', 'error', 'info'
 * @param {number} duration - Duur in milliseconden
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Deze functie werkt samen met Alpine.js toast component
  // Wordt geïmplementeerd in app.js
  if (window.Alpine && window.Alpine.store('toast')) {
    window.Alpine.store('toast').show(message, type, duration);
  } else {
    // Fallback naar console als Alpine.js nog niet geladen is
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Valideer of een string een geldige UUID is
 * @param {string} str - String om te valideren
 * @returns {boolean} True als geldige UUID
 */
export function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Log functie met timestamp voor debugging
 * @param {...any} args - Argumenten om te loggen
 */
export function log(...args) {
  const timestamp = new Date().toLocaleTimeString('nl-NL');
  console.log(`[${timestamp}]`, ...args);
}

/**
 * Sleep functie voor delays
 * @param {number} ms - Aantal milliseconden om te wachten
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
