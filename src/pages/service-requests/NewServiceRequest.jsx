import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { REQUEST_CATEGORIES } from '../../constants';
import { apiRequest } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';

export default function NewServiceRequest() {
  const navigate = useNavigate();
  const toastHelper = useToast();
  const addToast = typeof toastHelper === 'function' ? toastHelper : (toastHelper?.addToast || (() => {}));

  const [form, setForm] = useState({ category: REQUEST_CATEGORIES[0], subject: '', description: '' });
  const [customTopic, setCustomTopic] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('File size must be less than 5MB', 'danger', 'File Too Large');
        return;
      }
      setAttachment(file);
    }
  };

  const handleRemoveAttachment = (e) => {
    e.stopPropagation();
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.description) return;
    if (form.category === 'Other' && !customTopic.trim()) {
      addToast('Please specify your custom issue topic.', 'danger', 'Custom Topic Required');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('category', form.category);
      const finalSubject = form.category === 'Other' && customTopic ? `[${customTopic.trim()}] ${form.subject}` : form.subject;
      formData.append('subject', finalSubject);
      formData.append('description', form.description);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      await apiRequest('/api/client/service-requests', {
        method: 'POST',
        body: formData,
      });

      addToast('Service request submitted successfully!', 'success', 'Request Created');
      navigate('/service-requests');
    } catch (err) {
      console.error('Failed to create service request:', err);
      addToast(err.message || 'Failed to submit service request', 'danger', 'Submission Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kfpl-page animate-fade-slide-up" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header section with back button */}
      <div className="kfpl-card-header-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            <span>Account</span>
            <span>•</span>
            <span>Support Tickets</span>
            <span>•</span>
            <span style={{ color: 'var(--color-gold-dark)' }}>New Ticket</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0, letterSpacing: '-0.5px' }}>
            New Service Request
          </h1>
        </div>
        <button 
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
            transition: 'all 0.2s ease'
          }}
        >
          Cancel
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <div className="kfpl-card" style={{ width: '100%', maxWidth: '680px', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-navy)', borderBottom: '2px solid var(--color-gold)', paddingBottom: '14px', marginBottom: '24px', margin: 0 }}>
            Create Support Ticket
          </h3>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="kfpl-form-group">
              <label className="kfpl-form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.85rem' }}>Category <span className="required" style={{ color: '#ef4444' }}>*</span></label>
              <select 
                className="kfpl-form-select" 
                value={form.category} 
                onChange={e => setForm({ ...form, category: e.target.value })} 
                required
                disabled={loading}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: '#fff', fontSize: '0.9rem' }}
              >
                {REQUEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {form.category === 'Other' && (
              <div className="kfpl-form-group">
                <label className="kfpl-form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.85rem' }}>Specify Your Issue / Topic <span className="required" style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text"
                  className="kfpl-form-input" 
                  placeholder="Describe your custom issue topic..." 
                  value={customTopic} 
                  onChange={e => setCustomTopic(e.target.value)} 
                  required 
                  disabled={loading}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.9rem', background: '#F8FAFC' }}
                />
              </div>
            )}

            <div className="kfpl-form-group">
              <label className="kfpl-form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.85rem' }}>Subject <span className="required" style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text"
                className="kfpl-form-input" 
                placeholder="Brief summary of your request..." 
                value={form.subject} 
                onChange={e => setForm({ ...form, subject: e.target.value })} 
                required 
                disabled={loading}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            <div className="kfpl-form-group">
              <label className="kfpl-form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.85rem' }}>Description <span className="required" style={{ color: '#ef4444' }}>*</span></label>
              <textarea 
                className="kfpl-form-textarea" 
                placeholder="Describe your query in detail..." 
                value={form.description} 
                onChange={e => setForm({ ...form, description: e.target.value })} 
                required 
                disabled={loading}
                rows="5"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }}
              />
            </div>
            
            <div className="kfpl-form-group">
              <label className="kfpl-form-label" style={{ fontWeight: 600, color: 'var(--color-navy)', fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>Attachment (Optional)</label>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <div 
                className="kfpl-file-upload" 
                onClick={() => !loading && fileInputRef.current?.click()}
                style={{ 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: '2px dashed var(--color-border)',
                  borderRadius: '10px',
                  padding: '24px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  transition: 'all 0.2s ease'
                }}
              >
                {attachment ? (
                  <div style={{ width: '100%' }}>
                    <div className="kfpl-file-upload-icon" style={{ color: 'var(--color-gold-dark)', marginBottom: '8px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 36, height: 36, margin: '0 auto' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="kfpl-file-upload-text" style={{ fontSize: '0.9rem', color: 'var(--color-navy)' }}>
                      <strong>{attachment.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {(attachment.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRemoveAttachment}
                      style={{
                        marginTop: '12px',
                        background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 16px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Remove Attachment
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="kfpl-file-upload-icon" style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 36, height: 36, margin: '0 auto' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div className="kfpl-file-upload-text" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      <strong style={{ color: 'var(--color-gold-dark)' }}>Click to upload</strong> or drag and drop files here
                      <div style={{ fontSize: '11px', marginTop: '4px' }}>PDF, DOCX, JPG, PNG up to 5MB</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              className="kfpl-btn kfpl-btn-primary" 
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                fontWeight: 700, 
                background: 'var(--color-navy)', 
                color: '#fff', 
                border: 'none', 
                cursor: 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 12px rgba(10, 25, 47, 0.15)',
                transition: 'all 0.2s'
              }}
              disabled={loading || !form.subject || !form.description}
            >
              {loading ? 'Submitting Request...' : 'Submit Support Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ============ END: NewServiceRequest.jsx ============ */
