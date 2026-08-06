/* ============================================================
   Page: PaymentRequests.jsx
   Description: Deposit/Withdrawal request forms and history
   ============================================================ */

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

/* ── SVG Icons ─────────────────────── */
const DepositIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 7l-5-5-5 5"/><rect x="3" y="14" width="18" height="8" rx="2"/></svg>
);
const WithdrawIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V2"/><path d="M7 17l5 5 5-5"/><rect x="3" y="2" width="18" height="8" rx="2"/></svg>
);
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
);
const CreditCardIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
);

export default function PaymentRequests() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('deposit');
  const [form, setForm] = useState({ amount: '', mode: 'Bank Transfer', reference: '', note: '', reason: '', proofFile: '', selectedProjectId: '', selectedProjectName: '' });
  const [requestsList, setRequestsList] = useState([]);
  const [dbProjects, setDbProjects] = useState([]);
  const [stats, setStats] = useState({ totalDeposits: 0, totalWithdrawals: 0, pendingRequests: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const formatAmount = (num) => `₹${Number(num).toLocaleString('en-IN')}`;

  const fetchProjects = async () => {
    try {
      const res = await apiRequest('/api/client/projects');
      const list = Array.isArray(res) ? res : (res?.data?.projects || res?.projects || []);
      setDbProjects(list.filter(p => p.name !== '__KFPL_DUMMY__'));
    } catch (e) {
      console.error('Failed to load projects for deposit dropdown:', e);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/client/transactions');
      const data = res.data || res;
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.transactions && Array.isArray(data.transactions)) {
        list = data.transactions;
      } else if (data.history && Array.isArray(data.history)) {
        list = data.history;
      }

      const mapped = list.map((req, idx) => ({
        id: req.id || req._id || idx,
        type: req.type ? (req.type.charAt(0).toUpperCase() + req.type.slice(1)) : 'Deposit',
        amount: Number(req.amount || 0),
        date: req.date || req.createdAt || new Date().toISOString().split('T')[0],
        status: req.status ? (req.status.charAt(0).toUpperCase() + req.status.slice(1)) : 'Pending',
        mode: req.paymentMethod || req.mode || 'Bank Transfer',
        note: req.remarks || req.note || '',
        reference: req.referenceNumber || req.reference || '',
        reason: req.remarks || req.reason || '',
        proofFile: req.proofFile || req.fileUrl || '',
        projectName: req.projectName || ''
      }));
      setRequestsList(mapped);

      const totalDep = data.totalDeposits !== undefined ? data.totalDeposits : mapped.filter(r => r.type === 'Deposit').reduce((s, r) => s + r.amount, 0);
      const totalWith = data.totalWithdrawals !== undefined ? data.totalWithdrawals : mapped.filter(r => r.type === 'Withdrawal').reduce((s, r) => s + r.amount, 0);
      const pendCount = data.pendingRequests !== undefined ? data.pendingRequests : mapped.filter(r => r.status === 'Pending').length;

      setStats({
        totalDeposits: totalDep,
        totalWithdrawals: totalWith,
        pendingRequests: pendCount
      });

      // Write to SWR Cache
      const cacheKey = `kfpl_client_payments_cache_${getClientId()}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        requestsList: mapped,
        stats: {
          totalDeposits: totalDep,
          totalWithdrawals: totalWith,
          pendingRequests: pendCount
        }
      }));
    } catch (err) {
      console.error('Failed to load transaction list:', err);
      const cacheKey = `kfpl_client_payments_cache_${getClientId()}`;
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.requestsList) setRequestsList(parsed.requestsList);
        if (parsed.stats) setStats(parsed.stats);
        return;
      }
      setRequestsList([]);
      setStats({ totalDeposits: 0, totalWithdrawals: 0, pendingRequests: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getClientId = () => {
    try {
      const authData = localStorage.getItem('kfpl_client_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        const c = parsed.client || parsed.user || {};
        return c.id || c._id || 'default';
      }
    } catch (e) {}
    return 'default';
  };

  useEffect(() => {
    try {
      const cacheKey = `kfpl_client_payments_cache_${getClientId()}`;
      const cacheData = localStorage.getItem(cacheKey);
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        if (parsed.requestsList) setRequestsList(parsed.requestsList);
        if (parsed.stats) setStats(parsed.stats);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to parse payments cache:', e);
    }
    fetchProjects();
    fetchTransactions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || submitting) return;

    if (activeTab === 'deposit' && !form.selectedProjectId) {
      addToast('error', 'Project Required', 'Please select a target investment project for your deposit!');
      return;
    }

    if (activeTab === 'deposit' && !form.proofFile) {
      addToast('error', 'Proof Required', 'Please upload a proof of deposit receipt!');
      return;
    }

    try {
      setSubmitting(true);
      if (activeTab === 'deposit') {
        const formData = new FormData();
        formData.append('type', 'deposit');
        formData.append('amount', form.amount);
        formData.append('paymentMethod', form.mode);
        formData.append('referenceNumber', form.reference || `TXN${Date.now()}`);
        formData.append('remarks', form.note || '');
        if (form.selectedProjectId) {
          formData.append('projectId', form.selectedProjectId);
          formData.append('projectName', form.selectedProjectName);
        }
        if (form.proofFile && form.proofFile.raw) {
          formData.append('file', form.proofFile.raw);
        }
        await apiRequest('/api/client/transactions', {
          method: 'POST',
          body: formData
        });
      } else {
        const payload = {
          type: 'withdrawal',
          amount: Number(form.amount),
          paymentMethod: form.mode,
          remarks: form.reason || form.note || ''
        };
        await apiRequest('/api/client/transactions', {
          method: 'POST',
          body: payload
        });
      }

      addToast('success', 'Request Submitted', `${activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} request submitted successfully!`);
      setForm({ amount: '', mode: 'Bank Transfer', reference: '', note: '', reason: '', proofFile: '', selectedProjectId: '', selectedProjectName: '' });
      fetchTransactions();
    } catch (err) {
      console.error('Error submitting payment request:', err);
      addToast('error', 'Submission Failed', err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalDeposits = stats.totalDeposits;
  const totalWithdrawals = stats.totalWithdrawals;
  const pendingCount = stats.pendingRequests;

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">Payments</h1>
          <p className="kfpl-page-subtitle">Raise deposit or withdrawal requests</p>
        </div>
      </div>

      {/* ── Summary KPIs ─────────────────────── */}
      <div className="kfpl-pay-kpis">
        <div className="kfpl-pay-kpi">
          <div className="kfpl-pay-kpi-icon kfpl-pay-kpi-icon--deposit">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
          </div>
          <div>
            <span className="kfpl-pay-kpi-label">Total Deposits</span>
            <span className="kfpl-pay-kpi-value">{formatAmount(totalDeposits)}</span>
          </div>
        </div>
        <div className="kfpl-pay-kpi">
          <div className="kfpl-pay-kpi-icon kfpl-pay-kpi-icon--withdraw">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
          </div>
          <div>
            <span className="kfpl-pay-kpi-label">Total Withdrawals</span>
            <span className="kfpl-pay-kpi-value">{formatAmount(totalWithdrawals)}</span>
          </div>
        </div>
        <div className="kfpl-pay-kpi">
          <div className="kfpl-pay-kpi-icon kfpl-pay-kpi-icon--pending">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <span className="kfpl-pay-kpi-label">Pending</span>
            <span className="kfpl-pay-kpi-value">{pendingCount} request{pendingCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="kfpl-pay-grid">
        {/* ── Request Form ─────────────────────── */}
        <div className="kfpl-pay-form-card">
          <div className="kfpl-pay-tabs">
            <button
              className={`kfpl-pay-tab ${activeTab === 'deposit' ? 'kfpl-pay-tab--active' : ''}`}
              onClick={() => setActiveTab('deposit')}
            >
              <DepositIcon /> Deposit
            </button>
            <button
              className={`kfpl-pay-tab ${activeTab === 'withdrawal' ? 'kfpl-pay-tab--active' : ''}`}
              onClick={() => setActiveTab('withdrawal')}
            >
              <WithdrawIcon /> Withdrawal
            </button>
          </div>

          <form className="kfpl-form" onSubmit={handleSubmit}>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Amount (₹) <span className="required">*</span></label>
              <div className="kfpl-ps-modal-input-wrap">
                <span className="kfpl-ps-modal-input-prefix">₹</span>
                <input className="kfpl-input kfpl-ps-modal-input" type="number" placeholder="Enter amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Payment Mode</label>
              <select className="kfpl-select" value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>
                <option>Bank Transfer</option><option>NEFT</option><option>RTGS</option><option>UPI</option>
              </select>
            </div>
            {activeTab === 'deposit' && (
              <>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Target Investment Project <span className="required">*</span></label>
                  <select
                    className="kfpl-select"
                    value={form.selectedProjectId}
                    required
                    onChange={e => {
                      const pid = e.target.value;
                      const proj = dbProjects.find(p => String(p._id || p.id) === pid);
                      setForm({
                        ...form,
                        selectedProjectId: pid,
                        selectedProjectName: proj ? proj.name : ''
                      });
                    }}
                  >
                    <option value="">-- Select Target Investment Project --</option>
                    {dbProjects.map(p => (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        {p.name} [{p.segment || 'General'}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Reference Number</label>
                  <input className="kfpl-input" placeholder="Transaction reference (optional)" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
                </div>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Proof of Deposit (Receipt/Screenshot) <span className="required">*</span></label>
                  <div 
                    className="kfpl-proof-upload-box"
                    style={{
                      border: '2px dashed var(--color-border)',
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--color-surface)',
                      position: 'relative',
                      transition: 'all 0.2s ease-in-out',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-gold)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  >
                    {form.proofFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        {form.proofFile.type && form.proofFile.type.startsWith('image/') ? (
                          <img 
                            src={form.proofFile.data} 
                            alt="Proof Preview" 
                            style={{ maxWidth: '120px', maxHeight: '100px', borderRadius: '4px', border: '1px solid var(--color-border)', objectFit: 'contain' }} 
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '10px' }}>
                            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke={form.proofFile.name && (form.proofFile.name.endsWith('.pdf') ? '#ef4444' : '#2563eb')} strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.proofFile.name}</div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>{form.proofFile.size}</div>
                            </div>
                          </div>
                        )}
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: '500' }}>File Attached</span>
                        <button 
                          type="button" 
                          className="kfpl-btn kfpl-btn--danger"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', minHeight: '0' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm(prev => ({ ...prev, proofFile: '' }));
                          }}
                        >
                          Remove Proof
                        </button>
                      </div>
                    ) : (
                      <div>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--color-text)' }}>Click to upload proof receipt</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>PNG, JPG, PDF, DOC, XLS, TXT (max 2MB)</div>
                        <input 
                          type="file" 
                          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" 
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                let sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
                                if (file.size > 1024 * 1024) {
                                  sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                                }
                                setForm(prev => ({
                                  ...prev,
                                  proofFile: {
                                    name: file.name,
                                    type: file.type,
                                    size: sizeStr,
                                    data: event.target.result,
                                    raw: file
                                  }
                                }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {activeTab === 'withdrawal' && (
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Reason <span className="required">*</span></label>
                <input className="kfpl-input" placeholder="Reason for withdrawal" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
            )}
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Note</label>
              <textarea className="kfpl-textarea" placeholder="Any additional notes..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={3}></textarea>
            </div>
            <button type="submit" className="kfpl-pay-submit-btn" disabled={!form.amount || submitting}>
              <SendIcon />
              {submitting ? 'Submitting...' : `Submit ${activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} Request`}
            </button>
          </form>
        </div>

        {/* ── Online Payment Coming Soon ─────────────────────── */}
        <div className="kfpl-pay-coming-soon">
          <div className="kfpl-pay-coming-soon-icon">
            <CreditCardIcon />
          </div>
          <h3 className="kfpl-pay-coming-soon-title">Online Payment</h3>
          <p className="kfpl-pay-coming-soon-text">PSP integration coming soon. You'll be able to make payments directly online.</p>
          <span className="kfpl-pay-coming-soon-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Coming Soon
          </span>
        </div>
      </div>

      {/* ── Request History Table ─────────────────────── */}
      <div className="kfpl-pay-history">
        <div className="kfpl-pay-history-header">
          <div className="kfpl-pay-history-header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          </div>
          <h3 className="kfpl-pay-history-title">Request History</h3>
        </div>
        <div className="kfpl-pay-history-list">
          {requestsList.map((req, i) => (
            <div key={req.id || i} className="kfpl-pay-history-item" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className={`kfpl-pay-history-type ${req.type === 'Deposit' ? 'kfpl-pay-history-type--deposit' : 'kfpl-pay-history-type--withdraw'}`}>
                {req.type === 'Deposit' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
                )}
              </div>
              <div className="kfpl-pay-history-info">
                <span className="kfpl-pay-history-name">{req.type}</span>
                <span className="kfpl-pay-history-note">{req.note} · {req.mode}</span>
              </div>
              <div className="kfpl-pay-history-amount">
                <span className={req.type === 'Deposit' ? 'kfpl-pay-history-amount--positive' : 'kfpl-pay-history-amount--negative'}>
                  {req.type === 'Deposit' ? '+' : '-'}{formatAmount(req.amount)}
                </span>
                <span className="kfpl-pay-history-date">
                  {new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <span className={`kfpl-badge kfpl-badge--${req.status.toLowerCase()}`}>{req.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ END: PaymentRequests.jsx ============ */
