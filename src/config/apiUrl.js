/* ============================================================
   Config: apiUrl.js
   Description: Dynamic API URL helper for Dev (relative proxy)
                and Production (absolute Vercel URL)
   ============================================================ */

export const getApiUrl = (path) => {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.');

  // In local dev, Vite proxy handles routing to the correct backend
  // In production, use the cloud backend URL directly
  const baseUrl = isLocal ? '' : (import.meta.env.VITE_API_URL_CLOUD || 'https://server.kinetoscopefilms.com');
  return `${baseUrl}${path}`;
};

/* ============ END: apiUrl.js ============ */
