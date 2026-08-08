/* ============================================================
   Config: apiHelper.js
   Description: Reusable authenticated API request helper for client portal.
                Automatically attaches JWT token from localStorage
                and handles common error responses.
   ============================================================ */

import { getApiUrl } from './apiUrl';

/**
 * Make an authenticated API request.
 * @param {string} path - API path (e.g., '/api/client/dashboard')
 * @param {object} options - fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} Parsed JSON response
 */
export async function apiRequest(path, options = {}) {
  const authData = localStorage.getItem('kfpl_client_auth');
  let token = '';
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      token = parsed.token || '';
    } catch (e) {
      console.error('Failed to parse client auth data:', e);
    }
  }

  const url = getApiUrl(path);

  const headers = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  // Automatically stringify object body payloads and set JSON content type
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (parseErr) {
    console.error('Failed to parse response JSON:', parseErr, 'Raw text:', text);
    const errorMessage = text || `Request failed with status ${response.status}`;
    const err = new Error(errorMessage);
    err.status = response.status;
    err.data = text;
    throw err;
  }

  if (!response.ok) {
    if (response.status === 401 && !window.location.pathname.includes('/login')) {
      try {
        localStorage.removeItem('kfpl_client_auth');
      } catch (_) {}
      window.location.href = '/login';
    }
    const errorMessage = data.message || data.error || `Request failed with status ${response.status}`;
    const err = new Error(errorMessage);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Safely set item in localStorage.
 * If QuotaExceededError occurs, automatically clears old non-essential caches
 * and strips heavy Base64 profilePic before retrying.
 */
export function safeSetLocalStorage(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    localStorage.setItem(key, str);
  } catch (e) {
    console.warn(`QuotaExceededError on setting ${key}, clearing old non-essential caches...`, e);
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('_cache') || k.includes('_detail_') || k.includes('_list') || k.includes('_session_') || k.includes('_history'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      let finalStr = str;
      if (typeof value === 'object' && value !== null) {
        const copy = JSON.parse(JSON.stringify(value));
        const sanitizeObj = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          for (const prop in obj) {
            if (prop === 'profilePic' && typeof obj[prop] === 'string' && obj[prop].length > 2000) {
              delete obj[prop];
            } else if (typeof obj[prop] === 'object') {
              sanitizeObj(obj[prop]);
            }
          }
        };
        sanitizeObj(copy);
        finalStr = JSON.stringify(copy);
      }

      localStorage.setItem(key, finalStr);
    } catch (err2) {
      console.error(`Fatal localStorage write error for ${key}:`, err2);
    }
  }
}
