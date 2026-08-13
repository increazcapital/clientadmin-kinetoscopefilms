/* ============================================================
   Page: ServiceRequests.jsx
   Description: List of client's service requests with status
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../config/apiHelper';

/* Status config */
const getStatusStyle = (statusStr) => {
  const status = (statusStr || 'OPEN').toUpperCase();
  if (status === 'IN PROGRESS') {
    return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', text: 'In Progress' };
  } else if (status === 'RESOLVED') {
    return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)', text: 'Resolved' };
  } else if (status === 'CLOSED') {
    return { color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)', text: 'Closed' };
  }
  return { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'Open' };
};

export default function ServiceRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seqMap, setSeqMap] = useState({});

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/client/service-requests');
      console.log('Client Service Requests Raw Data:', data);

      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data) {
        if (data.requests && Array.isArray(data.requests)) {
          list = data.requests;
        } else if (data.serviceRequests && Array.isArray(data.serviceRequests)) {
          list = data.serviceRequests;
        } else if (data.data) {
          if (Array.isArray(data.data)) {
            list = data.data;
          } else if (data.data.requests && Array.isArray(data.data.requests)) {
            list = data.data.requests;
          } else if (data.data.serviceRequests && Array.isArray(data.data.serviceRequests)) {
            list = data.data.serviceRequests;
          }
        }
      }

      // Sort chronologically (oldest first) to assign stable sequence numbers starting from SR-101
      const sorted = [...list].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.date || 0);
        const dateB = new Date(b.createdAt || b.date || 0);
        return dateA - dateB;
      });

      const newSeqMap = {};
      sorted.forEach((req, idx) => {
        const key = req._id || req.id;
        if (key) {
          newSeqMap[key] = `SR-${101 + idx}`;
        }
      });
      setSeqMap(newSeqMap);

      setRequests(list);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
      setError('Failed to load service requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openCount = requests.filter(r => (r.status || '').toUpperCase() === 'OPEN').length;
  const progressCount = requests.filter(r => (r.status || '').toUpperCase() === 'IN PROGRESS').length;
  const resolvedCount = requests.filter(r => {
    const s = (r.status || '').toUpperCase();
    return s === 'RESOLVED' || s === 'CLOSED';
  }).length;

  return (
    <div className="kfpl-page animate-fade-slide-up" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <div className="kfpl-card-header-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0, letterSpacing: '-0.5px' }}>
            Support Tickets
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            View progress and raise service inquiries to our administrator helpdesk.
          </p>
        </div>
        <button 
          onClick={() => navigate('/service-requests/new')}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--color-navy)', 
            color: '#fff', 
            border: 'none', 
            padding: '12px 22px', 
            borderRadius: '8px', 
            fontWeight: 700, 
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10, 25, 47, 0.15)',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Request
        </button>
      </div>

      {/* ── Status Count Cards ─────────────────────── */}
      <div className="kfpl-sr-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Open Tickets</span>
            <strong style={{ fontSize: '1.5rem', color: 'var(--color-navy)', fontWeight: 800 }}>{openCount}</strong>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>In Progress</span>
            <strong style={{ fontSize: '1.5rem', color: 'var(--color-navy)', fontWeight: 800 }}>{progressCount}</strong>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Resolved / Closed</span>
            <strong style={{ fontSize: '1.5rem', color: 'var(--color-navy)', fontWeight: 800 }}>{resolvedCount}</strong>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
          Loading service requests...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-danger)', fontWeight: 600 }}>
          {error}
        </div>
      ) : (
        <>
          {/* ── Request List ─────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {requests.map((req, i) => {
              const st = getStatusStyle(req.status);
              const displayId = seqMap[req._id || req.id] || req.id || (req._id ? 'SR-' + req._id.substring(req._id.length - 6).toUpperCase() : 'N/A');
              return (
                <div 
                  key={req._id || req.id} 
                  className="kfpl-sr-ticket-card"
                  onClick={() => navigate(`/service-requests/${req._id || req.id}`)}
                >
                  <div className="kfpl-sr-ticket-header">
                    <div className="kfpl-sr-ticket-id-wrap">
                      <span className="kfpl-sr-ticket-bar" style={{ background: st.color }} />
                      <span className="kfpl-sr-ticket-id">{displayId}</span>
                      <span className="kfpl-sr-ticket-cat">{req.category}</span>
                    </div>
                    <span className="kfpl-sr-ticket-status" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}33` }}>
                      {st.text}
                    </span>
                  </div>
                  <div className="kfpl-sr-ticket-body">
                    <h4 className="kfpl-sr-ticket-subject">{req.subject}</h4>
                    <div className="kfpl-sr-ticket-footer">
                      <span className="kfpl-sr-ticket-date">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {req.createdAt || req.date ? new Date(req.createdAt || req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="kfpl-sr-ticket-chevron"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {requests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--color-text-muted)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)', margin: '0 0 6px 0' }}>No Service Requests</h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>You haven't raised any service requests yet.</p>
              <button 
                onClick={() => navigate('/service-requests/new')} 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'var(--color-navy)', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Your First Request
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============ END: ServiceRequests.jsx ============ */
