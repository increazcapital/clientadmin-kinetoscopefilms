/* ============================================================
   Page: OnboardingDetails.jsx
   Description: Two-step onboarding: Nominee + Risk Profile
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RISK_PROFILES, NOMINEE_RELATIONS } from '../../constants';
import { apiRequest } from '../../config/apiHelper';

export default function OnboardingDetails() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nominee, setNominee] = useState(() => {
    try {
      const authData = localStorage.getItem('kfpl_client_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        const c = parsed.client || parsed.user || {};
        if (c.nomineeName || c.nominee?.name) {
          return {
            name: c.nomineeName || c.nominee?.name || '',
            relation: c.nomineeRelation || c.nominee?.relation || 'Spouse',
            contact: c.nomineePhone || c.nomineeContact || c.nominee?.phone || c.nominee?.contact || '',
            email: c.nomineeEmail || c.nominee?.email || ''
          };
        }
      }
    } catch (e) {}
    return { name: '', relation: 'Spouse', contact: '', email: '' };
  });
  const [selectedRisk, setSelectedRisk] = useState(() => {
    try {
      const authData = localStorage.getItem('kfpl_client_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        const c = parsed.client || parsed.user || {};
        return c.riskProfile || null;
      }
    } catch (e) {}
    return null;
  });
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    try {
      const authData = localStorage.getItem('kfpl_client_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        const c = parsed.client || parsed.user || {};
        
        const hasNom = !!(c.nomineeName || c.nominee?.name);
        const hasRsk = !!c.riskProfile;
        
        if (hasNom && hasRsk) {
          parsed.client.onboardingComplete = true;
          localStorage.setItem('kfpl_client_auth', JSON.stringify(parsed));
          navigate('/dashboard');
        } else if (hasNom) {
          setStep(2);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [navigate]);

  const handleNext = () => {
    if (!nominee.name) return;
    setStep(2);
  };

  const handleComplete = async () => {
    if (!selectedRisk || !confirmed) return;
    
    // Save to localStorage
    const auth = localStorage.getItem('kfpl_client_auth');
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        if (parsed && parsed.client) {
          parsed.client.nominee = nominee;
          parsed.client.riskProfile = selectedRisk;
          parsed.client.onboardingComplete = true;
          parsed.client.riskProfileLocked = true;
          
          // Save active session
          localStorage.setItem('kfpl_client_auth', JSON.stringify(parsed));
          
          // Save dynamic client session to keep it persistent across logouts
          const sessionKey = `kfpl_client_session_${parsed.client.email.toLowerCase()}`;
          localStorage.setItem(sessionKey, JSON.stringify(parsed.client));
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Persist to backend database so it never resets
    try {
      await apiRequest('/api/client/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          nomineeName: nominee.name,
          nomineeRelation: nominee.relation,
          nomineePhone: nominee.contact,
          nomineeEmail: nominee.email,
          riskProfile: selectedRisk,
          onboardingComplete: true
        })
      });
      
      // Clear client dashboard cache so it re-fetches fresh details from backend
      localStorage.removeItem('kfpl_client_dashboard_cache');
    } catch (apiErr) {
      console.warn('Backend profile update failed, relying on local session:', apiErr);
    }

    navigate('/dashboard');
  };

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">Complete Your Profile</h1>
          <p className="kfpl-page-subtitle">Step {step} of 2 — {step === 1 ? 'Nominee Details' : 'Risk Profile'}</p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        <div style={{ flex: 1, height: '4px', borderRadius: '4px', background: 'var(--color-gold)' }}></div>
        <div style={{ flex: 1, height: '4px', borderRadius: '4px', background: step >= 2 ? 'var(--color-gold)' : 'var(--color-surface-alt)' }}></div>
      </div>

      {/* Step 1: Nominee Details */}
      {step === 1 && (
        <div className="kfpl-form-card" style={{ maxWidth: '600px' }}>
          <div className="kfpl-form-card-header">
            <div>
              <h3 className="kfpl-form-card-title">Nominee Details</h3>
              <p className="kfpl-form-card-subtitle">Add your nominee for investment protection</p>
            </div>
          </div>
          <div className="kfpl-form">
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Name <span className="required">*</span></label>
                <input className="kfpl-input" placeholder="Full legal name" value={nominee.name} onChange={e => setNominee({ ...nominee, name: e.target.value })} autoFocus />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Relation <span className="required">*</span></label>
                <select className="kfpl-select" value={nominee.relation} onChange={e => setNominee({ ...nominee, relation: e.target.value })}>
                  {NOMINEE_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Contact Number</label>
                <input className="kfpl-input" placeholder="10-digit mobile" value={nominee.contact} onChange={e => setNominee({ ...nominee, contact: e.target.value })} maxLength="10" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email (Optional)</label>
                <input className="kfpl-input" type="email" placeholder="nominee@email.com" value={nominee.email} onChange={e => setNominee({ ...nominee, email: e.target.value })} />
              </div>
            </div>
            <div className="kfpl-form-actions">
              <button className="kfpl-btn kfpl-btn--ghost" onClick={() => navigate('/dashboard')}>Skip for now</button>
              <button className="kfpl-btn kfpl-btn--primary" onClick={handleNext} disabled={!nominee.name}>Continue →</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Risk Profile Selection */}
      {step === 2 && (
        <div style={{ maxWidth: '800px' }}>
          <div className="kfpl-form-card" style={{ marginBottom: '20px' }}>
            <div className="kfpl-form-card-header">
              <div>
                <h3 className="kfpl-form-card-title">Select Your Risk Profile</h3>
                <p className="kfpl-form-card-subtitle">Choose the investment approach that matches your risk appetite</p>
              </div>
            </div>
            <div className="kfpl-risk-cards">
              {RISK_PROFILES.map(profile => (
                <div key={profile.id} className={`kfpl-risk-card ${selectedRisk === profile.id ? 'selected' : ''}`} onClick={() => { setSelectedRisk(profile.id); setConfirmed(false); }}>
                  {selectedRisk === profile.id && (
                    <div className="kfpl-risk-card-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  <div className="kfpl-risk-card-icon">{profile.icon}</div>
                  <h4>{profile.label}</h4>
                  <p>{profile.description}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedRisk && (
            <div className="kfpl-card animate-fade-in" style={{ background: 'var(--color-gold-light)', borderColor: 'rgba(245, 168, 0, 0.2)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: '3px', accentColor: 'var(--color-gold)', width: '16px', height: '16px' }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  I understand that my risk profile selection is a <strong>one-time choice</strong>. After confirmation, changes can only be made by raising a Service Request for review by the admin team.
                </span>
              </label>
            </div>
          )}

          <div className="kfpl-form-actions" style={{ marginTop: '20px' }}>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleComplete} disabled={!selectedRisk || !confirmed}>Complete Onboarding ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ END: OnboardingDetails.jsx ============ */
