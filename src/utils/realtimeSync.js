/* ============================================================
   Utility: realtimeSync.js (Client Portal)
   Description: Native Server-Sent Events (SSE) listener for
                instant real-time updates across portals without refresh.
   ============================================================ */

import { getApiUrl } from '../config/apiUrl';
import { invalidateSWRCache } from './swrHelper';

let eventSource = null;
let reconnectTimer = null;

export function initRealtimeSync() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;

  const url = getApiUrl('/api/realtime/stream');

  try {
    eventSource = new EventSource(url);

    eventSource.addEventListener('connected', () => {
      // Handshake connected
    });

    eventSource.addEventListener('DATA_UPDATED', (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleRealtimeUpdate(payload);
      } catch (err) {
        console.warn('[RealtimeSync:Client] Parse error:', err);
      }
    });

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initRealtimeSync();
        }, 5000);
      }
    };
  } catch (err) {
    console.warn('[RealtimeSync:Client] Init error:', err);
  }

  // Cross-tab broadcast channel
  try {
    const bc = new BroadcastChannel('yieldiq_realtime_channel');
    bc.onmessage = (event) => {
      if (event.data && event.data.type === 'DATA_UPDATED') {
        handleRealtimeUpdate(event.data.payload, false);
      }
    };
  } catch {}
}

export function handleRealtimeUpdate(payload, propagate = true) {
  // 1. Invalidate relevant SWR caches in client portal
  invalidateSWRCache('cl_dashboard');
  invalidateSWRCache('cl_portfolio');
  invalidateSWRCache('cl_investment_overview');
  invalidateSWRCache('cl_profile');

  // If local auth client matches updated client, sync totalInvestment and monthlyRoi in auth cache
  try {
    const rawAuth = localStorage.getItem('kfpl_client_auth');
    if (rawAuth) {
      const auth = JSON.parse(rawAuth);
      const user = auth.client || auth.user;
      if (user && (!payload.clientId || user._id === payload.clientId || user.id === payload.clientId)) {
        if (payload.totalInvestment !== undefined) {
          user.totalInvestment = payload.totalInvestment;
        }
        if (payload.monthlyRoi !== undefined) {
          user.monthlyRoi = payload.monthlyRoi;
          user.roiPercentage = payload.monthlyRoi;
        }
        localStorage.setItem('kfpl_client_auth', JSON.stringify(auth));
      }
    }
  } catch (e) {
    console.warn('[RealtimeSync:Client] Auth sync error:', e);
  }

  // 2. Dispatch custom window events so active components re-fetch instantly
  window.dispatchEvent(new CustomEvent('yieldiq_data_updated', { detail: payload }));
  window.dispatchEvent(new CustomEvent('kfpl_approval_event', { detail: payload }));

  // 3. Propagate to sibling tabs
  if (propagate) {
    try {
      const bc = new BroadcastChannel('yieldiq_realtime_channel');
      bc.postMessage({ type: 'DATA_UPDATED', payload });
    } catch {}
  }
}
