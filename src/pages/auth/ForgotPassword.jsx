/* ============================================================
   Page: ForgotPassword.jsx
   Description: Email-based password reset flow
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) setSent(true);
  };

  return (
    <div className="kfpl-login">
      {/* Left Column: Cinema Wallpaper */}
      <div className="kfpl-login-wallpaper">
        <div className="kfpl-login-brand">
          <div style={{ background: '#ffffff', padding: '6px', width: '68px', height: '68px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginBottom: '16px' }}>
            <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px', display: 'block' }} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.15 }}>Kinetoscope Film Pvt Ltd</h1>
          <p style={{ fontSize: '12px', color: 'rgba(240, 253, 244, 0.9)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '6px', marginBottom: '12px', fontWeight: '700' }}>A Global Media Fund</p>
          <p>Client Portal. Reset your credentials securely here.</p>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="kfpl-login-panel">
        <div className="kfpl-login-card animate-scale-in">
          <div className="kfpl-login-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', padding: '6px', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.18)', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px', display: 'block' }} />
            </div>
            <h1 className="kfpl-login-title">Reset Password</h1>
            <p className="kfpl-login-subtitle">Enter your email to receive a reset link</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }} className="animate-fade-in">
              <div className="kfpl-login-tfa-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                A password reset link has been sent to <strong style={{ color: 'var(--color-gold)' }}>{email}</strong>. 
                Please check your inbox.
              </p>
              <button className="kfpl-login-btn" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </div>
          ) : (
            <form className="kfpl-login-form animate-fade-in" onSubmit={handleSubmit}>
              <div className="kfpl-login-input-group">
                <label className="kfpl-login-label">Email Address</label>
                <input
                  type="email"
                  className="kfpl-login-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="kfpl-login-btn">Send Reset Link</button>
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <span className="kfpl-login-forgot" onClick={() => navigate('/login')}>
                  ← Back to Login
                </span>
              </div>
            </form>
          )}

          <div className="kfpl-login-footer">
            © 2026 Kinetoscope Film Pvt Ltd. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ END: ForgotPassword.jsx ============ */
