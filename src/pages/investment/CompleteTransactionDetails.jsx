/* ============================================================
   Page: CompleteTransactionDetails.jsx
   Description: Client-facing read-only view of ROI / payout history
   ============================================================ */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

const formatClientID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  if (rawId.startsWith('KFPL-CL-')) return rawId;
  const digits = rawId.match(/\d+/);
  if (digits) {
    let val = parseInt(digits[0], 10);
    if (val < 1000) {
      val = 1000 + val;
    }
    return `KFPL-CL-${val}`;
  }
  return 'KFPL-CL-1001';
};

export default function CompleteTransactionDetails() {
  const addToast = useToast();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    const fetchAllTransactionDetails = async () => {
      try {
        setLoading(true);
        const [txRes, payoutsRes] = await Promise.all([
          apiRequest('/api/client/transactions?limit=1000').catch(() => null),
          apiRequest('/api/client/payouts?limit=1000').catch(() => null)
        ]);

        const rawTx = txRes?.data?.transactions || (Array.isArray(txRes) ? txRes : []);
        const rawPayouts = Array.isArray(payoutsRes) ? payoutsRes : (payoutsRes?.data?.payouts || payoutsRes?.payouts || (Array.isArray(payoutsRes?.data) ? payoutsRes.data : []));

        // Map deposit & withdrawal transactions
        const mappedTx = rawTx.map((t, idx) => {
          const isDeposit = String(t.type).toLowerCase() === 'deposit';
          return {
            id: t._id || t.id || `tx_${idx}`,
            month: isDeposit ? 'Capital Deposit' : 'Capital Withdrawal',
            type: t.type ? t.type.toUpperCase() : 'DEPOSIT',
            amount: Number(t.amount || 0),
            status: (t.status || 'pending').toLowerCase(),
            paidAt: t.actionAt || t.updatedAt || t.createdAt,
            paymentMode: t.paymentMethod || 'Bank Transfer',
            transactionRef: t.referenceNumber || (t._id ? `REF-${String(t._id).slice(-8).toUpperCase()}` : `TXN${100000 + idx}`),
            category: isDeposit ? 'deposit' : 'withdrawal'
          };
        });

        // Map ROI payouts
        const mappedPayouts = rawPayouts.map((r, idx) => ({
          id: r._id || r.id || `payout_${idx}`,
          month: r.month || r.period || 'ROI Payout',
          type: 'ROI RETURN',
          amount: Number(r.amount || r.received || 0),
          status: (r.status || 'paid').toLowerCase(),
          paidAt: r.paidAt || r.date || r.processedDate,
          paymentMode: r.paymentMode || 'Bank Transfer',
          transactionRef: r.transactionRef || r.transactionRefId || (r._id ? `ROI-${String(r._id).slice(-8).toUpperCase()}` : `ROI${100000 + idx}`),
          category: 'roi'
        }));

        const combined = [...mappedTx, ...mappedPayouts].sort((a, b) => {
          const dateA = new Date(a.paidAt || 0).getTime();
          const dateB = new Date(b.paidAt || 0).getTime();
          return dateB - dateA;
        });

        setRecords(combined);
      } catch (err) {
        console.error('Failed to fetch transaction details:', err);
        addToast('error', 'Fetch Failed', 'Could not load complete transaction details.');
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAllTransactionDetails();
  }, []);

  const handleExportCSV = () => {
    const headers = ['Month / Period', 'Amount (₹)', 'Payment Mode', 'Transaction Ref', 'Status', 'Paid At'];
    const rows = filteredRecords.map(r => [
      r.month,
      r.amount,
      r.paymentMode || '—',
      r.transactionRef || '—',
      r.status.toUpperCase(),
      r.paidAt || '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KFPL_Client_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Export Success', 'Standard CSV exported successfully!');
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      addToast('error', 'Popup Blocked', 'Please allow popups to download PDF statement.');
      return;
    }

    const getLoggedInClient = () => {
      try {
        const authData = localStorage.getItem('kfpl_client_auth');
        if (authData) return JSON.parse(authData).client || JSON.parse(authData).user || {};
      } catch (e) {}
      return {};
    };
    const client = getLoggedInClient();

    const rowsHtml = filteredRecords.map((r) => `
      <tr>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-weight: 500;">${r.month}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: 700; color: #059669;">₹${Number(r.amount).toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px;">${r.paymentMode || '—'}<br/><span style="font-family: monospace; font-size: 11px; color: #64748b;">${r.transactionRef || ''}</span></td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; ${['paid','approved'].includes(r.status) ? 'background: #D1FAE5; color: #065F46;' : 'background: #FEF3C7; color: #92400E;'}">${String(r.status).toUpperCase()}</span>
        </td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-IN') : '—'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
      <head>
        <title>Transaction Statement - ${client.name || 'Client'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #11221A; padding: 40px; margin: 0; }
          .header { margin-bottom: 24px; border-bottom: 3px solid #10B981; padding-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 24px; font-weight: 800; color: #061D13; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background-color: #F3F7F5; color: #4B6B5B; font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 10px; border: 1px solid #CFDDD5; text-align: left; }
          td { border: 1px solid #CFDDD5; padding: 10px; font-size: 12px; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px dashed #CFDDD5; padding-top: 16px; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="header">
          <div>
            <h1 class="title">Official Transaction Statement</h1>
            <p style="margin: 4px 0 0; font-size: 12px; color: #4B6B5B;">Kinetoscope Films Production Pvt Ltd — Client Portal</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 700; color: #061D13;">${client.name || 'Client'}</div>
            <div style="font-size: 12px; color: #64748b;">Code: ${client.clientCode || '—'}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
              <th>Mode / Reference</th>
              <th style="text-align: center;">Status</th>
              <th style="text-align: center;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          Generated on ${new Date().toLocaleDateString('en-IN')} — Kinetoscope Films Production Pvt Ltd Confidential Statement
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };
  const filteredRecords = records.filter(r => {
    if (filter !== 'all') {
      if (filter === 'deposit' && r.category !== 'deposit') return false;
      if (filter === 'withdrawal' && r.category !== 'withdrawal') return false;
      if (filter === 'roi' && r.category !== 'roi') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      const dateStr = r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-IN') : '';
      const haystack = [
        r.month, r.type, r.paymentMode, r.transactionRef, r.status, String(r.amount || ''), `₹${r.amount}`, dateStr
      ].filter(Boolean).join(' ').toLowerCase();
      
      const matchesAll = tokens.every(token => haystack.includes(token));
      if (!matchesAll) return false;
    }
    return true;
  });

  const totalDeposits = records.filter(r => r.category === 'deposit' && ['approved', 'completed', 'paid'].includes(r.status)).reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalRoiPaid = records.filter(r => r.category === 'roi' && ['paid', 'approved'].includes(r.status)).reduce((sum, r) => sum + (r.amount || 0), 0);

  const depositCount = records.filter(r => r.category === 'deposit').length;
  const withdrawalCount = records.filter(r => r.category === 'withdrawal').length;
  const roiCount = records.filter(r => r.category === 'roi').length;

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header animate-rollout" style={{ animationDelay: '0ms' }}>
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Complete Transaction Details</h2>
          <p className="kfpl-page-subtitle">View and download your complete deposit, withdrawal, and ROI payout history</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={handleExportCSV}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="animate-rollout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px', animationDelay: '100ms' }}>
        <div className="kfpl-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Records</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{records.length}</div>
          </div>
        </div>

        <div className="kfpl-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803D' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved Deposits</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(totalDeposits)}</div>
          </div>
        </div>

        <div className="kfpl-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total ROI Received</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-gold-dark)' }}>{formatCurrency(totalRoiPaid)}</div>
          </div>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="animate-rollout" style={{ animationDelay: '200ms', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div className="kfpl-filter-chips" style={{ margin: 0 }}>
            {[
              { id: 'all', label: 'All Transactions', count: records.length },
              { id: 'deposit', label: 'Deposits', count: depositCount },
              { id: 'withdrawal', label: 'Withdrawals', count: withdrawalCount },
              { id: 'roi', label: 'ROI Payouts', count: roiCount }
            ].map(f => (
              <span
                key={f.id}
                className={`kfpl-filter-chip ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
                style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600 }}
              >
                {f.label} <span style={{ opacity: 0.75, fontSize: '0.75rem', marginLeft: '4px' }}>({f.count})</span>
              </span>
            ))}
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', minWidth: '280px', maxWidth: '380px', width: '100%' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="kfpl-input"
              placeholder="Search reference, description, mode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '40px', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="kfpl-table-wrapper animate-rollout" style={{ marginTop: '24px', animationDelay: '300ms' }}>
        <div className="kfpl-table-header">
          <div>
            <h3 className="kfpl-table-title" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Payout & Transaction Log</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>Detailed record of monthly payouts, expected ROI, and confirmation references</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
              onClick={handleExportCSV}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px', marginRight: '5px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Excel / CSV
            </button>
            <button
              className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
              onClick={handleDownloadPDF}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px', marginRight: '5px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Download PDF Statement
            </button>
          </div>
        </div>

        <div className="kfpl-table-container" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="kfpl-table" style={{ minWidth: '1150px', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface, #F8FAFC)', borderBottom: '1px solid var(--color-border-light, #E2E8F0)' }}>
                <th style={{ paddingLeft: '24px', width: '180px' }}>Ref / Txn ID</th>
                <th style={{ width: '230px' }}>Description</th>
                <th style={{ textAlign: 'right', width: '160px' }}>Amount</th>
                <th style={{ width: '160px' }}>Payment Mode</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '160px' }}>Date & Time</th>
                <th style={{ textAlign: 'center', paddingRight: '24px', width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#94A3B8" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span style={{ fontWeight: 600, color: '#64748B' }}>No transaction records found</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.map((rec, idx) => {
                const isDeposit = rec.category === 'deposit';
                const isRoi = rec.category === 'roi';
                const st = String(rec.status).toLowerCase();
                const isSuccess = ['paid', 'approved', 'completed'].includes(st);
                const isPending = st === 'pending';

                let formattedDateStr = '—';
                let timeStr = '12:00 PM';
                if (rec.paidAt) {
                  try {
                    const d = new Date(rec.paidAt);
                    if (!isNaN(d.getTime())) {
                      formattedDateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    }
                  } catch (e) {}
                }

                return (
                  <tr key={rec.id || idx} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}>
                    {/* 1. Transaction Ref & Type */}
                    <td style={{ paddingLeft: '24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="font-mono" style={{
                          fontSize: '0.75rem',
                          background: '#F1F5F9',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          width: 'fit-content',
                          color: '#334155',
                          fontWeight: 700,
                          letterSpacing: '0.5px'
                        }}>
                          {rec.transactionRef}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: isDeposit ? '#059669' : isRoi ? '#D97706' : '#DC2626',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase'
                        }}>
                          {rec.type}
                        </span>
                      </div>
                    </td>

                    {/* 2. Description */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '10px',
                          background: isDeposit ? '#DCFCE7' : isRoi ? '#FEF3C7' : '#FEE2E2',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isDeposit ? '#15803D' : isRoi ? '#B45309' : '#B91C1C',
                          flexShrink: 0
                        }}>
                          {isDeposit ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                          ) : isRoi ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0F172A' }}>{rec.month}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {isDeposit ? 'Capital Account Deposit' : isRoi ? 'Monthly ROI Dividend' : 'Capital Account Withdrawal'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 3. Amount */}
                    <td style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: isDeposit || isRoi ? '#059669' : '#DC2626'
                      }}>
                        {isDeposit || isRoi ? '+' : '-'}{formatCurrency(rec.amount)}
                      </span>
                    </td>

                    {/* 4. Payment Mode */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          color: '#334155',
                          width: 'fit-content'
                        }}>
                          {rec.paymentMode || 'Bank Transfer'}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Verified Payment</span>
                      </div>
                    </td>

                    {/* 5. Status Pill */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: isSuccess ? '#DCFCE7' : isPending ? '#FEF3C7' : '#FEE2E2',
                        color: isSuccess ? '#15803D' : isPending ? '#B45309' : '#B91C1C',
                        border: `1px solid ${isSuccess ? '#86EFAC' : isPending ? '#FDE68A' : '#FCA5A5'}`
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isSuccess ? '#16A34A' : isPending ? '#D97706' : '#DC2626' }}></span>
                        {st.toUpperCase()}
                      </span>
                    </td>

                    {/* 6. Date & Time */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#334155',
                          background: '#F1F5F9',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748B' }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {formattedDateStr}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500 }}>
                          {timeStr}
                        </span>
                      </div>
                    </td>

                    {/* 7. Action Button */}
                    <td style={{ textAlign: 'center', paddingRight: '24px' }}>
                      <button
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        onClick={() => setSelectedReceipt(rec)}
                        style={{ fontSize: '0.72rem', padding: '4px 10px', minHeight: '0', height: 'auto' }}
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Transaction Receipt Modal rendered via React Portal directly into document.body */}
      {selectedReceipt && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(241, 245, 249, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '20px'
        }}>
          <div className="kfpl-card animate-rollout" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '32px',
            borderRadius: '20px',
            background: '#ffffff',
            border: '1px solid #E2E8F0',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.18)',
            margin: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #F1F5F9', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '3px 10px', borderRadius: '20px', border: '1px solid #A7F3D0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Official Transaction Receipt
                </span>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#0F172A' }}>{selectedReceipt.month}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '3px' }}>Ref Number: <strong className="font-mono" style={{ color: '#334155' }}>{selectedReceipt.transactionRef}</strong></div>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  color: '#64748B',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  marginTop: '2px',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: '8px' }}>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Transaction Category</span>
                <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.85rem' }}>{selectedReceipt.month}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: '8px' }}>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Type</span>
                <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.85rem', textTransform: 'uppercase' }}>{selectedReceipt.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: '8px' }}>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Total Amount</span>
                <span style={{ fontWeight: 800, color: '#059669', fontSize: '1.25rem' }}>{formatCurrency(selectedReceipt.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: '8px' }}>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Payment Mode</span>
                <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>{selectedReceipt.paymentMode || 'Bank Transfer'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2E8F0', paddingBottom: '8px' }}>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Status</span>
                <span style={{
                  fontWeight: 700,
                  color: ['paid', 'approved', 'completed'].includes(String(selectedReceipt.status).toLowerCase()) ? '#15803D' : '#B45309',
                  background: ['paid', 'approved', 'completed'].includes(String(selectedReceipt.status).toLowerCase()) ? '#DCFCE7' : '#FEF3C7',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '0.78rem'
                }}>
                  {String(selectedReceipt.status).toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Date & Time</span>
                <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>{selectedReceipt.paidAt ? new Date(selectedReceipt.paidAt).toLocaleString('en-IN') : '—'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="kfpl-btn kfpl-btn--secondary"
                onClick={() => {
                  handleDownloadPDF();
                  setSelectedReceipt(null);
                }}
                style={{ flex: 1, padding: '10px 16px', fontSize: '0.875rem' }}
              >
                Print PDF Receipt
              </button>
              <button
                className="kfpl-btn kfpl-btn--ghost"
                onClick={() => setSelectedReceipt(null)}
                style={{ width: '100px', padding: '10px 16px', fontSize: '0.875rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
