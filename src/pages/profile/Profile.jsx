/* ============================================================
   Page: Profile.jsx
   Description: Client profile with personal info, nominee, risk profile,
                security settings (Email/Pass change with OTP, 2FA toggle),
                and integrated Support Desk contacts/FAQs.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RISK_PROFILES, NOMINEE_RELATIONS } from '../../constants';
import { useToast } from '../../components/ui/Toast';
import { apiRequest, safeSetLocalStorage } from '../../config/apiHelper';
import { getApiUrl } from '../../config/apiUrl';
import KycAgreementCard from '../../components/common/KycAgreementCard';
import MissingDocsReuploadCard from '../../components/common/MissingDocsReuploadCard';
import SensitiveValueToggle from '../../components/common/SensitiveValueToggle';

const formatClientID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  const str = String(rawId).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    return 'KFPL-CL-1001';
  }
  if (/^KFPL-CL-\d+$/i.test(str)) {
    return str.toUpperCase();
  }
  const digitsMatch = str.match(/\d+/);
  if (digitsMatch) {
    let val = parseInt(digitsMatch[0], 10);
    if (val < 1000) val = 1000 + val;
    return `KFPL-CL-${val}`;
  }
  return 'KFPL-CL-1001';
};

const formatAgentID = (rawId) => {
  if (!rawId || rawId === '—' || rawId === '-') return 'KFPL-AG-1002';
  const str = String(rawId).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    return 'KFPL-AG-1002';
  }
  if (/^KFPL-AG-\d+$/i.test(str)) {
    return str.toUpperCase();
  }
  const digitsMatch = str.match(/\d+/);
  if (digitsMatch) {
    let val = parseInt(digitsMatch[0], 10);
    if (val < 1000) val = 1000 + val;
    return `KFPL-AG-${val}`;
  }
  return 'KFPL-AG-1002';
};

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const tabParam = searchParams.get('tab') || 'details';
  const [activeTab, setActiveTab] = useState(tabParam);

  const [client, setClient] = useState(null);
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const [supportSettings, setSupportSettings] = useState({
    clientSupportEmail: 'support@kfpl.com',
    clientSupportPhone: '+91 98765 43210',
    clientSupportWhatsapp: '919876543210',
    supportHours: 'Mon - Sat, 10 AM to 6 PM IST',
  });

  useEffect(() => {
    const fetchSupportSettings = async () => {
      try {
        const url = getApiUrl('/api/system-settings/support');
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) {
            let email = json.data.clientSupportEmail;
            if (!email || !email.includes('@')) email = 'support@kfpl.com';
            setSupportSettings({
              clientSupportEmail: email,
              clientSupportPhone: json.data.clientSupportPhone || '+91 98765 43210',
              clientSupportWhatsapp: json.data.clientSupportWhatsapp || '919876543210',
              supportHours: json.data.supportHours || 'Mon - Sat, 10 AM to 6 PM IST',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch client support settings:', err);
      }
    };
    fetchSupportSettings();
  }, []);

  useEffect(() => {
    // --- SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const cacheData = localStorage.getItem('kfpl_client_profile_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        if (parsed.client) setClient(parsed.client);
        if (parsed.clientEmail) setClientEmail(parsed.clientEmail);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to parse client profile cache:', e);
    }

    const loadProfile = async () => {
      try {
        const [profileRes, advisorRes, sysConfigRes] = await Promise.all([
          apiRequest('/api/client/profile').catch(() => null),
          apiRequest('/api/client/wealth-advisor').catch(() => null),
          apiRequest('/api/system-settings/support').catch(() => null),
        ]);

        const getLoggedInClient = () => {
          try {
            const authData = localStorage.getItem('kfpl_client_auth');
            if (authData) {
              const parsed = JSON.parse(authData);
              if (parsed.client) return parsed.client;
            }
          } catch (e) {}
          return null;
        };

        const extractProfile = (res) => {
          if (!res) return null;
          if (res.profile) return res.profile;
          if (res.client) return res.client;
          if (res.user) return res.user;
          if (res.data) {
            if (res.data.profile) return res.data.profile;
            if (res.data.client) return res.data.client;
            if (res.data.user) return res.data.user;
            return res.data;
          }
          return res;
        };

        const rawProfile = extractProfile(profileRes) || getLoggedInClient();
        if (rawProfile) {
          if (rawProfile) {
            const normalized = {
              ...rawProfile,
              name: rawProfile.fullName || rawProfile.name || '',
              clientId: formatClientID(rawProfile.clientCode || rawProfile.clientId || ''),
              category: rawProfile.tier || rawProfile.category || 'Silver',
              status: rawProfile.status || 'Active',
              memberSince: rawProfile.joinDate || rawProfile.memberSince || rawProfile.createdAt || '',
              agentName: rawProfile.assignedAgentName || rawProfile.agentName || '',
              agentId: formatAgentID(rawProfile.assignedAgentCode || rawProfile.assignedAgent || rawProfile.agentId || ''),
              emergencyContact: rawProfile.emergencyContact || rawProfile.emergencyPhone || '—',
              riskProfile: rawProfile.riskProfile || 'Conservative',
              nominee: {
                name: rawProfile.nomineeName || rawProfile.nominee?.name || '',
                relation: rawProfile.nomineeRelation || rawProfile.nominee?.relation || '',
                contact: rawProfile.nomineePhone || rawProfile.nomineeContact || rawProfile.nominee?.phone || rawProfile.nominee?.contact || '',
                email: rawProfile.nomineeEmail || rawProfile.nominee?.email || '',
              }
            };

            if (advisorRes) {
              const rawAdv = advisorRes.data?.advisor || advisorRes.data || advisorRes.advisor || advisorRes.agent;
              if (rawAdv && (rawAdv.name || rawAdv.fullName)) {
                normalized.agentName = rawAdv.name || rawAdv.fullName;
                normalized.agentId = formatAgentID(rawAdv.code || rawAdv.agentCode || rawAdv.agentId || rawAdv._id || '');
                normalized.advisorPhone = rawAdv.phone || rawAdv.mobile || rawAdv.phoneNumber || '';
                normalized.advisorEmail = rawAdv.email || '';
                const cleanPhone = (rawAdv.phone || '').replace(/[^0-9]/g, '');
                normalized.advisorWhatsApp = rawAdv.whatsAppLink || (cleanPhone ? `https://wa.me/91${cleanPhone}` : '');
              } else {
                normalized.agentName = '';
                normalized.agentId = '';
                normalized.advisorPhone = '';
                normalized.advisorEmail = '';
                normalized.advisorWhatsApp = '';
              }
            }

            if (sysConfigRes && sysConfigRes.data) {
              normalized.supportEmail = sysConfigRes.data.clientSupportEmail || 'support@kfpl.com';
              normalized.supportPhone = sysConfigRes.data.clientSupportPhone || '+91 98765 43210';
              normalized.supportWhatsapp = sysConfigRes.data.clientSupportWhatsapp || '919876543210';
              normalized.supportHours = sysConfigRes.data.supportHours || 'Mon - Sat, 10 AM to 6 PM IST';
            }

            setClient(normalized);
            setClientEmail(normalized.email || '');
            try {
              localStorage.setItem('kfpl_client_profile_cache', JSON.stringify({
                client: normalized,
                clientEmail: normalized.email || ''
              }));
            } catch (e) {
              console.warn('Profile cache localStorage quota exceeded:', e);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load client profile from API:', err);
        addToast('error', 'Error', 'Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const compressImage = (file, maxSide = 300, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSide) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            }
          } else {
            if (height > maxSide) {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('error', 'Invalid File', 'Please select an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    try {
      addToast('info', 'Uploading Avatar', 'Optimizing and saving profile picture...');
      const base64Image = await compressImage(file, 300, 0.8);

      // INSTANT OPTIMISTIC UI & CACHE UPDATE (0ms)
      setClient(prev => ({ ...prev, profilePic: base64Image }));
      try {
        const cacheData = localStorage.getItem('kfpl_client_dashboard_cache');
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          if (parsed.client) parsed.client.profilePic = base64Image;
          safeSetLocalStorage('kfpl_client_dashboard_cache', parsed);
        }
      } catch (_) {}
      try {
        const authData = localStorage.getItem('kfpl_client_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          if (parsed.client) parsed.client.profilePic = base64Image;
          if (parsed.user) parsed.user.profilePic = base64Image;
          parsed.profilePic = base64Image;
          safeSetLocalStorage('kfpl_client_auth', parsed);
        }
      } catch (_) {}
      window.dispatchEvent(new Event('clientProfileUpdated'));

      const res = await apiRequest('/api/client/profile', {
        method: 'PATCH',
        body: JSON.stringify({ profilePic: base64Image })
      });

      const updatedPicUrl = res?.data?.profilePic || res?.data?.user?.profilePic || res?.data?.client?.profilePic || base64Image;

      setClient(prev => ({ ...prev, profilePic: updatedPicUrl }));

      try {
        const cacheData = localStorage.getItem('kfpl_client_dashboard_cache');
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          if (parsed.client) parsed.client.profilePic = updatedPicUrl;
          safeSetLocalStorage('kfpl_client_dashboard_cache', parsed);
        }
      } catch (_) {}

      try {
        const authData = localStorage.getItem('kfpl_client_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          if (parsed.client) parsed.client.profilePic = updatedPicUrl;
          if (parsed.user) parsed.user.profilePic = updatedPicUrl;
          parsed.profilePic = updatedPicUrl;
          safeSetLocalStorage('kfpl_client_auth', parsed);
        }
      } catch (_) {}

      window.dispatchEvent(new Event('clientProfileUpdated'));
      addToast('success', 'Profile Picture Updated', 'Your profile photo has been updated successfully!');
    } catch (err) {
      console.error('Failed to upload client avatar:', err);
      addToast('error', 'Upload Failed', err.message || 'Failed to update profile picture.');
    }
  };

  const handleAvatarRemove = async () => {
    try {
      // INSTANT OPTIMISTIC REMOVAL (0ms)
      setClient(prev => ({ ...prev, profilePic: '' }));

      try {
        const cacheData = localStorage.getItem('kfpl_client_dashboard_cache');
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          if (parsed.client) parsed.client.profilePic = '';
          safeSetLocalStorage('kfpl_client_dashboard_cache', parsed);
        }
      } catch (_) {}

      try {
        const authData = localStorage.getItem('kfpl_client_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          if (parsed.client) parsed.client.profilePic = '';
          if (parsed.user) parsed.user.profilePic = '';
          parsed.profilePic = '';
          safeSetLocalStorage('kfpl_client_auth', parsed);
        }
      } catch (_) {}

      window.dispatchEvent(new Event('clientProfileUpdated'));
      addToast('success', 'Profile Picture Removed', 'Your profile photo has been removed successfully!');

      await apiRequest('/api/client/profile/avatar', {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to remove client avatar:', err);
      addToast('error', 'Removal Failed', err.message || 'Failed to remove profile picture.');
    }
  };

  const riskProfile = client ? RISK_PROFILES.find(r => r.id.toLowerCase() === client.riskProfile?.toLowerCase()) : null;

  // Sync tab with URL parameter changes
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };


  /* ── 2FA Toggle State ──────────────── */
  const [tfaEnabled, setTfaEnabled] = useState(
    localStorage.getItem('kfpl_tfa_enabled') === 'true'
  );

  const handleTfaToggle = async () => {
    const nextState = !tfaEnabled;
    setTfaEnabled(nextState);
    localStorage.setItem('kfpl_tfa_enabled', String(nextState));

    try {
      await apiRequest('/api/client/profile/2fa', {
        method: 'PATCH',
        body: JSON.stringify({ is2FAEnabled: nextState }),
      });
      if (nextState) {
        addToast('success', '2FA Enabled', 'Two-Factor Authentication is now enabled for your account.');
      } else {
        addToast('warning', '2FA Disabled', 'Two-Factor Authentication has been turned off.');
      }
    } catch (err) {
      setTfaEnabled(!nextState);
      localStorage.setItem('kfpl_tfa_enabled', String(!nextState));
      addToast('error', 'Update Failed', err.message || 'Failed to update 2FA setting on server.');
    }
  };




  /* ── Password Change States ────────── */
  const [passForm, setPassForm] = useState({ currentPass: '', newPass: '', confirmPass: '' });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [passOtpSent, setPassOtpSent] = useState(false);
  const [passOtpInput, setPassOtpInput] = useState('');
  const [passResendTimer, setPassResendTimer] = useState(0);

  // Password Timer effect
  useEffect(() => {
    let interval = null;
    if (passOtpSent && passResendTimer > 0) {
      interval = setInterval(() => {
        setPassResendTimer(prev => prev - 1);
      }, 1000);
    } else if (passResendTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [passOtpSent, passResendTimer]);

  const handleSendPassOtp = async () => {
    if (!passForm.currentPass || !passForm.newPass || !passForm.confirmPass) {
      addToast('error', 'Error', 'Please fill in all password fields.');
      return;
    }
    if (passForm.newPass !== passForm.confirmPass) {
      addToast('error', 'Error', 'New password and confirm password do not match.');
      return;
    }
    if (passForm.newPass.length < 8) {
      addToast('error', 'Error', 'New password must be at least 8 characters.');
      return;
    }

    try {
      console.log('Sending OTP request to backend...');
      await apiRequest('/api/client/settings/change-password/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passForm.currentPass,
          newPassword: passForm.newPass,
          confirmPassword: passForm.confirmPass
        })
      });
      setPassOtpSent(true);
      setPassResendTimer(30);
      addToast('success', 'Verification Code Sent', 'An OTP code has been sent to your registered email.');
    } catch (err) {
      console.error('Error sending OTP to backend:', err);
      addToast('error', 'Failed to send OTP', err.message || 'Verification code could not be sent.');
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (passOtpInput.length !== 6) {
      addToast('error', 'Verification Failed', 'Please enter a valid 6-digit OTP.');
      return;
    }

    try {
      console.log('Verifying OTP request at backend...');
      await apiRequest('/api/client/settings/change-password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passForm.currentPass,
          newPassword: passForm.newPass,
          otp: passOtpInput
        })
      });
      setPassForm({ currentPass: '', newPass: '', confirmPass: '' });
      setPassOtpSent(false);
      setPassOtpInput('');
      addToast('success', 'Password Updated', 'Your security password has been changed successfully.');
    } catch (err) {
      console.error('Error verifying OTP at backend:', err);
      addToast('error', 'Verification Failed', err.message || 'Incorrect OTP. Please try again.');
    }
  };

  /* ── FAQ State ─────────────────────── */
  const [openFaq, setOpenFaq] = useState(null);

  if (loading) {
    return (
      <div className="kfpl-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div className="kfpl-loading-spinner" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="kfpl-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Failed to load profile details.</p>
        <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">My Profile</h1>
          <p className="kfpl-page-subtitle">View your details, adjust security configurations, or get support</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: '16px', height: '16px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Agreement
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="kfpl-pay-tabs">
        <button
          className={`kfpl-pay-tab ${activeTab === 'details' ? 'kfpl-pay-tab--active' : ''}`}
          onClick={() => handleTabChange('details')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          Profile Details
        </button>
        <button
          className={`kfpl-pay-tab ${activeTab === 'security' ? 'kfpl-pay-tab--active' : ''}`}
          onClick={() => handleTabChange('security')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Security & Password
        </button>
        <button
          className={`kfpl-pay-tab ${activeTab === 'support' ? 'kfpl-pay-tab--active' : ''}`}
          onClick={() => handleTabChange('support')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Support Desk
        </button>
      </div>

      <div style={{ marginTop: '24px' }}>
        {/* ==================== TAB 1: Profile Details ==================== */}
        {activeTab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Profile Avatar & Hero Header */}
            <div className="kfpl-card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              background: 'linear-gradient(135deg, #061D13 0%, #0B3020 100%)',
              color: '#FFFFFF',
              padding: '24px 28px',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(6, 29, 19, 0.15)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: '#FFFFFF',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                  overflow: 'hidden'
                }}>
                  {client.profilePic ? (
                    <img src={client.profilePic} alt={client.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (client.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  )}
                </div>
                <label
                  htmlFor="client-avatar-upload"
                  title="Upload Profile Picture"
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#10B981',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    border: '2px solid #061D13',
                    zIndex: 10,
                    transition: 'transform 0.2s ease, background 0.2s ease'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </label>
                {Boolean(client.profilePic) && (
                  <button
                    type="button"
                    title="Remove Profile Picture"
                    onClick={handleAvatarRemove}
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      left: '-2px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#EF4444',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                      border: '2px solid #061D13',
                      zIndex: 10,
                      transition: 'transform 0.2s ease, background 0.2s ease'
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px' }}>
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                )}
                <input
                  type="file"
                  id="client-avatar-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarUpload}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#10B981', fontWeight: 700 }}>Client Account</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '2px 0 4px', color: '#FFFFFF' }}>{client.name}</h2>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600 }}>ID: {client.clientId}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="kfpl-badge kfpl-badge--active">{client.status}</span>
                  <span className="kfpl-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>{(client.category || 'SILVER').toUpperCase()} TIER</span>
                  {Boolean(client.agreementDocumentVerified) && String(client.kycStatus || client.kyc || '').toUpperCase() === 'VERIFIED' ? (
                    <span className="kfpl-badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.5)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11 12 14 22 4"/></svg>
                      KYC VERIFIED
                    </span>
                  ) : String(client.kycStatus || client.kyc || '').toUpperCase() === 'REJECTED' ? (
                    <span className="kfpl-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#F87171', border: '1px solid rgba(248, 113, 113, 0.5)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      KYC REJECTED
                    </span>
                  ) : (
                    <span className="kfpl-badge" style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#FBBF24', border: '1px solid rgba(251, 191, 36, 0.5)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      KYC PENDING
                    </span>
                  )}
                </div>
              </div>
            </div>

            <MissingDocsReuploadCard
              client={client}
              loading={loading}
              onDocUploaded={(docKey, newUrl) => {
                setClient(prev => {
                  const updated = { ...prev, [docKey]: newUrl };
                  try {
                    safeSetLocalStorage('kfpl_client_profile_cache', {
                      client: updated,
                      clientEmail: updated.email || '',
                    });
                    const authData = localStorage.getItem('kfpl_client_auth');
                    if (authData) {
                      const parsed = JSON.parse(authData);
                      if (parsed.client) {
                        parsed.client[docKey] = newUrl;
                        safeSetLocalStorage('kfpl_client_auth', parsed);
                      }
                    }
                  } catch (e) {}
                  return updated;
                });
              }}
            />

            <KycAgreementCard
              agreementUrl={client.agreementDocument}
              agreementVerified={client.agreementDocumentVerified}
              clientName={client.name}
              onUploadSuccess={(newUrl) => {
                setClient(prev => ({ ...prev, agreementDocument: newUrl }));
              }}
            />
            <div className="kfpl-profile-grid">
            {/* Personal Information */}
            <div className="kfpl-card">
              <h3 style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--color-gold)' }}>Personal Information</h3>
              {[
                ['Full Name', client.name],
                ['Email Address', clientEmail],
                ['Phone Number', client.phone],
                ['Date of Birth', client.dob ? new Date(client.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                ['Address', client.address],
                ['Emergency Contact', client.emergencyContact],
              ].map(([label, value]) => (
                <div key={label} className="kfpl-profile-info-row">
                  <span className="kfpl-profile-info-label">{label}</span>
                  <span className="kfpl-profile-info-value">{value}</span>
                </div>
              ))}
            </div>

            {/* Account Details */}
            <div className="kfpl-card">
              <h3 style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--color-gold)' }}>Account Details</h3>
              {[
                ['Client ID', client.clientId, true],
                ['Category', client.category],
                ['Account Status', client.status],
                ['Member Since', client.memberSince ? new Date(client.memberSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                ['Agent', client.agentName ? `${client.agentName} (${formatAgentID(client.agentId)})` : 'Direct Client'],
              ].map(([label, value, isMono]) => (
                <div key={label} className="kfpl-profile-info-row">
                  <span className="kfpl-profile-info-label">{label}</span>
                  <span className={`kfpl-profile-info-value ${isMono ? 'mono' : ''}`}>
                    {label === 'Account Status' ? <span className="kfpl-badge kfpl-badge--active">{value}</span> : value}
                  </span>
                </div>
              ))}
            </div>

            {/* Bank & KYC Details */}
            <div className="kfpl-card">
              <h3 style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--color-gold)' }}>Bank & KYC Details</h3>
              {[
                ['Bank Name', client.bankName || '—'],
                ['Account Number', <SensitiveValueToggle key="acc" value={client.accountNumber || client.accountNo} />],
                ['IFSC Code', <SensitiveValueToggle key="ifsc" value={client.ifscCode || client.ifsc} />],
                ['PAN Card Number', <SensitiveValueToggle key="pan" value={client.panNumber || client.pan} />],
                ['Aadhaar / ID Number', <SensitiveValueToggle key="aadh" value={client.aadhaarNumber || client.aadhaar} />],
              ].map(([label, value]) => (
                <div key={label} className="kfpl-profile-info-row">
                  <span className="kfpl-profile-info-label">{label}</span>
                  <span className="kfpl-profile-info-value">{value}</span>
                </div>
              ))}
            </div>

            {/* Nominee Details */}
            <div className="kfpl-nominee-card">
              <div className="kfpl-nominee-card-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                <h3 style={{ flex: 1 }}>Nominee Details</h3>
              </div>
              {[
                ['Nominee Name', client.nominee?.name],
                ['Relation', client.nominee?.relation],
                ['Contact', <SensitiveValueToggle key="nomcontact" value={client.nominee?.contact} />],
                ['Email Address', client.nominee?.email || 'Not provided'],
              ].map(([label, value]) => (
                <div key={label} className="kfpl-profile-info-row">
                  <span className="kfpl-profile-info-label">{label}</span>
                  <span className="kfpl-profile-info-value">{value}</span>
                </div>
              ))}
            </div>

            {/* Risk Profile */}
            <div className="kfpl-card">
              <h3 style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--color-gold)' }}>Risk Profile</h3>
              {riskProfile && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{riskProfile.icon}</div>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>{riskProfile.label}</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>{riskProfile.description}</p>
                  {client.riskProfileLocked && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: '14px', height: '14px' }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Profile locked after initial selection
                    </div>
                  )}
                  <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/service-requests/new')}>
                    Request Change
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* ==================== TAB 2: Security & Password ==================== */}
        {activeTab === 'security' && (
          <div className="kfpl-profile-grid">
            <div className="kfpl-card">
              <h3 style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--color-gold)' }}>Change Password</h3>

              <div className="kfpl-form">
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="kfpl-input"
                      type={showCurrentPass ? 'text' : 'password'}
                      placeholder="Enter current password"
                      value={passForm.currentPass}
                      disabled={passOtpSent}
                      onChange={e => setPassForm({ ...passForm, currentPass: e.target.value })}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 0 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                        {showCurrentPass ? (
                          <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        ) : (
                          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="kfpl-input"
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={passForm.newPass}
                      disabled={passOtpSent}
                      onChange={e => setPassForm({ ...passForm, newPass: e.target.value })}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 0 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                        {showNewPass ? (
                          <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        ) : (
                          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="kfpl-input"
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={passForm.confirmPass}
                      disabled={passOtpSent}
                      onChange={e => setPassForm({ ...passForm, confirmPass: e.target.value })}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 0 }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                        {showConfirmPass ? (
                          <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                        ) : (
                          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {!passOtpSent ? (
                  <button
                    type="button"
                    className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                    onClick={handleSendPassOtp}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Send OTP
                  </button>
                ) : (
                  <form onSubmit={handleVerifyPassword} className="kfpl-form" style={{ gap: '12px', marginTop: '4px' }}>
                    <div className="kfpl-input-group">
                      <label className="kfpl-input-label">Enter OTP <span className="required">*</span></label>
                      <input
                        className="kfpl-input"
                        type="text"
                        maxLength="6"
                        placeholder="6-digit code"
                        value={passOtpInput}
                        onChange={e => setPassOtpInput(e.target.value.replace(/\D/g, ''))}
                        style={{ letterSpacing: '2px', fontWeight: 600 }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <button type="submit" className="kfpl-btn kfpl-btn--primary kfpl-btn--sm">
                        Verify & Change Password
                      </button>

                      <button
                        type="button"
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        disabled={passResendTimer > 0}
                        onClick={handleSendPassOtp}
                      >
                        {passResendTimer > 0 ? `Resend OTP in ${passResendTimer}s` : 'Resend OTP'}
                      </button>

                      <button
                        type="button"
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        onClick={() => {
                          setPassOtpSent(false);
                          setPassOtpInput('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: Support Desk ==================== */}
        {activeTab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Advisor & Contact Info Cards Row */}
            <div className="kfpl-support-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Email Support Card */}
              <div className="kfpl-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'var(--color-surface, #ffffff)', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text-primary)', margin: '0 0 6px 0' }}>Email Support</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 16px 0', wordBreak: 'break-all' }}>
                  {supportSettings.clientSupportEmail}
                </p>
                <a href={`mailto:${supportSettings.clientSupportEmail}`} className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ width: '100%', justifyContent: 'center', fontWeight: '600' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Send Email
                </a>
              </div>

              {/* Phone Support Card */}
              <div className="kfpl-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'var(--color-surface, #ffffff)', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text-primary)', margin: '0 0 6px 0' }}>Phone Support</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 16px 0' }}>
                  {supportSettings.clientSupportPhone}
                </p>
                <a href={`tel:${supportSettings.clientSupportPhone.replace(/\s/g, '')}`} className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ width: '100%', justifyContent: 'center', background: '#10b981', borderColor: '#10b981', fontWeight: '600' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call Support
                </a>
              </div>

              {/* WhatsApp Support Card */}
              <div className="kfpl-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'var(--color-surface, #ffffff)', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text-primary)', margin: '0 0 6px 0' }}>WhatsApp Support</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 16px 0' }}>
                  +{(supportSettings.clientSupportWhatsapp || '919876543210').replace(/[^0-9]/g, '')}
                </p>
                <a href={`https://wa.me/${(supportSettings.clientSupportWhatsapp || '919876543210').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ width: '100%', justifyContent: 'center', background: '#25D366', borderColor: '#25D366', fontWeight: '600' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Open WhatsApp
                </a>
              </div>
            </div>

            {/* Manager Info panel */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              {client.agentName && client.agentId ? (
                /* Wealth Advisor Card for assigned Agent */
                <div className="kfpl-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px', justifyContent: 'center', maxWidth: '480px', width: '100%' }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)',
                    color: 'var(--color-white)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    fontWeight: '800',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
                    marginBottom: '16px'
                  }}>
                    {client.agentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <span className="kfpl-badge kfpl-badge--gold-tier" style={{ fontSize: '0.625rem', marginBottom: '8px' }}>Wealth Advisor</span>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--color-text-primary)' }}>
                      {client.agentName}
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Senior Relationship Manager (ID: {client.agentId})
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '24px' }}>
                    {client.advisorPhone ? (
                      <a href={`tel:${client.advisorPhone}`} className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ flex: 1, padding: '10px 0' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call Advisor
                      </a>
                    ) : (
                      <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" disabled style={{ flex: 1, padding: '10px 0', opacity: 0.6, cursor: 'not-allowed' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call Advisor
                      </button>
                    )}
                    <a
                      href={client.advisorWhatsApp || (client.advisorPhone ? `https://wa.me/91${client.advisorPhone.replace(/[^0-9]/g, '')}` : 'https://wa.me/919876543210')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                      style={{ flex: 1, padding: '10px 0', background: '#25D366', borderColor: '#25D366' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp
                    </a>
                  </div>

                  <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '16px', lineHeight: 1.4 }}>
                    Our advisory desk is available Mon - Sat, 10 AM to 6 PM IST. For urgent claims, raise a Service Request.
                  </p>
                </div>
              ) : (
                /* Direct Admin Client Card (No Agent Assigned) */
                <div className="kfpl-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px', justifyContent: 'center', maxWidth: '480px', width: '100%' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" style={{ width: 32, height: 32 }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>

                  <div>
                    <span className="kfpl-badge kfpl-badge--ghost" style={{ fontSize: '0.625rem', marginBottom: '8px' }}>Direct Support</span>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--color-text-primary)' }}>Direct Admin Client</h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      No agent assigned. Contact Kinetoscope Super Admin support team directly.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '24px' }}>
                    <a href={`tel:${(supportSettings.clientSupportPhone || '+919876543210').replace(/\s/g, '')}`} className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ flex: 1, padding: '10px 0' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call Support
                    </a>
                    <a href={`https://wa.me/${(supportSettings.clientSupportWhatsapp || '919876543210').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ flex: 1, padding: '10px 0', background: '#25D366', borderColor: '#25D366' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp Support
                    </a>
                  </div>

                  <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '16px', lineHeight: 1.4 }}>
                    Support Desk: {supportSettings.supportHours || 'Mon - Sat, 10 AM to 6 PM IST'}. Email: {supportSettings.clientSupportEmail}.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/* ============ END: Profile.jsx ============ */
