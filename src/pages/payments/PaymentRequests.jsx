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

  // Withdrawable balance state (ROI + Dividend received minus approved withdrawals)
  const [withdrawableData, setWithdrawableData] = useState({ roiTotal: 0, dividendTotal: 0, approvedWithdrawals: 0 });

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

  const fetchWithdrawableBalance = async () => {
    try {
      const [payoutsRes, dividendsRes, txRes] = await Promise.all([
        apiRequest('/api/client/payouts?limit=1000').catch(() => null),
        apiRequest('/api/client/dividends?limit=1000').catch(() => null),
        apiRequest('/api/client/transactions?limit=1000').catch(() => null)
      ]);

      // Parse ROI payouts — only paid/approved
      const rawPayouts = Array.isArray(payoutsRes) ? payoutsRes : (payoutsRes?.data?.payouts || payoutsRes?.payouts || (Array.isArray(payoutsRes?.data) ? payoutsRes.data : []));
      const roiTotal = rawPayouts
        .filter(r => ['paid', 'approved'].includes((r.status || 'paid').toLowerCase()))
        .reduce((sum, r) => sum + Number(r.amount || r.received || 0), 0);

      // Parse Dividend allotments
      const rawDividends = Array.isArray(dividendsRes) ? dividendsRes : (dividendsRes?.data?.allotments || dividendsRes?.allotments || (Array.isArray(dividendsRes?.data) ? dividendsRes.data : []));
      const dividendTotal = rawDividends
        .reduce((sum, d) => sum + Number(d.allottedAmount || d.amount || 0), 0);

      // Parse approved withdrawals
      const rawTx = txRes?.data?.transactions || (Array.isArray(txRes) ? txRes : []);
      const approvedWithdrawals = rawTx
        .filter(t => String(t.type).toLowerCase() === 'withdrawal' && ['approved', 'completed', 'paid'].includes((t.status || '').toLowerCase()))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      setWithdrawableData({ roiTotal, dividendTotal, approvedWithdrawals });
    } catch (e) {
      console.error('Failed to fetch withdrawable balance:', e);
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
        reference: req.referenceNumber || req.reference || req.referenceId || req.transactionRef || req.transactionRefId || req.utrNumber || '',
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
    Promise.all([fetchTransactions(), fetchWithdrawableBalance()]);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || submitting) return;

    if (activeTab === 'deposit' && !form.reference) {
      addToast('error', 'Reference Required', 'Please enter the transaction reference number!');
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
        formData.append('referenceNumber', form.reference || '');
        formData.append('reference', form.reference || '');
        formData.append('transactionRef', form.reference || '');
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

          {/* ── Withdrawable Balance Card (only on Withdrawal tab) ── */}
          {activeTab === 'withdrawal' && (() => {
            const availableBalance = Math.max(0, withdrawableData.roiTotal + withdrawableData.dividendTotal - withdrawableData.approvedWithdrawals);
            const hasRoi = withdrawableData.roiTotal > 0;
            const hasDividend = withdrawableData.dividendTotal > 0;
            return (
              <div style={{
                background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 50%, #fefce8 100%)',
                borderRadius: '14px',
                border: '1px solid #fde68a',
                padding: '18px 20px',
                marginBottom: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)',
                  borderRadius: '14px 14px 0 0'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: 'rgba(217, 119, 6, 0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#b45309', flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                        <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Withdrawable Balance</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#78350f', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatAmount(availableBalance)}
                      </div>
                    </div>
                  </div>
                  {/* Source Type Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {hasRoi && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                        background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0'
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        ROI — {formatAmount(withdrawableData.roiTotal)}
                      </span>
                    )}
                    {hasDividend && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                        background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe'
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Dividend — {formatAmount(withdrawableData.dividendTotal)}
                      </span>
                    )}
                    {!hasRoi && !hasDividend && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                        background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0'
                      }}>
                        No income received yet
                      </span>
                    )}
                  </div>
                </div>
                {withdrawableData.approvedWithdrawals > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#92400e', textAlign: 'right' }}>
                    Already withdrawn: <strong style={{ color: '#dc2626' }}>−{formatAmount(withdrawableData.approvedWithdrawals)}</strong>
                  </div>
                )}
              </div>
            );
          })()}

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
                <option>Bank Transfer</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cash</option>
              </select>
            </div>
            {activeTab === 'deposit' && (
              <>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Transaction Reference Number <span className="required">*</span></label>
                  <input
                    className="kfpl-input"
                    placeholder="Enter transaction reference / UTR / Txn ID"
                    value={form.reference}
                    required
                    onChange={e => setForm({ ...form, reference: e.target.value })}
                  />
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

        {/* ── Bank Details for Money Deposit ─────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdf4 100%)',
            borderRadius: '16px',
            border: '1px solid #d1fae5',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative accent */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #059669, #10b981, #34d399)',
              borderRadius: '16px 16px 0 0'
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(5, 150, 105, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#064e3b' }}>Bank Details for Money Deposit</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Transfer funds to the below account</p>
              </div>
            </div>

            {/* Bank Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Account Name', value: 'KINETOSCOPE FILMS PVT LTD' },
                { label: 'Account No.', value: '7049743035' },
                { label: 'IFSC Code', value: 'KKBK0001401' },
                { label: 'Bank', value: 'Kotak Mahindra Bank' },
                { label: 'Branch', value: 'Lokhandwala Andheri W, Mumbai' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.label}</span>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    textAlign: 'right',
                    fontFamily: item.label === 'Account No.' || item.label === 'IFSC Code' ? "'JetBrains Mono', monospace" : 'inherit',
                    letterSpacing: item.label === 'Account No.' ? '0.5px' : 'normal',
                    userSelect: 'all'
                  }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <p style={{ margin: '14px 0 0', fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.5, textAlign: 'center' }}>
              After transferring, please submit a deposit request with the UTR / reference number as proof.
            </p>
          </div>

          {/* ── Online Payment Coming Soon ─────────────────────── */}
          <div className="kfpl-pay-coming-soon" style={{ marginTop: '0' }}>
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
      </div>

      {/* ── Request History Table ─────────────────────── */}
      <div className="kfpl-card" style={{ marginTop: '28px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden', background: '#ffffff' }}>
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-elevated, #F8FAFC)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--color-navy, #0f172a)' }}>
                Request History & Financial Audit Log
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                Complete track record of all capital deposit requests, profit withdrawals, and live processing statuses
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="kfpl-badge" style={{ background: '#E0E7FF', color: '#3730A3', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem' }}>
              Total: {requestsList.length}
            </span>
            <span className="kfpl-badge" style={{ background: '#D1FAE5', color: '#065F46', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem' }}>
              Deposits: +{formatAmount(requestsList.filter(r => r.type === 'Deposit' && String(r.status).toLowerCase() === 'approved').reduce((s, r) => s + r.amount, 0))}
            </span>
            <span className="kfpl-badge" style={{ background: '#FEE2E2', color: '#991B1B', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem' }}>
              Withdrawals: -{formatAmount(requestsList.filter(r => r.type === 'Withdrawal' && String(r.status).toLowerCase() === 'approved').reduce((s, r) => s + r.amount, 0))}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="kfpl-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-alt, #F1F5F9)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Date & Time</th>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Reference ID</th>
                <th style={{ padding: '14px 20px', textAlign: 'left' }}>Payment Method / Note</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '14px 20px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requestsList.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>No payment requests recorded yet.</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Submit a deposit or withdrawal request above to start your transaction history.</div>
                  </td>
                </tr>
              ) : (
                requestsList.map((req, i) => {
                  const isDeposit = req.type === 'Deposit';
                  const statusNorm = String(req.status || 'pending').toLowerCase();
                  const isApproved = statusNorm === 'approved' || statusNorm === 'paid' || statusNorm === 'completed';
                  const isPending = statusNorm === 'pending';

                  const badgeBg = isApproved ? '#D1FAE5' : isPending ? '#FEF3C7' : '#FEE2E2';
                  const badgeColor = isApproved ? '#065F46' : isPending ? '#92400E' : '#991B1B';
                  const statusLabel = isApproved ? '✓ APPROVED' : isPending ? '⏳ PENDING' : '✕ REJECTED';

                  const dateFormatted = req.date
                    ? new Date(req.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';

                  const refIdStr = req.reference || req.referenceNumber || req.referenceId || (req.id ? `TXN-${String(req.id).slice(-8)}` : `TXN-${1000 + i}`);
                  const noteStr = req.note || req.mode || 'Bank Transfer';

                  return (
                    <tr key={req.id || i} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s ease' }}>
                      <td style={{ padding: '16px 20px', fontWeight: '600', fontSize: '0.85rem', color: 'var(--color-navy, #0f172a)' }}>
                        {dateFormatted}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: '800',
                          background: isDeposit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: isDeposit ? '#059669' : '#DC2626'
                        }}>
                          {isDeposit ? '↓ DEPOSIT' : '↑ WITHDRAWAL'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', background: 'var(--color-surface-elevated, #F8FAFC)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.82rem', color: '#334155' }}>
                          {refIdStr}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.83rem', color: 'var(--color-text)' }}>
                        <div style={{ fontWeight: '700', color: 'var(--color-navy, #0f172a)' }}>{req.mode || 'Bank Transfer'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{noteStr}</div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '800', fontSize: '0.95rem', color: isDeposit ? 'var(--color-primary-green, #059669)' : '#DC2626' }}>
                        {isDeposit ? '+' : '-'}{formatAmount(req.amount)}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', background: badgeBg, color: badgeColor, fontWeight: '800', fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ END: PaymentRequests.jsx ============ */
