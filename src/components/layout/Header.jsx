/* ============================================================
   Component: Header.jsx
   Description: Top bar with breadcrumb, interactive notifications, client profile
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../config/apiHelper';

// ── Route to Title & Breadcrumb Map ───────────────────────
const routeConfig = {
  '/dashboard': { title: 'Dashboard', breadcrumb: 'Overview' },
  '/investment': { title: 'Your Investment', breadcrumb: 'Investments' },
  '/complete-transaction-details': { title: 'Complete Transaction Details', breadcrumb: 'Investments' },
  '/portfolio': { title: 'Kinetoscope Portfolio', breadcrumb: 'Investments' },
  '/projects': { title: 'Project Selection', breadcrumb: 'Investments' },
  '/perks': { title: 'Perks & Recognition', breadcrumb: 'Account' },
  '/payments': { title: 'Payments', breadcrumb: 'Account' },
  '/service-requests': { title: 'Service Requests', breadcrumb: 'Account' },
  '/service-requests/new': { title: 'New Service Request', breadcrumb: 'Account / Service Requests' },
  '/profile': { title: 'My Profile', breadcrumb: 'Account' },
  '/media': { title: 'Media & News', breadcrumb: 'More' },
  '/onboarding/details': { title: 'Complete Your Profile', breadcrumb: 'Onboarding' },
};

function getPageConfig(pathname) {
  if (routeConfig[pathname]) return routeConfig[pathname];
  if (pathname.match(/^\/service-requests\/.+/)) return { title: 'Request Details', breadcrumb: 'Account / Service Requests' };
  return { title: 'Client Portal', breadcrumb: '' };
}

export default function Header({ isCollapsed, onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = getPageConfig(location.pathname);

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  // Read logged-in client info from localStorage (pure, no setState)
  const readClientInfo = () => {
    let info = null;
    let profilePic = '';

    try {
      const authData = localStorage.getItem('kfpl_client_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        const root = parsed?.client || parsed;
        info = root?.client || root?.data || root?.user || root;
        if (info && info.profilePic !== undefined) {
          profilePic = info.profilePic || '';
        }
      }

      const cacheData = localStorage.getItem('kfpl_client_dashboard_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        if (parsed?.client) {
          if (parsed.client.profilePic !== undefined) {
            profilePic = parsed.client.profilePic || '';
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse client info in Header', e);
    }

    return { info, profilePic };
  };

  const [clientInfo, setClientInfo] = useState(() => readClientInfo().info);
  const [clientPic, setClientPic] = useState(() => readClientInfo().profilePic);
  const clientName = clientInfo?.name || 'Investor';
  const clientEmail = clientInfo?.email || 'investor@kfpl.com';

  useEffect(() => {
    const handleProfileUpdate = () => {
      const { info, profilePic } = readClientInfo();
      setClientInfo(info);
      setClientPic(profilePic);
    };
    window.addEventListener('clientProfileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('clientProfileUpdated', handleProfileUpdate);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest('/api/client/notifications');
      if (res && (res.notifications || res.data || Array.isArray(res))) {
        const list = res.notifications || res.data || (Array.isArray(res) ? res : []);

        let readIds = [];
        let clearedIds = [];
        let lastReadTime = 0;
        try {
          const storedIds = localStorage.getItem('kfpl_client_read_notifs');
          readIds = storedIds ? JSON.parse(storedIds) : [];
          const storedCleared = localStorage.getItem('kfpl_client_cleared_notifs');
          clearedIds = storedCleared ? JSON.parse(storedCleared) : [];
          const storedTime = localStorage.getItem('kfpl_client_notifs_last_read');
          lastReadTime = storedTime ? parseInt(storedTime, 10) : 0;
        } catch (e) {}

        const activeList = list.filter((n) => !clearedIds.includes(n.id));

        const formatted = activeList.map((n) => {
          const nTime = n.date ? new Date(n.date).getTime() : 0;
          const isRead = readIds.includes(n.id) || (lastReadTime > 0 && nTime <= lastReadTime);
          return {
            ...n,
            isRead: !!isRead,
          };
        });

        setNotifications(formatted);
        const unreadNum = formatted.filter((n) => !n.isRead).length;
        setUnreadCount(unreadNum);
      }
    } catch (err) {
      console.warn('Failed to fetch client notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 3000);

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('focus', fetchNotifications);
    window.addEventListener('clientNotificationsUpdated', fetchNotifications);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('focus', fetchNotifications);
      window.removeEventListener('clientNotificationsUpdated', fetchNotifications);
    };
  }, []);

  const clearAllNotifications = () => {
    try {
      const allIds = notifications.map((n) => n.id);
      let clearedIds = [];
      try {
        const stored = localStorage.getItem('kfpl_client_cleared_notifs');
        clearedIds = stored ? JSON.parse(stored) : [];
      } catch (e) {}
      const updatedCleared = Array.from(new Set([...clearedIds, ...allIds]));
      localStorage.setItem('kfpl_client_cleared_notifs', JSON.stringify(updatedCleared));
    } catch (e) {}
    setNotifications([]);
    setUnreadCount(0);
  };

  const markAllAsRead = () => {
    const now = Date.now();
    try {
      const allIds = notifications.map((n) => n.id);
      localStorage.setItem('kfpl_client_read_notifs', JSON.stringify(allIds));
      localStorage.setItem('kfpl_client_notifs_last_read', now.toString());
    } catch (e) {}
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const markSingleAsRead = (id) => {
    let readIds = [];
    try {
      const stored = localStorage.getItem('kfpl_client_read_notifs');
      readIds = stored ? JSON.parse(stored) : [];
    } catch (e) {}

    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('kfpl_client_read_notifs', JSON.stringify(readIds));
    }

    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      const unreadNum = updated.filter((n) => !n.isRead).length;
      setUnreadCount(unreadNum);
      return updated;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('kfpl_client_auth');
    localStorage.removeItem('kfpl_client_dashboard_cache');
    window.location.href = '/login';
  };

  return (
    <header className={`kfpl-header ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <style>{`
        .kfpl-notif-dropdown-card {
          position: absolute;
          top: 50px;
          right: 0;
          width: 360px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.15);
          border: 1px solid #e2e8f0;
          z-index: 1000;
          animation: slideDownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .kfpl-notif-dropdown-header {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kfpl-notif-dropdown-title {
          font-weight: 700;
          font-size: 0.875rem;
          color: #0f172a;
        }

        .kfpl-notif-dropdown-body {
          max-height: 320px;
          overflow-y: auto;
        }

        .kfpl-notif-item {
          padding: 12px 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          cursor: pointer;
          transition: background 0.15s ease;
          border-bottom: 1px solid #f1f5f9;
        }

        .kfpl-notif-item:hover {
          background: #f8fafc;
        }

        .kfpl-notif-item:last-child {
          border-bottom: none;
        }

        @keyframes slideDownIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="kfpl-header-left">
        <button className="kfpl-header-hamburger" onClick={onMenuClick} aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="kfpl-header-title-wrap">
          <h1 className="kfpl-header-title">{config.title}</h1>
          {config.breadcrumb && (
            <div className="kfpl-header-breadcrumb">
              <span>Home</span> / {config.breadcrumb}
            </div>
          )}
        </div>
      </div>

      <div className="kfpl-header-right">
        {/* Notifications Dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button 
            className="kfpl-header-icon-btn" 
            aria-label="Notifications"
            onClick={() => {
              setShowNotifDropdown(!showNotifDropdown);
              setShowDropdown(false);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="kfpl-header-notification-dot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 800, color: '#fff', background: '#e11d48', width: '16px', height: '16px', top: '-2px', right: '-2px', borderRadius: '50%', position: 'absolute' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="kfpl-notif-dropdown-card">
              <div className="kfpl-notif-dropdown-header">
                <span className="kfpl-notif-dropdown-title">Client Notifications</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {notifications.some((n) => !n.isRead) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.725rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <>
                      {notifications.some((n) => !n.isRead) && <span style={{ color: '#cbd5e1' }}>|</span>}
                      <button 
                        onClick={(e) => { e.stopPropagation(); clearAllNotifications(); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.725rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Clear all
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="kfpl-notif-dropdown-body">
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.825rem' }}>
                    No recent notifications found.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id}
                      className="kfpl-notif-item"
                      style={{ background: n.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.04)' }}
                      onClick={() => {
                        markSingleAsRead(n.id);
                        if (n.link) navigate(n.link);
                        setShowNotifDropdown(false);
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: n.category === 'danger' ? '#fef2f2' : n.category === 'success' ? '#ecfdf5' : '#eff6ff',
                        color: n.category === 'danger' ? '#ef4444' : n.category === 'success' ? '#10b981' : '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.875rem', fontWeight: 800, flexShrink: 0
                      }}>
                        {n.type === 'transaction' ? '₹' : n.type === 'roi' ? 'ROI' : 'N'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.825rem', color: '#0f172a', fontWeight: 700 }}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span style={{ fontSize: '0.625rem', background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>New</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>{n.message}</span>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                          {new Date(n.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="kfpl-header-divider"></div>

        {/* Client Profile with Dropdown */}
        <div className="kfpl-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
          <div className="kfpl-header-profile" onClick={() => setShowDropdown(!showDropdown)}>
            <div className="kfpl-header-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {clientPic ? (
                <img src={clientPic} alt={clientName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="kfpl-header-profile-info">
              <span className="kfpl-header-profile-name">{clientName}</span>
              <span className="kfpl-header-profile-role">Investor</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"
              style={{ color: 'var(--color-text-muted)', transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {showDropdown && (
            <div className="kfpl-header-profile-dropdown">
              <div className="kfpl-dropdown-profile-header">
                <span className="kfpl-dropdown-profile-name">{clientName}</span>
                <span className="kfpl-dropdown-profile-email">{clientEmail}</span>
              </div>
              <div className="kfpl-dropdown-divider"></div>
              <div className="kfpl-dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile'); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                My Profile
              </div>
              <div className="kfpl-dropdown-item kfpl-dropdown-logout-btn" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ============ END: Header.jsx ============ */
