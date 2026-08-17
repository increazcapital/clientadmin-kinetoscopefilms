/* ============================================================
   Component: Sidebar.jsx
   Description: Dark forest green sidebar with client portal navigation
   ============================================================ */

import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getApiUrl } from '../../config/apiUrl';

// ── SVG Icons ───────────────────────
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  investment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  portfolio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  perks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  requests: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

// ── Navigation Structure ───────────────────────
const navSections = [
  {
    title: 'Overview',
    items: [
      { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    title: 'Investments',
    items: [
      { path: '/investment', icon: 'investment', label: 'Your Investment' },
      { path: '/complete-transaction-details', icon: 'investment', label: 'Complete Transaction Details' },
      { path: '/portfolio', icon: 'portfolio', label: 'Kinetoscope Portfolio' },
      { path: '/projects', icon: 'projects', label: 'Project Selection' },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/perks', icon: 'perks', label: 'Perks & Recognition' },
      { path: '/payments', icon: 'payments', label: 'Payments' },
      { path: '/service-requests', icon: 'requests', label: 'Service Requests' },
    ],
  },
  {
    title: 'More',
    items: [
      { path: '/media', icon: 'media', label: 'Media & News' },
      { path: '/faq', icon: 'support', label: 'FAQ' },
      { path: '/profile', icon: 'profile', label: 'My Profile' },
    ],
  },
];

export default function Sidebar({ isCollapsed, onToggle, isMobileOpen, onMobileClose }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // ── Tooltip state for collapsed sidebar (renders outside scrolling container) ──
  const [tooltip, setTooltip] = useState({ visible: false, text: '', top: 0, left: 0 });

  const handleTooltipEnter = useCallback((e) => {
    if (!isCollapsed) return;
    const el = e.currentTarget;
    const label = el.getAttribute('data-tooltip');
    if (!label) return;
    const rect = el.getBoundingClientRect();
    setTooltip({
      visible: true,
      text: label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }, [isCollapsed]);

  const handleTooltipLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  const handleLogout = async () => {
    const authData = localStorage.getItem('kfpl_client_auth');
    const token = authData ? JSON.parse(authData)?.token : null;
    if (token) {
      try {
        await fetch(getApiUrl('/api/client/auth/logout'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to log out from server', err);
      }
    }
    // Nuclear wipe all SWR cached data (user-scoped)
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('swr_')) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
    localStorage.removeItem('kfpl_client_auth');
    localStorage.removeItem('kfpl_client_dashboard_cache');
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`kfpl-sidebar-overlay ${isMobileOpen ? 'visible' : ''}`}
        onClick={onMobileClose}
      />

      <aside className={`kfpl-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="kfpl-sidebar-logo">
          <div className="kfpl-sidebar-logo-icon" style={{ background: '#f8fafc', padding: '3px', width: '40px', height: '40px', minWidth: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', flexShrink: 0 }}>
            <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', borderRadius: '7px', objectFit: 'contain', display: 'block' }} />
          </div>
          <div className="kfpl-sidebar-logo-text" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div className="kfpl-sidebar-marquee-wrapper">
              <div className="kfpl-sidebar-marquee-track">
                <span>KINETOSCOPE FILMS PVT LTD &nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;</span>
                <span>KINETOSCOPE FILMS PVT LTD &nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;</span>
              </div>
            </div>
            <span className="kfpl-sidebar-logo-tagline" style={{ fontSize: '9px', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '1px', display: 'block', fontWeight: '700' }}>A Global Media Fund</span>
            <span className="kfpl-sidebar-logo-subtitle">INVESTOR DASHBOARD</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="kfpl-sidebar-nav">
          {navSections.map((section) => (
            <div className="kfpl-sidebar-section" key={section.title}>
              <div className="kfpl-sidebar-section-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`kfpl-sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={onMobileClose}
                  data-tooltip={item.label}
                  onMouseEnter={handleTooltipEnter}
                  onMouseLeave={handleTooltipLeave}
                >
                  <span className="kfpl-sidebar-item-icon">{icons[item.icon]}</span>
                  <span className="kfpl-sidebar-item-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Section: Logout + Collapse */}
        <div className="kfpl-sidebar-bottom">
          <div className="kfpl-sidebar-item kfpl-sidebar-logout" onClick={handleLogout} data-tooltip="Logout" onMouseEnter={handleTooltipEnter} onMouseLeave={handleTooltipLeave}>
            <span className="kfpl-sidebar-item-icon">{icons.logout}</span>
            <span className="kfpl-sidebar-item-label">Logout</span>
          </div>
          <div className="kfpl-sidebar-toggle" onClick={onToggle} data-tooltip={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} onMouseEnter={handleTooltipEnter} onMouseLeave={handleTooltipLeave}>
            {icons.chevronLeft}
          </div>
        </div>
      </aside>

      {/* Fixed-position tooltip rendered outside sidebar scroll container */}
      {isCollapsed && tooltip.visible && (
        <div
          className="kfpl-sidebar-tooltip-fixed"
          style={{
            position: 'fixed',
            top: tooltip.top,
            left: tooltip.left,
            transform: 'translateY(-50%)',
            background: '#FFFFFF',
            color: '#10B981',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.18)',
            zIndex: 99999999,
            pointerEvents: 'none',
            letterSpacing: '0.3px',
            fontFamily: 'var(--font-family, Inter, sans-serif)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}

/* ============ END: Sidebar.jsx ============ */
