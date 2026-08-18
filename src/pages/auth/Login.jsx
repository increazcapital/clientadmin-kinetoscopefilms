/* ============================================================
   Page: Login.jsx
   Description: Client login & registration with split-screen premium UI
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../../config/apiUrl';
import { safeSetLocalStorage } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';
import { WORLD_COUNTRY_CODES } from '../../data/countryCodes';

export default function Login() {
  const navigate = useNavigate();
  const toastHelper = useToast();
  const addToast = typeof toastHelper === 'function' ? toastHelper : (toastHelper.addToast || (() => {}));

  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp' | 'register'
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'

  // Blocked account reason banner from URL params
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('blocked') === 'true' || params.get('reason')) {
      const reason = params.get('reason') || 'Your account has been deactivated or put on hold. Please contact info@kinetoscopefilms.com for assistance.';
      setBlockedReason(reason);
    }
  }, []);

  // Login credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mockOtp, setMockOtp] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [tempUser, setTempUser] = useState(null);
  const [backendRequiresTfa, setBackendRequiresTfa] = useState(false);

  // Agreement Modal states
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementStep, setAgreementStep] = useState('agreement'); // 'agreement' | 'privacy' | 'tnc'
  const [hasReadAgreement, setHasReadAgreement] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [hasReadTnc, setHasReadTnc] = useState(false);
  const [isSingleDocRead, setIsSingleDocRead] = useState(false);

  // Form Checkbox states
  const [checkedAgreement, setCheckedAgreement] = useState(false);
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [checkedTnc, setCheckedTnc] = useState(false);

  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Register form state
  const [regForm, setRegForm] = useState({
    fullName: '', email: '', phone: '', phoneCountryCode: '+91', dob: '', address: '',
    pan: '', bankName: '', accountNo: '', confirmAccountNo: '', ifsc: '',
    aadhaarNumber: '',
    nomineeName: '', nomineeRelation: '', nomineeContact: '', nomineePhoneCountryCode: '+91', nomineeEmail: '',
    riskProfile: 'Conservative',
    citizenship: 'National',
    nomineeCitizenship: 'National',
    roiPercentage: '0',
    contractStartDate: new Date().toISOString().split('T')[0],
    contractEndDate: '',
    password: '',
    confirmPassword: ''
  });

  // Register File upload states
  const [panFile, setPanFile] = useState(null);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);
  const [bankFile, setBankFile] = useState(null);
  const [nomineeFile, setNomineeFile] = useState(null);
  const [agreementFile, setAgreementFile] = useState(null);

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegForm(prev => {
      let nextValue = value;
      if (name === 'phone' || name === 'nomineeContact') {
        nextValue = value.replace(/\D/g, '').slice(0, 10);
      } else if (name === 'aadhaarNumber' && prev.citizenship === 'National') {
        const digits = value.replace(/\D/g, '').slice(0, 12);
        nextValue = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      }
      return { ...prev, [name]: nextValue };
    });
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter both email and password.'); return; }
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/client/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.requires2FA) {
          const generatedCode = data.otp || data.code || String(Math.floor(100000 + Math.random() * 900000));
          setMockOtp(generatedCode);
          setTempToken(data.token || '');
          setTempUser(data.client || (data.data && data.data.user ? data.data.user : data.data) || data.user || {});
          setBackendRequiresTfa(!!data.requires2FA);
          setStep('otp');
          setError('');
          addToast('Verification code sent to your registered email address.', 'info', '2FA Authentication');
        } else {
          const clientObject = data.client || (data.data && data.data.user ? data.data.user : data.data) || data.user || {};
          safeSetLocalStorage('kfpl_client_auth', { 
            token: data.token, 
            client: { ...clientObject, email, name: clientObject.name || clientObject.fullName || 'Investor' } 
          });
          window.location.href = '/dashboard';
        }
      } else {
        const errorMsg = data.message || data.error || 'Invalid credentials.';
        setError(errorMsg);
        addToast(errorMsg, 'error', 'Login Failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      // fallback to mock check offline
      const storedInvestors = localStorage.getItem('kfpl_investors');
      let localUser = null;
      if (storedInvestors) {
        try {
          const list = JSON.parse(storedInvestors);
          localUser = list.find(inv => inv.email.toLowerCase() === email.toLowerCase());
        } catch (err) {
          console.error(err);
        }
      }

      if (localUser) {
        safeSetLocalStorage('kfpl_client_auth', {
          token: 'mock-jwt-token-12345',
          client: localUser
        });
        addToast('Logged in successfully (Local offline mock)', 'success');
        window.location.href = '/dashboard';
      } else {
        setError('Network error or server unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');
    if (!otp) { setOtpError('Please enter the verification code.'); return; }
    setLoading(true);

    const isTfaEnabled = localStorage.getItem('kfpl_tfa_enabled') === 'true';
    if (isTfaEnabled && !backendRequiresTfa && tempToken && mockOtp && otp === mockOtp) {
      safeSetLocalStorage('kfpl_client_auth', { 
        token: tempToken, 
        client: { ...tempUser, email, name: tempUser.name || tempUser.fullName || 'Investor' } 
      });
      window.location.href = '/dashboard';
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/client/auth/verify-2fa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (response.ok) {
        const clientObject = data.client || (data.data && data.data.user ? data.data.user : data.data) || data.user || {};
        safeSetLocalStorage('kfpl_client_auth', { 
          token: data.token, 
          client: { ...clientObject, email, name: clientObject.name || clientObject.fullName || 'Investor' } 
        });
        window.location.href = '/dashboard';
      } else {
        setOtpError(data.message || 'Invalid OTP.');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setOtpError('Network error or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleAgreementScroll = (e) => {
    const element = e.target;
    const isBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 20;
    if (isBottom) {
      if (agreementStep === 'agreement') {
        setHasReadAgreement(true);
      } else if (agreementStep === 'privacy') {
        setHasReadPrivacy(true);
      } else if (agreementStep === 'tnc') {
        setHasReadTnc(true);
      }
    }
  };

  const handleShowAgreementBeforeRegister = () => {
    setAgreementStep('agreement');
    setIsSingleDocRead(false);
    setHasReadAgreement(false);
    setHasReadPrivacy(false);
    setHasReadTnc(false);
    setCheckedAgreement(false);
    setCheckedPrivacy(false);
    setCheckedTnc(false);
    setShowAgreementModal(true);
  };

  const openSingleDoc = (docType) => {
    setAgreementStep(docType);
    setIsSingleDocRead(docType);
    if (docType === 'agreement') setHasReadAgreement(false);
    if (docType === 'privacy') setHasReadPrivacy(false);
    if (docType === 'tnc') setHasReadTnc(false);
    setShowAgreementModal(true);
  };
  const handleRegisterSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');

    if (!regForm.fullName.trim()) {
      addToast('Please enter your Full Name', 'danger', 'Validation Error');
      setError('Full Name is required.');
      return;
    }
    if (!regForm.email.trim() || !/\S+@\S+\.\S+/.test(regForm.email)) {
      addToast('Please enter a valid Email Address', 'danger', 'Validation Error');
      setError('Valid Email Address is required.');
      return;
    }
    if (!regForm.phone.trim()) {
      addToast('Please enter your Phone Number', 'danger', 'Validation Error');
      setError('Phone Number is required.');
      return;
    }
    if (!regForm.password) {
      addToast('Please enter a Password', 'danger', 'Validation Error');
      setError('Password is required.');
      return;
    }
    if (regForm.password.length < 6) {
      addToast('Password must be at least 6 characters', 'danger', 'Validation Error');
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      addToast('Passwords do not match!', 'danger', 'Validation Error');
      setError('Passwords do not match!');
      return;
    }
    if (regForm.accountNo && regForm.accountNo !== regForm.confirmAccountNo) {
      addToast('Account numbers do not match!', 'danger', 'Validation Error');
      setError('Account numbers do not match!');
      return;
    }

    setLoading(true);

    try {
      // Build form data
      const formData = new FormData();
      formData.append('fullName', regForm.fullName);
      formData.append('email', regForm.email);
      const fullPhone = regForm.phone ? `${regForm.phoneCountryCode} ${regForm.phone.replace(/^\+\d+\s*/, '')}`.trim() : '';
      formData.append('phone', fullPhone);
      if (regForm.dob) formData.append('dob', regForm.dob);
      if (regForm.address) formData.append('address', regForm.address);
      formData.append('riskProfile', regForm.riskProfile);
      formData.append('residencyStatus', regForm.citizenship === 'International' ? 'International' : 'National (Domestic)');
      formData.append('monthlyRoi', regForm.roiPercentage);
      formData.append('contractStartDate', regForm.contractStartDate);
      if (regForm.contractEndDate) formData.append('contractEndDate', regForm.contractEndDate);
      if (regForm.bankName) formData.append('bankName', regForm.bankName);
      if (regForm.accountNo) {
        formData.append('accountNumber', regForm.accountNo);
        formData.append('confirmAccountNumber', regForm.confirmAccountNo);
      }
      if (regForm.ifsc) formData.append('ifscCode', regForm.ifsc);
      if (regForm.pan) formData.append('panNumber', regForm.pan);
      if (regForm.aadhaarNumber) formData.append('aadhaarNumber', regForm.aadhaarNumber.replace(/\s/g, ''));

      if (regForm.nomineeName) {
        formData.append('nomineeName', regForm.nomineeName);
        formData.append('nomineeRelation', regForm.nomineeRelation);
        const fullNomineePhone = regForm.nomineeContact ? `${regForm.nomineePhoneCountryCode} ${regForm.nomineeContact.replace(/^\+\d+\s*/, '')}`.trim() : '';
        formData.append('nomineePhone', fullNomineePhone);
        formData.append('nomineeEmail', regForm.nomineeEmail);
        formData.append('nomineeResidency', regForm.nomineeCitizenship === 'International' ? 'International' : 'National (Domestic)');
      }

      formData.append('tier', 'SILVER');
      formData.append('password', regForm.password);
      formData.append('portalPassword', regForm.password);
      formData.append('is2FAEnabled', 'false');

      // Append files
      if (panFile) formData.append('panDocument', panFile);
      if (aadhaarFile) formData.append('aadhaarDocument', aadhaarFile);
      if (aadhaarBackFile) formData.append('aadhaarBackDocument', aadhaarBackFile);
      if (bankFile) formData.append('bankProofDocument', bankFile);
      if (nomineeFile) formData.append('nomineeProofDocument', nomineeFile);
      if (agreementFile) formData.append('agreementDocument', agreementFile);

      // Submit to backend
      const response = await fetch(getApiUrl('/api/client/auth/register'), {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();

      if (response.ok) {
        const localClientObj = syncLocalClient(resData.data?.clientCode || resData.clientCode);
        const token = resData.token || 'mock-jwt-token-12345';
        const clientPayload = resData.data?.client || resData.data?.profile || localClientObj || {
          email: regForm.email,
          name: regForm.fullName
        };
        localStorage.setItem('kfpl_client_auth', JSON.stringify({
          token,
          client: {
            ...clientPayload,
            name: clientPayload.fullName || clientPayload.name || regForm.fullName || 'Investor',
            email: regForm.email
          }
        }));
        addToast('Account created successfully! Welcome to Kinetoscope.', 'success', 'Account Created');
        window.location.href = '/dashboard';
      } else {
        const errorMsg = resData.message || resData.error || 'Registration failed. Please check your inputs.';
        setError(errorMsg);
        addToast(errorMsg, 'danger', 'Error');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Network error or server unavailable.');
      addToast(err.message || 'Network error', 'danger', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const syncLocalClient = (backendCode) => {
    let list = [];
    const stored = localStorage.getItem('kfpl_investors');
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) { console.error(e); }
    }
    const nextId = list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
    const rawClientCode = backendCode || `KFPL-CL-${1000 + nextId}`;
    let clientCode = rawClientCode;
    if (rawClientCode) {
      const str = String(rawClientCode).trim();
      if (/^KFPL-CL-\d+$/i.test(str)) {
        clientCode = str.toUpperCase();
      } else {
        const digitsMatch = str.match(/\d+/);
        if (digitsMatch) {
          let val = parseInt(digitsMatch[0], 10);
          if (val < 1000) val = 1000 + val;
          clientCode = `KFPL-CL-${val}`;
        }
      }
    }

    const newClientObj = {
      id: nextId,
      name: regForm.fullName,
      clientId: clientCode,
      email: regForm.email,
      phone: regForm.phone,
      dob: regForm.dob,
      address: regForm.address,
      category: 'silver',
      status: 'active',
      totalInvestment: 0,
      roiPercentage: parseFloat(regForm.roiPercentage) || 0,
      joinDate: regForm.contractStartDate,
      contractEndDate: regForm.contractEndDate,
      kyc: 'Verified',
      pan: regForm.pan,
      bankName: regForm.bankName,
      accountNo: regForm.accountNo,
      ifsc: regForm.ifsc,
      riskProfile: regForm.riskProfile,
      citizenship: regForm.citizenship,
      investments: [],
      roiHistory: [],
      perks: [],
      nominee: {
        name: regForm.nomineeName,
        relation: regForm.nomineeRelation,
        contact: regForm.nomineeContact,
        email: regForm.nomineeEmail,
        citizenship: regForm.nomineeCitizenship,
      }
    };

    list.push(newClientObj);
    localStorage.setItem('kfpl_investors', JSON.stringify(list));

    // Also update current active user session under email key
    localStorage.setItem(`kfpl_client_session_${regForm.email.toLowerCase()}`, JSON.stringify(newClientObj));
  };

  return (
    <div className="kfpl-login">
      {/* Left Column: Cinema Wallpaper */}
      <div className="kfpl-login-wallpaper">
        <div className="kfpl-login-brand">
          <div style={{ background: '#ffffff', padding: '6px', width: '68px', height: '68px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginBottom: '16px' }}>
            <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px', display: 'block' }} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.15 }}>Kinetoscope Films Pvt Ltd</h1>
          <p style={{ fontSize: '12px', color: 'rgba(240, 253, 244, 0.9)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '6px', marginBottom: '12px', fontWeight: '700' }}>A Global Media Fund</p>
          <p>Portfolio investing at your fingertips. Track assets, manage transactions, and claim exclusive tier rewards.</p>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="kfpl-login-panel">
        <div className="kfpl-login-card animate-scale-in">
          {/* Logo */}
          <div className="kfpl-login-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', padding: '6px', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.18)', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px', display: 'block' }} />
            </div>
            <h1 className="kfpl-login-title">Investor Dashboard</h1>
            <p className="kfpl-login-subtitle">Access your media production portfolio</p>
          </div>

          {/* Toggle Tabs (Only show if not in OTP step) */}
          {step !== 'otp' && (
            <div className="kfpl-login-tabs">
              <button 
                type="button" 
                className={`kfpl-login-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => { setActiveTab('login'); setStep('credentials'); setError(''); }}
              >
                Log In
              </button>
              <button 
                type="button" 
                className={`kfpl-login-tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={handleShowAgreementBeforeRegister}
              >
                Create Account
              </button>
            </div>
          )}

          {/* STEP 1: CREDENTIALS (LOGIN) */}
          {step === 'credentials' && activeTab === 'login' && (
            <div className="animate-fade-in">
              {blockedReason && (
                <div className="kfpl-login-error" style={{ background: '#fffbe5', borderColor: '#fde047', color: '#854d0e', marginBottom: '16px', padding: '12px 14px', borderRadius: '10px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: '#d97706', width: '20px', height: '20px', flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div style={{ fontSize: '0.8125rem', lineHeight: '1.45' }}>
                    <strong>Account Status:</strong> {blockedReason.includes('info@kinetoscopefilms.com') ? blockedReason : `${blockedReason} Please contact `}
                    {!blockedReason.includes('info@kinetoscopefilms.com') && (
                      <a href="mailto:info@kinetoscopefilms.com" style={{ color: '#b45309', fontWeight: '700', textDecoration: 'underline', marginLeft: '4px' }}>
                        info@kinetoscopefilms.com
                      </a>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="kfpl-login-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form className="kfpl-login-form" onSubmit={handleCredentialsSubmit}>
                <div className="kfpl-login-input-group">
                  <label className="kfpl-login-label">Email Address</label>
                  <input
                    type="email"
                    className="kfpl-login-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="kfpl-login-input-group">
                  <label className="kfpl-login-label">Password</label>
                  <div className="kfpl-login-password-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="kfpl-login-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="kfpl-login-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="kfpl-login-options">
                  <label className="kfpl-login-remember">
                    <input type="checkbox" /> Remember me
                  </label>
                  <span className="kfpl-login-forgot" onClick={() => navigate('/forgot-password')}>
                    Forgot Password?
                  </span>
                </div>

                <button type="submit" className="kfpl-login-btn" disabled={loading}>
                  {loading ? 'Logging in...' : 'Log In'}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: REGISTER (CREATE ACCOUNT) */}
          {step === 'register' && activeTab === 'register' && (
            <div className="animate-fade-in">
              {error && (
                <div className="kfpl-login-error">
                  <span>{error}</span>
                </div>
              )}

              <form className="kfpl-login-form" onSubmit={handleRegisterSubmit}>
                <div className="kfpl-login-register-scroll">
                  {/* Basic Info */}
                  <div className="kfpl-login-section-label">Basic Information</div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Full Name *</label>
                    <input type="text" name="fullName" className="kfpl-login-input" placeholder="Enter your name" value={regForm.fullName} onChange={handleRegisterChange} required />
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Email Address *</label>
                    <input type="email" name="email" className="kfpl-login-input" placeholder="Enter your email address" value={regForm.email} onChange={handleRegisterChange} required />
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Phone Number *</label>
                    <div className="kfpl-phone-unified-wrap">
                      <select name="phoneCountryCode" value={regForm.phoneCountryCode} onChange={handleRegisterChange}>
                        {WORLD_COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <input type="tel" name="phone" maxLength={10} placeholder="10-digit mobile number" value={regForm.phone} onChange={handleRegisterChange} required />
                    </div>
                  </div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Date of Birth</label>
                      <input type="date" name="dob" className="kfpl-login-input" value={regForm.dob} onChange={handleRegisterChange} />
                    </div>
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Risk Profile</label>
                      <select name="riskProfile" className="kfpl-login-input" value={regForm.riskProfile} onChange={handleRegisterChange}>
                        <option value="Conservative">Conservative</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Aggressive">Aggressive</option>
                      </select>
                    </div>
                  </div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Citizenship</label>
                      <select name="citizenship" className="kfpl-login-input" value={regForm.citizenship} onChange={handleRegisterChange}>
                        <option value="National">National (Domestic)</option>
                        <option value="International">International</option>
                      </select>
                    </div>
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Address</label>
                    <input type="text" name="address" className="kfpl-login-input" placeholder="Enter your address" value={regForm.address} onChange={handleRegisterChange} />
                  </div>

                  {/* KYC & Bank Details */}
                  <div className="kfpl-login-section-label">KYC & Bank Details</div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">{regForm.citizenship === 'International' ? 'Tax ID / SSN *' : 'PAN Number *'}</label>
                      <input type="text" name="pan" className="kfpl-login-input" placeholder={regForm.citizenship === 'International' ? 'Enter Tax ID / SSN' : 'Enter PAN number'} value={regForm.pan} onChange={handleRegisterChange} required />
                    </div>
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">{regForm.citizenship === 'International' ? 'Passport / ID *' : 'Aadhaar Number *'}</label>
                      <input type="text" name="aadhaarNumber" className="kfpl-login-input" placeholder={regForm.citizenship === 'International' ? 'Enter Passport number' : 'Enter Aadhaar number'} value={regForm.aadhaarNumber} onChange={handleRegisterChange} required />
                    </div>
                  </div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Bank Name *</label>
                      <input type="text" name="bankName" className="kfpl-login-input" placeholder="Enter bank name" value={regForm.bankName} onChange={handleRegisterChange} required />
                    </div>
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">{regForm.citizenship === 'International' ? 'IFSC / SWIFT *' : 'IFSC Code *'}</label>
                      <input type="text" name="ifsc" className="kfpl-login-input" placeholder="Enter IFSC code" value={regForm.ifsc} onChange={handleRegisterChange} required />
                    </div>
                  </div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Account No *</label>
                      <input type="password" name="accountNo" className="kfpl-login-input" placeholder="Enter account number" value={regForm.accountNo} onChange={handleRegisterChange} required />
                    </div>
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Confirm Account No *</label>
                      <input type="text" name="confirmAccountNo" className="kfpl-login-input" placeholder="Confirm account number" value={regForm.confirmAccountNo} onChange={handleRegisterChange} required />
                    </div>
                  </div>

                  {/* Nominee Details */}
                  <div className="kfpl-login-section-label">Nominee Details</div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Nominee Name</label>
                      <input type="text" name="nomineeName" className="kfpl-login-input" placeholder="Enter nominee name" value={regForm.nomineeName} onChange={handleRegisterChange} />
                    </div>
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Relation</label>
                      <select name="nomineeRelation" className="kfpl-login-input" value={regForm.nomineeRelation} onChange={handleRegisterChange}>
                        <option value="">Select Relation</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Child">Child</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Nominee Phone</label>
                    <div className="kfpl-phone-unified-wrap">
                      <select name="nomineePhoneCountryCode" value={regForm.nomineePhoneCountryCode} onChange={handleRegisterChange}>
                        {WORLD_COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <input type="tel" name="nomineeContact" maxLength={10} placeholder="10-digit phone number" value={regForm.nomineeContact} onChange={handleRegisterChange} />
                    </div>
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Nominee Email</label>
                    <input type="email" name="nomineeEmail" className="kfpl-login-input" placeholder="Enter nominee email" value={regForm.nomineeEmail} onChange={handleRegisterChange} />
                  </div>

                  {/* Documents Upload */}
                  <div className="kfpl-login-section-label">KYC Document Uploads</div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">{regForm.citizenship === 'International' ? 'Tax ID Upload *' : 'PAN Card *'}</label>
                    <input type="file" className="kfpl-login-input" onChange={(e) => setPanFile(e.target.files[0])} />
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">{regForm.citizenship === 'International' ? 'Passport / National ID (Front Side) *' : 'Aadhaar Card (Front Side) *'}</label>
                    <input type="file" className="kfpl-login-input" onChange={(e) => setAadhaarFile(e.target.files[0])} />
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">{regForm.citizenship === 'International' ? 'National ID / Address Proof (Back Side) *' : 'Aadhaar Card Back Side (Required for Address Proof) *'}</label>
                    <input type="file" className="kfpl-login-input" onChange={(e) => setAadhaarBackFile(e.target.files[0])} />
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Cancelled Cheque (Optional)</label>
                    <input type="file" className="kfpl-login-input" onChange={(e) => setBankFile(e.target.files[0])} />
                  </div>
                  <div className="kfpl-login-input-group">
                    <label className="kfpl-login-label">Nominee Proof Document (Optional)</label>
                    <input type="file" className="kfpl-login-input" onChange={(e) => setNomineeFile(e.target.files[0])} />
                  </div>


                  {/* Password Configuration */}
                  <div className="kfpl-login-section-label">Portal Password</div>
                  <div className="kfpl-login-form-row">
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Password *</label>
                      <div className="kfpl-login-password-wrap">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          name="password"
                          className="kfpl-login-input"
                          placeholder="Enter your password"
                          value={regForm.password}
                          onChange={handleRegisterChange}
                          required
                        />
                        <button
                          type="button"
                          className="kfpl-login-password-toggle"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                        >
                          {showRegPassword ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="kfpl-login-input-group">
                      <label className="kfpl-login-label">Confirm Password *</label>
                      <div className="kfpl-login-password-wrap">
                        <input
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          className="kfpl-login-input"
                          placeholder="Confirm your password"
                          value={regForm.confirmPassword}
                          onChange={handleRegisterChange}
                          required
                        />
                        <button
                          type="button"
                          className="kfpl-login-password-toggle"
                          onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        >
                          {showRegConfirmPassword ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Agreement Checkboxes */}
                  <div style={{ marginTop: '22px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label className="kfpl-login-checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.825rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input 
                        type="checkbox" 
                        checked={checkedAgreement} 
                        onChange={(e) => setCheckedAgreement(e.target.checked)}
                        style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--color-gold)' }} 
                      />
                      <span>
                        I agree to the <span style={{ color: 'var(--color-gold)', textDecoration: 'underline', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); openSingleDoc('agreement'); }}>Media Financing Participation Agreement</span> *
                      </span>
                    </label>

                    <label className="kfpl-login-checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.825rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input 
                        type="checkbox" 
                        checked={checkedPrivacy} 
                        onChange={(e) => setCheckedPrivacy(e.target.checked)}
                        style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--color-gold)' }} 
                      />
                      <span>
                        I agree to the <span style={{ color: 'var(--color-gold)', textDecoration: 'underline', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); openSingleDoc('privacy'); }}>Privacy Policy</span> *
                      </span>
                    </label>

                    <label className="kfpl-login-checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.825rem', cursor: 'pointer', fontWeight: 600 }}>
                      <input 
                        type="checkbox" 
                        checked={checkedTnc} 
                        onChange={(e) => setCheckedTnc(e.target.checked)}
                        style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--color-gold)' }} 
                      />
                      <span>
                        I agree to the <span style={{ color: 'var(--color-gold)', textDecoration: 'underline', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); openSingleDoc('tnc'); }}>Terms & Conditions</span> *
                      </span>
                    </label>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="kfpl-login-btn" 
                  style={{ 
                    marginTop: '20px', 
                    background: (checkedAgreement && checkedPrivacy && checkedTnc) ? 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)' : '#e2e8f0', 
                    color: (checkedAgreement && checkedPrivacy && checkedTnc) ? '#ffffff' : '#94a3b8',
                    boxShadow: (checkedAgreement && checkedPrivacy && checkedTnc) ? '0 4px 20px rgba(16, 185, 129, 0.2)' : 'none',
                    cursor: (checkedAgreement && checkedPrivacy && checkedTnc) ? 'pointer' : 'not-allowed'
                  }} 
                  disabled={loading || !checkedAgreement || !checkedPrivacy || !checkedTnc}
                >
                  {loading ? 'Creating Account...' : 'Register'}
                </button>
              </form>
            </div>
          )}

          {/* TWO-FACTOR AUTHENTICATION STEP */}
          {step === 'otp' && (
            <div className="animate-fade-in">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div className="kfpl-login-tfa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>Two-Factor Authentication</h2>
                <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4 }}>
                  We sent a verification code to your email.<br />Please enter the 6-digit code below.
                </p>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  wordBreak: 'break-all'
                }}>
                  <span>OTP sent to your email: <strong>{email}</strong></span>
                </div>
              </div>

              {otpError && (
                <div className="kfpl-login-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{otpError}</span>
                </div>
              )}

              <form className="kfpl-login-form" onSubmit={handleOtpSubmit}>
                <div className="kfpl-login-input-group">
                  <label className="kfpl-login-label" style={{ color: '#0F172A', fontWeight: 600 }}>Verification Code</label>
                  <input
                    type="text"
                    maxLength="6"
                    className="kfpl-login-input"
                    placeholder="Enter verification code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="kfpl-login-btn"
                    style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-gold)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: 'none' }}
                    onClick={() => {
                      setStep('credentials');
                      setOtp('');
                      setOtpError('');
                    }}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button type="submit" className="kfpl-login-btn" style={{ flex: 2 }} disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="kfpl-login-footer">
            © 2026 Kinetoscope Films Pvt Ltd. All rights reserved.
          </div>
        </div>
      </div>

      {/* Media Financing Participation Agreement & Legal Docs Modal */}
      {showAgreementModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '680px',
            padding: '36px', boxShadow: '0 30px 60px -15px rgba(15, 23, 42, 0.25)',
            display: 'flex', flexDirection: 'column', maxHeight: '92vh',
            border: '1px solid rgba(241, 245, 249, 0.8)',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Elegant Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.6rem', color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
                {agreementStep === 'agreement' && '1. Media Financing Participation Agreement'}
                {agreementStep === 'privacy' && '2. Privacy Policy'}
                {agreementStep === 'tnc' && '3. Terms & Conditions'}
              </h3>
              {!isSingleDocRead && (
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-gold, #10b981)', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '100px' }}>
                  {agreementStep === 'agreement' && 'Step 1 of 3'}
                  {agreementStep === 'privacy' && 'Step 2 of 3'}
                  {agreementStep === 'tnc' && 'Step 3 of 3'}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '24px', lineHeight: '1.5', margin: 0 }}>
              Please scroll down to read and accept the terms completely to proceed.
            </p>

            {agreementStep === 'agreement' && (

            <div 
              onScroll={handleAgreementScroll}
              className="kfpl-legal-scroll"
              style={{
                height: '480px', overflowY: 'auto', border: '1px solid #e2e8f0',
                borderRadius: '14px', padding: '24px', background: '#f8fafc',
                fontSize: '0.825rem', lineHeight: '1.7', color: '#334155',
                marginBottom: '24px', scrollbarWidth: 'thin'
              }}
            >
              <h4 style={{ textAlign: 'center', fontWeight: 800, marginBottom: '4px', color: '#0f172a' }}>MEDIA FINANCING PARTICIPATION AGREEMENT</h4>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '20px' }}>(Production & Pre-Production Financing – India)</p>
              
              <p>This Media Financing Participation Agreement (“<strong>Agreement</strong>”) is entered into on this <u>&nbsp; {new Date().getDate()} &nbsp;</u> day of <u>&nbsp; {new Date().toLocaleString('default', { month: 'long' })} &nbsp;</u> 20<u>{String(new Date().getFullYear()).slice(2)}</u> (“<strong>Effective Date</strong>”)</p>
              
              <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>PARTIES:</h5>
              <p style={{ margin: '0 0 8px' }}><strong>KFPL Media Fund</strong>, a Private Limited Company incorporated under the laws of India, having its registered office at Mumbai, India (“<strong>Media Platform</strong>” or “<strong>Company</strong>”);</p>
              <p style={{ margin: '0 0 8px' }}>AND</p>
              <p style={{ margin: '0 0 16px' }}><strong>{regForm.fullName || '[Participating Party Name]'}</strong>, an individual / body corporate having its address at {regForm.address || '__________________________'} (“<strong>Participating Party</strong>”).</p>
              
              <p>The Company and the Participating Party are hereinafter individually referred to as a “Party” and collectively as the “Parties”.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>1. DEFINITIONS & INTERPRETATION</h5>
              <p style={{ margin: '0 0 10px' }}>1.1 “<strong>Media Platform</strong>” means a professionally managed media production and financing entity engaged in:<br />
              • development, production, co-production, and exploitation of motion pictures and audio-visual content; and<br />
              • provision of pre-production, development, and bridge financing for film projects primarily in India.</p>
              <p style={{ margin: '0 0 10px' }}>1.2 “<strong>Participation Amount</strong>” means INR <u>&nbsp; {regForm.investmentAmount || '__________'} &nbsp;</u> contributed by the Participating Party pursuant to this Agreement.</p>
              <p style={{ margin: '0 0 10px' }}>1.3 “<strong>Cooling-Off Period</strong>” means a period of sixty (60) days commencing from the Effective Date.</p>
              <p style={{ margin: '0 0 10px' }}>1.4 “<strong>Deployment Date</strong>” means the date immediately following expiry of the Cooling-Off Period, upon which the Participation Amount is deemed commercially deployed.</p>
              <p style={{ margin: '0 0 10px' }}>1.5 “<strong>Contract Period</strong>” means eighteen (18) months, commencing from the Deployment Date.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>2. REGULATORY CHARACTERISATION</h5>
              <p style={{ margin: '0 0 10px' }}>2.1 The Parties expressly acknowledge that this Agreement:<br />
              • does not constitute a Collective Investment Scheme under Section 11AA of the SEBI Act, 1992;<br />
              • does not involve pooling of funds managed as a scheme or fund;<br />
              • does not constitute a deposit, debenture, or public solicitation; and<br />
              • represents a bilateral commercial participation arrangement in media production activities.</p>
              <p style={{ margin: '0 0 10px' }}>2.2 The Participating Party confirms that:<br />
              • participation arises from private commercial discussions;<br />
              • no public offer, prospectus, or solicitation has been made; and<br />
              • independent assessment of commercial risks has been undertaken.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>3. COOLING-OFF PERIOD</h5>
              <p style={{ margin: '0 0 10px' }}>3.1 A mandatory Cooling-Off Period of sixty (60) days shall apply from the Effective Date.</p>
              <p style={{ margin: '0 0 10px' }}>3.2 During the Cooling-Off Period:<br />
              • the Participation Amount shall not be deemed deployed; and<br />
              • no commercial return shall accrue.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>4. NATURE OF PARTICIPATION</h5>
              <p style={{ margin: '0 0 10px' }}>4.1 The Participation Amount represents a commercial participation contribution for media production and pre-production financing activities.</p>
              <p style={{ margin: '0 0 10px' }}>4.2 Nothing in this Agreement shall be construed as:<br />
              • an assured or risk-free investment;<br />
              • a lending or deposit arrangement;<br />
              • a partnership, joint venture, or agency; or<br />
              • conferring managerial or control rights.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>5. COMMENCEMENT & DEPLOYMENT</h5>
              <p style={{ margin: '0 0 10px' }}>5.1 The Participation Amount shall be deemed commercially deployed only upon expiry of the Cooling-Off Period.</p>
              <p style={{ margin: '0 0 10px' }}>5.2 The Contract Period of eighteen (18) months shall commence from the Deployment Date.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>6. COMMERCIAL PARTICIPATION ENTITLEMENT</h5>
              <p style={{ margin: '0 0 10px' }}>6.1 Subject to this Agreement, the Participating Party shall be entitled to a commercial participation entitlement of up to five percent (5%) per month, calculated on the Participation Amount deployed.</p>
              <p style={{ margin: '0 0 10px' }}>6.2 Such entitlement shall:<br />
              • accrue on a daily pro-rated basis;<br />
              • be calculated monthly; and<br />
              • be subject to availability of operational and project cash flows.</p>
              <p style={{ margin: '0 0 10px' }}>6.3 The stated rate represents a maximum contractual cap, and not an assured outcome.</p>
              <p style={{ margin: '0 0 10px' }}>6.4 At the end of the contract period, the Participating Party shall be entitled to a one-off commercial participation entitlement of up to ten percent (10%), calculated on the Participation Amount deployed to compensate for the cooling period.</p>
              <p style={{ margin: '0 0 10px' }}>6.5 Where any Project funded (in whole or in part) using the Participation Amount achieves Net Profits After Tax for the Media Platform in excess of one hundred percent (100%) of the Gross Project Cost funded by the Media Platform for such Project, the Participating Party shall be eligible for an additional performance-linked commercial participation.</p>
              
              <p style={{ margin: '0 0 10px' }}>6.5.1 Such performance-linked participation shall be:<br />
              • capped at up to twenty percent (20%) of the Net Profits After Tax generated by the relevant Project; and<br />
              • calculated on a pro-rata basis, based on the ratio of the Participating Party’s Participation Amount deployed towards such Project to the Gross Project Cost funded by the Media Platform for that Project.</p>
              
              <p style={{ margin: '0 0 10px' }}>6.5.2 The Parties agree that:<br />
              • entitlement under this Clause is conditional upon actual realisation of Net Profits After Tax;<br />
              • no minimum, fixed, or guaranteed upside is implied; and<br />
              • such participation represents a commercial performance incentive rather than a return on capital.</p>
              
              <p style={{ margin: '0 0 10px' }}>6.5.3 Any distribution under this Clause shall be made:<br />
              • only after completion of final project accounts; and<br />
              • subject to statutory deductions and applicable taxes.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>7. PAYMENT MECHANISM</h5>
              <p style={{ margin: '0 0 10px' }}>7.1 Monthly commercial settlement shall:<br />
              • be calculated at the end of each calendar month following the Deployment Date; and<br />
              • be payable within ten (10) days of the subsequent month.</p>
              <p style={{ margin: '0 0 10px' }}>7.2 For avoidance of doubt, no payment shall be due in the same month as deployment.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>8. DEFERRED COMMERCIAL SETTLEMENT (FALLBACK CLAUSE)</h5>
              <p style={{ margin: '0 0 10px' }}>8.1 In the event monthly settlement cannot be made within the prescribed timeline due to:<br />
              • production cash flow timing;<br />
              • delays in monetisation or receivables; or<br />
              • operational, regulatory, or industry constraints,<br />
              such delay shall not constitute a default.</p>
              <p style={{ margin: '0 0 10px' }}>8.2 Any unpaid accrued entitlement shall:<br />
              • be carried forward on a non-compounding basis; and<br />
              • be settled on a rolling basis once sufficient cash flows are realised.</p>
              <p style={{ margin: '0 0 10px' }}>8.3 Deferred settlement shall not be construed as:<br />
              • interest;<br />
              • penalty;<br />
              • guaranteed compensation; or<br />
              • a lending obligation.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>9. MANAGEMENT & CONTROL</h5>
              <p style={{ margin: '0 0 10px' }}>9.1 The Media Platform shall retain sole and absolute discretion over:<br />
              • project selection;<br />
              • budgets and timelines;<br />
              • creative and commercial decisions; and<br />
              • distribution strategy.</p>
              <p style={{ margin: '0 0 10px' }}>9.2 The Participating Party shall have no voting, veto, or approval rights.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>10. INTELLECTUAL PROPERTY</h5>
              <p style={{ margin: '0 0 10px' }}>10.1 All intellectual property created or acquired shall vest exclusively with the Media Platform.</p>
              <p style={{ margin: '0 0 10px' }}>10.2 The Participating Party shall have no ownership or moral rights in any copyright or IP.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>11. RISK ACKNOWLEDGEMENT</h5>
              <p style={{ margin: '0 0 10px' }}>11.1 The Participating Party acknowledges that media production and financing involve commercial variables, including production timelines, market conditions, and distribution outcomes, which may impact performance.</p>
              <p style={{ margin: '0 0 10px' }}>11.2 The Participating Party confirms that participation is undertaken after independent evaluation of the commercial model and with an understanding of the inherent business considerations associated with the media industry.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>12. REDEMPTION & EXPIRY</h5>
              <p style={{ margin: '0 0 10px' }}>12.1 Upon expiry of the Contract Period, the Media Platform shall return the principal Participation Amount within thirty (30) days, subject to reconciliation.</p>
              <p style={{ margin: '0 0 10px' }}>12.2 No early redemption shall be permitted unless agreed in writing.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>13. CONFIDENTIALITY</h5>
              <p style={{ margin: '0 0 10px' }}>All commercial, financial, and project-related information shall remain confidential and survive termination.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>14. DISPUTE RESOLUTION</h5>
              <p style={{ margin: '0 0 10px' }}>Any dispute shall be resolved by arbitration under the Arbitration and Conciliation Act, 1996, seated in Mumbai, India, conducted in English.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>15. GOVERNING LAW</h5>
              <p style={{ margin: '0 0 10px' }}>This Agreement shall be governed by and construed in accordance with the laws of India.</p>

              <h5 style={{ fontWeight: 700, marginTop: '20px', marginBottom: '6px', color: '#1e293b' }}>16. MISCELLANEOUS</h5>
              <p style={{ margin: '0 0 10px' }}><strong>16.1 Taxation</strong><br />
              16.1.1 All taxes, duties, levies, or statutory charges (including income tax, withholding tax, or any similar impost) arising in connection with the commercial participation or any amounts payable to the Participating Party under this Agreement shall be borne and discharged by the Participating Party independently, in accordance with applicable laws.<br />
              16.1.2 The Media Platform shall not be responsible for:<br />
              • the tax treatment of amounts received by the Participating Party; or<br />
              • any indirect tax obligations of the Participating Party.<br />
              16.1.3 Where the Media Platform is required under applicable law to withhold or deduct taxes at source, such deduction shall be made in compliance with law, and the net amount paid shall be deemed to constitute full settlement of the amount payable.</p>
              
              <p style={{ margin: '0 0 10px' }}><strong>16.2 Entire Agreement</strong><br />
              This Agreement constitutes the entire understanding between the Parties in relation to the subject matter hereof and supersedes all prior discussions, representations, negotiations, or arrangements, whether written or oral.</p>
              
              <p style={{ margin: '0 0 10px' }}><strong>16.3 Amendments</strong><br />
              No modification, amendment, or waiver of any provision of this Agreement shall be valid unless made in writing and executed by duly authorised representatives of both Parties.</p>
              
              <p style={{ margin: '0 0 10px' }}><strong>16.4 Severability</strong><br />
              If any provision of this Agreement is held to be invalid, unlawful, or unenforceable by a court or arbitral tribunal of competent jurisdiction, such provision shall be severed to the extent necessary, and the remaining provisions shall continue in full force and effect.</p>
              
              <p style={{ margin: '0 0 10px' }}><strong>16.5 Electronic Execution</strong><br />
              This Agreement may be executed:<br />
              • electronically;<br />
              • in counterparts; or<br />
              • by digital or scanned signatures,<br />
              each of which shall be deemed an original, and all of which together shall constitute one and the same instrument.</p>
              
              <p style={{ margin: '0 0 10px' }}><strong>16.6 No Waiver</strong><br />
              Failure or delay by either Party in exercising any right under this Agreement shall not operate as a waiver of such right, nor shall any single or partial exercise preclude further exercise of that or any other right.</p>
              
              <p style={{ margin: '0 0 10px' }}><strong>16.7 Assignment</strong><br />
              The Participating Party shall not assign or transfer any rights or obligations under this Agreement without the prior written consent of the Media Platform.</p>

              <h5 style={{ fontWeight: 700, marginTop: '24px', marginBottom: '8px', color: '#1e293b' }}>SIGNATURES:</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px', fontSize: '0.75rem' }}>
                <div>
                  <p style={{ margin: 0 }}><strong>For KFPL Media Fund</strong></p>
                  <p style={{ margin: '4px 0 0' }}>Name: Authorized Representative</p>
                  <p style={{ margin: '2px 0 0' }}>Designation: Director</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>For Participating Party</strong></p>
                  <p style={{ margin: '4px 0 0' }}>Name: {regForm.fullName || '__________________________'}</p>
                  <p style={{ margin: '2px 0 0' }}>Signature: [Executed Electronically]</p>
                </div>
              </div>
            </div>
            )}

            {/* Step 2: Privacy Policy text content */}
            {agreementStep === 'privacy' && (
              <div 
                onScroll={handleAgreementScroll}
                className="kfpl-legal-scroll"
                style={{
                  height: '480px', overflowY: 'auto', border: '1px solid #e2e8f0',
                  borderRadius: '14px', padding: '24px', background: '#f8fafc',
                  fontSize: '0.825rem', lineHeight: '1.7', color: '#334155',
                  marginBottom: '24px', scrollbarWidth: 'thin'
                }}
              >
                <h4 style={{ textAlign: 'center', fontWeight: 800, marginBottom: '4px', color: '#0f172a' }}>KINETOSCOPE PRIVACY POLICY</h4>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '20px' }}>Last Updated: July 13, 2026</p>
                
                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>1. INFORMATION WE COLLECT</h5>
                <p style={{ margin: '0 0 10px' }}>We collect personal information that you provide to us directly during account registration, including your full name, email address, phone number, physical address, date of birth, and identity documentation (such as PAN, Aadhaar, and banking verification details).</p>
                
                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>2. HOW WE USE YOUR INFORMATION</h5>
                <p style={{ margin: '0 0 10px' }}>Your personal information is used exclusively to facilitate identity verification (KYC), process media financing agreements, manage portfolio returns, calculate entitlements, send transaction updates, and comply with the governing financial and corporate regulations in India.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>3. DATA PROTECTION & SECURITY</h5>
                <p style={{ margin: '0 0 10px' }}>We execute rigorous technical and organizational security controls to shield your personal details from unauthorized modification, deletion, disclosure, or access. All sensitive identity files are encrypted in transit and at rest.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>4. INFORMATION SHARING</h5>
                <p style={{ margin: '0 0 10px' }}>We do not sell, lease, or distribute your personal details to third-party advertising companies. Data sharing is limited to registered banking partners, compliance professionals, and regulatory authorities to execute transaction validation and security checks.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>5. DATA RETENTION</h5>
                <p style={{ margin: '0 0 10px' }}>We retain your personal data only for as long as is necessary to fulfill the legal and contractual business tasks outlined in our media financing programs, or as required by regulatory compliance norms.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>6. PRIVACY INQUIRIES</h5>
                <p style={{ margin: '0 0 10px' }}>If you have any questions or require updates regarding your data rights or storage, please reach out to the administrator panel at support@kinetoscope.com.</p>
              </div>
            )}

            {/* Step 3: Terms & Conditions text content */}
            {agreementStep === 'tnc' && (
              <div 
                onScroll={handleAgreementScroll}
                className="kfpl-legal-scroll"
                style={{
                  height: '480px', overflowY: 'auto', border: '1px solid #e2e8f0',
                  borderRadius: '14px', padding: '24px', background: '#f8fafc',
                  fontSize: '0.825rem', lineHeight: '1.7', color: '#334155',
                  marginBottom: '24px', scrollbarWidth: 'thin'
                }}
              >
                <h4 style={{ textAlign: 'center', fontWeight: 800, marginBottom: '4px', color: '#0f172a' }}>KINETOSCOPE TERMS OF SERVICE</h4>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '20px' }}>Last Updated: July 13, 2026</p>
                
                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>1. ACCEPTANCE OF CONDITIONS</h5>
                <p style={{ margin: '0 0 10px' }}>By logging into the Kinetoscope client portal or creating an account, you unconditionally acknowledge and agree to stay bound by these Terms of Service, all applicable laws of India, and all relevant project agreements.</p>
                
                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>2. ACCOUNT REGISTRATION & ELIGIBILITY</h5>
                <p style={{ margin: '0 0 10px' }}>You must be at least 18 years of age and possess the legal capacity under Indian law to enter into binding agreements. You represent that all details submitted during onboarding are authentic, accurate, and complete.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>3. ACCOUNT SECURITY</h5>
                <p style={{ margin: '0 0 10px' }}>You are solely responsible for maintaining the confidentiality of your credentials (username, password, 2FA settings) and for any actions executed through your dashboard.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>4. PLATFORM ROLE & INHERENT RISKS</h5>
                <p style={{ margin: '0 0 10px' }}>Kinetoscope acts as an interactive client management console for media financing programs. The platform does not serve as a registered financial advisory, bank, or mutual fund. All participations contain business variables linked to production schedules, which are outlined in the core agreement.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>5. ACCESS LIMITATIONS</h5>
                <p style={{ margin: '0 0 10px' }}>We reserve the right, without liability or prior warning, to block access to your client dashboard in the event of suspected fraud, identity misrepresentation, compliance breach, or violation of these terms.</p>

                <h5 style={{ fontWeight: 700, marginTop: '16px', marginBottom: '6px', color: '#1e293b' }}>6. AMENDMENTS TO TERMS</h5>
                <p style={{ margin: '0 0 10px' }}>Kinetoscope reserves the right to modify these terms. We will notify active clients of material changes via email or direct portal notifications.</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 
                (agreementStep === 'agreement' && hasReadAgreement) || 
                (agreementStep === 'privacy' && hasReadPrivacy) || 
                (agreementStep === 'tnc' && hasReadTnc) ? 'var(--color-gold, #10b981)' : '#ef4444' 
              }}>
                {agreementStep === 'agreement' && (hasReadAgreement ? '✓ Scroll Complete' : '⚠ Scroll to the bottom')}
                {agreementStep === 'privacy' && (hasReadPrivacy ? '✓ Scroll Complete' : '⚠ Scroll to the bottom')}
                {agreementStep === 'tnc' && (hasReadTnc ? '✓ Scroll Complete' : '⚠ Scroll to the bottom')}
              </span>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="kfpl-login-btn"
                  style={{
                    background: '#f8fafc', color: '#64748b', boxShadow: 'none', border: '1px solid #cbd5e1',
                    height: '38px', padding: '0 18px', fontSize: '0.8rem', width: 'auto', display: 'flex', alignItems: 'center',
                    borderRadius: '10px'
                  }}
                  onClick={() => setShowAgreementModal(false)}
                >
                  Cancel
                </button>

                {/* Case 1: Going through the wizard */}
                {!isSingleDocRead && agreementStep === 'agreement' && (
                  <button
                    type="button"
                    className="kfpl-login-btn"
                    style={{
                      height: '38px', padding: '0 20px', fontSize: '0.8rem', width: 'auto', display: 'flex', alignItems: 'center',
                      borderRadius: '10px',
                      background: hasReadAgreement ? 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)' : '#e2e8f0',
                      color: hasReadAgreement ? '#fff' : '#94a3b8',
                      cursor: hasReadAgreement ? 'pointer' : 'not-allowed',
                      boxShadow: hasReadAgreement ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                    disabled={!hasReadAgreement}
                    onClick={() => {
                      setAgreementStep('privacy');
                    }}
                  >
                    Next: Privacy Policy
                  </button>
                )}

                {!isSingleDocRead && agreementStep === 'privacy' && (
                  <button
                    type="button"
                    className="kfpl-login-btn"
                    style={{
                      height: '38px', padding: '0 20px', fontSize: '0.8rem', width: 'auto', display: 'flex', alignItems: 'center',
                      borderRadius: '10px',
                      background: hasReadPrivacy ? 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)' : '#e2e8f0',
                      color: hasReadPrivacy ? '#fff' : '#94a3b8',
                      cursor: hasReadPrivacy ? 'pointer' : 'not-allowed',
                      boxShadow: hasReadPrivacy ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                    disabled={!hasReadPrivacy}
                    onClick={() => {
                      setAgreementStep('tnc');
                    }}
                  >
                    Next: Terms & Conditions
                  </button>
                )}

                {!isSingleDocRead && agreementStep === 'tnc' && (
                  <button
                    type="button"
                    className="kfpl-login-btn"
                    style={{
                      height: '38px', padding: '0 20px', fontSize: '0.8rem', width: 'auto', display: 'flex', alignItems: 'center',
                      borderRadius: '10px',
                      background: hasReadTnc ? 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)' : '#e2e8f0',
                      color: hasReadTnc ? '#fff' : '#94a3b8',
                      cursor: hasReadTnc ? 'pointer' : 'not-allowed',
                      boxShadow: hasReadTnc ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                    disabled={!hasReadTnc || loading}
                    onClick={() => {
                      setShowAgreementModal(false);
                      setCheckedAgreement(true);
                      setCheckedPrivacy(true);
                      setCheckedTnc(true);
                      setActiveTab('register');
                      setStep('register');
                      setError('');
                    }}
                  >
                    Agree & Proceed
                  </button>
                )}

                {/* Case 2: Reading single document from form link */}
                {isSingleDocRead && (
                  <button
                    type="button"
                    className="kfpl-login-btn"
                    style={{
                      height: '38px', padding: '0 20px', fontSize: '0.8rem', width: 'auto', display: 'flex', alignItems: 'center',
                      borderRadius: '10px',
                      background: (
                        (isSingleDocRead === 'agreement' && hasReadAgreement) ||
                        (isSingleDocRead === 'privacy' && hasReadPrivacy) ||
                        (isSingleDocRead === 'tnc' && hasReadTnc)
                      ) ? 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)' : '#e2e8f0',
                      color: (
                        (isSingleDocRead === 'agreement' && hasReadAgreement) ||
                        (isSingleDocRead === 'privacy' && hasReadPrivacy) ||
                        (isSingleDocRead === 'tnc' && hasReadTnc)
                      ) ? '#fff' : '#94a3b8',
                      cursor: (
                        (isSingleDocRead === 'agreement' && hasReadAgreement) ||
                        (isSingleDocRead === 'privacy' && hasReadPrivacy) ||
                        (isSingleDocRead === 'tnc' && hasReadTnc)
                      ) ? 'pointer' : 'not-allowed',
                      boxShadow: (
                        (isSingleDocRead === 'agreement' && hasReadAgreement) ||
                        (isSingleDocRead === 'privacy' && hasReadPrivacy) ||
                        (isSingleDocRead === 'tnc' && hasReadTnc)
                      ) ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                    disabled={!(
                      (isSingleDocRead === 'agreement' && hasReadAgreement) ||
                      (isSingleDocRead === 'privacy' && hasReadPrivacy) ||
                      (isSingleDocRead === 'tnc' && hasReadTnc)
                    )}
                    onClick={() => {
                      if (isSingleDocRead === 'agreement') setCheckedAgreement(true);
                      if (isSingleDocRead === 'privacy') setCheckedPrivacy(true);
                      if (isSingleDocRead === 'tnc') setCheckedTnc(true);
                      setShowAgreementModal(false);
                    }}
                  >
                    Agree & Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ============ END: Login.jsx ============ */
