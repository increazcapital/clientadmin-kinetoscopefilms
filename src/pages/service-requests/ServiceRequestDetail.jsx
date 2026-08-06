import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../config/apiHelper';

export default function ServiceRequestDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayId, setDisplayId] = useState('N/A');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await apiRequest('/api/client/service-requests');
        console.log('Client Service Request Detail Raw Data:', data);

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

        const found = list.find(r => r._id === id || r.id === id);
        if (found) {
          setReq(found);
          setError(null);

          // Find sorted chronological index for stable sequential display ID
          const sorted = [...list].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.date || 0);
            const dateB = new Date(b.createdAt || b.date || 0);
            return dateA - dateB;
          });
          const idx = sorted.findIndex(r => r._id === id || r.id === id);
          if (idx !== -1) {
            setDisplayId(`SR-${101 + idx}`);
          } else {
            setDisplayId(found.id || (found._id ? 'SR-' + found._id.substring(found._id.length - 6).toUpperCase() : 'N/A'));
          }
        } else {
          setError('Service request not found.');
        }
      } catch (err) {
        console.error('Failed to load request detail:', err);
        setError('Failed to load service request detail.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="kfpl-page">
        <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--color-text-muted)' }}>
          Loading service request details...
        </div>
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="kfpl-page">
        <div className="kfpl-page-header">
          <div className="kfpl-page-header-actions">
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => navigate('/service-requests')}>← Back to Requests</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-danger)' }}>
          {error || 'Request details could not be found.'}
        </div>
      </div>
    );
  }

  const getDisplayId = (sr) => {
    return displayId;
  };

  // Helper to resolve attachment url from different structures
  const getAttachmentUrl = (sr) => {
    if (!sr) return null;
    const urlVal = sr.attachmentUrl || sr.attachment || sr.fileUrl || sr.file || sr.filePath;
    if (!urlVal) return null;
    if (typeof urlVal === 'string') return urlVal;
    if (typeof urlVal === 'object') {
      return urlVal.url || urlVal.filePath || urlVal.path || null;
    }
    return null;
  };

  // Generate dynamic chronological timeline based on request status
  const displayTimeline = [];
  const normalizedStatus = (req.status || 'OPEN').toUpperCase();
  
  // Step 1: Raised (always present)
  displayTimeline.push({
    date: req.createdAt || req.date ? new Date(req.createdAt || req.date).toLocaleDateString('en-IN') : 'N/A',
    text: 'Request raised and submitted.',
    type: 'RAISED'
  });
  
  // Step 2: In Progress (if current status is In Progress, Resolved or Closed)
  if (normalizedStatus === 'IN PROGRESS' || normalizedStatus === 'RESOLVED' || normalizedStatus === 'CLOSED') {
    displayTimeline.push({
      date: req.updatedAt ? new Date(req.updatedAt).toLocaleDateString('en-IN') : '—',
      text: 'Our administration team is reviewing this ticket.',
      type: 'IN PROGRESS'
    });
  }
  
  // Step 3: Resolved / Closed (if current status is Resolved or Closed)
  if (normalizedStatus === 'RESOLVED' || normalizedStatus === 'CLOSED') {
    displayTimeline.push({
      date: req.updatedAt ? new Date(req.updatedAt).toLocaleDateString('en-IN') : '—',
      text: req.adminRemarks || req.adminNote || req.remarks || `This ticket has been ${req.status.toLowerCase()}.`,
      type: normalizedStatus
    });
  }

  return (
    <div className="kfpl-page animate-fade-slide-up" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Premium Header Breadcrumb/Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            <span>Account</span>
            <span>•</span>
            <span>Support Tickets</span>
            <span>•</span>
            <span style={{ color: 'var(--color-gold-dark)' }}>{req.id || 'Details'}</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Request {getDisplayId(req)}
          </h1>
        </div>
        <button 
          className="kfpl-btn" 
          onClick={() => navigate('/service-requests')}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            color: 'var(--color-text-primary)', 
            padding: '10px 18px', 
            borderRadius: '8px', 
            fontWeight: 600, 
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to List
        </button>
      </div>

      <div className="kfpl-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Main Details Sheet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="kfpl-card" style={{ padding: '28px', borderRadius: '12px', border: '1px solid var(--color-border)', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>Ticket Information</h3>
              <span className={`kfpl-request-status ${req.status.toLowerCase().replace(' ', '-')}`} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {req.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 30px', marginBottom: '24px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Category</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--color-navy)' }}>{req.category}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Date Submitted</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--color-navy)' }}>
                  {req.createdAt || req.date ? new Date(req.createdAt || req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                </strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Subject</span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--color-navy)' }}>{req.subject}</strong>
              </div>
            </div>

            <div style={{ marginTop: '24px', background: 'var(--color-surface)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                {req.description}
              </p>
            </div>

            {getAttachmentUrl(req) && (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attachments</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <a 
                    href={getAttachmentUrl(req).startsWith('http') ? getAttachmentUrl(req) : `http://192.168.1.28:5000${getAttachmentUrl(req).startsWith('/') ? '' : '/'}${getAttachmentUrl(req)}`}
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      color: 'var(--color-gold-dark)', 
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      padding: '8px 12px',
                      background: 'var(--color-gold-light)',
                      borderRadius: '6px',
                      width: 'fit-content',
                      border: '1px solid rgba(212, 175, 55, 0.2)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    View Uploaded File
                  </a>
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(getAttachmentUrl(req)) && (
                    <div style={{ marginTop: '4px' }}>
                      <img 
                        src={getAttachmentUrl(req).startsWith('http') ? getAttachmentUrl(req) : `http://192.168.1.28:5000${getAttachmentUrl(req).startsWith('/') ? '' : '/'}${getAttachmentUrl(req)}`}
                        alt="Attachment Preview"
                        style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', border: '1px solid var(--color-border)', objectFit: 'contain', background: '#f8fafc', padding: '6px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin Remarks Card */}
          {(req.adminRemarks || req.adminNote || req.remarks) && (
            <div className="kfpl-card" style={{ padding: '24px', borderRadius: '12px', borderLeft: '4px solid var(--color-gold)', background: 'var(--color-gold-light)', borderTop: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--color-gold-dark)' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-gold-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Official Administrator Response / Remarks</h4>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-navy)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', fontWeight: 600 }}>
                {req.adminRemarks || req.adminNote || req.remarks}
              </p>
            </div>
          )}
        </div>

        {/* Dynamic Vertical Timeline */}
        <div className="kfpl-card" style={{ padding: '28px', borderRadius: '12px', border: '1px solid var(--color-border)', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.03)', position: 'relative' }}>
          <h3 style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid var(--color-gold)', color: 'var(--color-navy)', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 24px 0' }}>
            Status Timeline
          </h3>
          <div style={{ position: 'relative', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Vertical Line */}
            <div style={{ 
              position: 'absolute', 
              left: '11px', 
              top: '8px', 
              bottom: '8px', 
              width: '2px', 
              background: 'linear-gradient(to bottom, #10B981, #F59E0B, #cbd5e1)', 
              borderRadius: '1px' 
            }} />
            
            {displayTimeline.map((item, i) => {
              let dotColor = '#10B981'; // Green for raised
              let shadowColor = 'rgba(16, 185, 129, 0.2)';
              if (item.type === 'IN PROGRESS') {
                dotColor = '#F59E0B'; // Orange/Gold
                shadowColor = 'rgba(245, 158, 11, 0.2)';
              } else if (item.type === 'RESOLVED' || item.type === 'CLOSED') {
                dotColor = '#10B981';
                shadowColor = 'rgba(16, 185, 129, 0.2)';
              }
              
              return (
                <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Glowing Dot */}
                  <div style={{ 
                    position: 'absolute', 
                    left: '-32px', 
                    top: '4px', 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: '#fff', 
                    border: `3px solid ${dotColor}`, 
                    boxShadow: `0 0 0 4px ${shadowColor}`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    zIndex: 2
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
                  </div>
                  
                  {/* Timeline Text */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dotColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {item.type}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {item.date}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-navy)', marginTop: '2px' }}>
                    {item.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ END: ServiceRequestDetail.jsx ============ */
