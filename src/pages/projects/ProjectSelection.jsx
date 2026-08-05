import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../../config/apiHelper';

/* ── Segment color map ─────────────────────── */
const segmentColors = {
  'Film Making':       { bg: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)', tag: '#059669', tagBg: '#ECFDF5', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>, minInvestment: 500000 },
  'Music':             { bg: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)', tag: '#7C3AED', tagBg: '#F5F3FF', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>, minInvestment: 200000 },
  'Distribution':      { bg: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)', tag: '#2563EB', tagBg: '#EFF6FF', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, minInvestment: 1000000 },
  'Content IP Bank':   { bg: 'linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)', tag: '#D97706', tagBg: '#FFFBEB', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, minInvestment: 300000 },
  'Trading & Syndication': { bg: 'linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)', tag: '#DC2626', tagBg: '#FEF2F2', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, minInvestment: 500000 },
  'Film Exhibition':   { bg: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 50%, #22D3EE 100%)', tag: '#0891B2', tagBg: '#ECFEFF', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>, minInvestment: 1000000 },
};

const SEGMENT_ABBR = {
  'Film Making': 'FM',
  'Music': 'MS',
  'Distribution': 'DS',
  'Trading & Syndication': 'TS',
  'Content IP Bank': 'IP',
  'Film Exhibition': 'FE',
};

const getSegmentStyle = (segment) => segmentColors[segment] || segmentColors['Film Making'];

const extractProjects = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res.projects && Array.isArray(res.projects)) return res.projects;
  if (res.data) {
    if (Array.isArray(res.data)) return res.data;
    if (res.data.projects && Array.isArray(res.data.projects)) return res.data.projects;
  }
  return [];
};

const getRoiRate = (str) => {
  if (!str) return 1.0;
  const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : 1.0;
};

const getPerkTier = (val) => {
  if (!val || val <= 0) return { name: 'None', color: 'var(--color-text-muted)', bg: 'rgba(0,0,0,0.05)' };
  const lakhs = val / 100000;
  if (lakhs < 25) return { name: 'Silver Tier', color: '#B5C0D0', bg: 'rgba(181, 192, 208, 0.15)' };
  if (lakhs < 100) return { name: 'Gold Tier', color: '#D4AF37', bg: 'rgba(212, 175, 55, 0.15)' };
  if (lakhs < 300) return { name: 'Diamond Tier', color: '#B9F2FF', bg: 'rgba(185, 242, 255, 0.15)' };
  return { name: 'Platinum Tier', color: '#E5E4E2', bg: 'rgba(229, 228, 226, 0.15)' };
};

export default function ProjectSelection() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyModal, setApplyModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [ackRisk, setAckRisk] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const data = await apiRequest('/api/client/projects');
      const raw = extractProjects(data);
      const filteredRaw = raw.filter(p => p.name !== '__KFPL_DUMMY__');
      const mapped = filteredRaw.map(p => {
        const segStyle = getSegmentStyle(p.segment);
        const minInvestment = p.minInvestment || segStyle.minInvestment || 200000;
        const targetFunding = p.targetFunding || 25000000;
        const fundedAmount = p.fundedAmount || 0;
        const totalSlots = p.totalSlots !== undefined ? p.totalSlots : 20;
        const slotsAvailable = p.slotsAvailable !== undefined ? p.slotsAvailable : 20;

        let isFull = p.status === 'Slot Full' || slotsAvailable <= 0;
        if (targetFunding > 0 && fundedAmount >= targetFunding) {
          isFull = true;
        }

        const fillPercent = targetFunding > 0
          ? Math.min(100, Math.round((fundedAmount / targetFunding) * 100))
          : Math.min(100, Math.round(((totalSlots - slotsAvailable) / (totalSlots || 1)) * 100));

        return {
          id: p._id || p.id,
          name: p.name || '',
          segment: p.segment || 'Film Making',
          status: isFull ? 'Slot Full' : 'Open',
          minInvestment,
          targetFunding,
          fundedAmount,
          fillPercent,
          slotsAvailable,
          totalSlots,
          riskReward: `${p.riskLevel || p.risk || 'Medium'} / ${p.monthlyRoi || p.roi || '1.0%'} ROI`,
          bannerImg: p.bannerImage || p.bannerImg || '',
          summary: p.summary || 'Entertainment production opportunity.',
          initials: SEGMENT_ABBR[p.segment] || p.name.slice(0, 2).toUpperCase()
        };
      });
      setOpportunities(mapped);
      localStorage.setItem('kfpl_client_opportunities_cache', JSON.stringify(mapped));
    } catch (err) {
      console.error('Failed to load selector projects:', err);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!applyModal) return;
    const numAmount = Number(amount);
    if (!numAmount || numAmount < applyModal.minInvestment) {
      alert(`Investment amount must be at least ₹${applyModal.minInvestment.toLocaleString('en-IN')}`);
      return;
    }
    if (!ackRisk || !agreeTerms) {
      alert('Please acknowledge the risk profile and agree to terms of service.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiRequest(`/api/client/projects/${applyModal.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ amount: numAmount })
      });
      alert(res.message || 'Application submitted successfully! Super Admin has been notified.');
      setApplyModal(null);
      setAmount('');
      setAckRisk(false);
      setAgreeTerms(false);
      fetchProjects();
    } catch (err) {
      alert(err.message || 'Failed to submit investment application');
    } finally {
      setSubmitting(false);
    }
  };

  const modalSeg = applyModal ? getSegmentStyle(applyModal.segment) : null;
  const modalRoiPercent = applyModal ? getRoiRate(applyModal.riskReward) : 1.0;
  const modalIsAnnual = modalRoiPercent >= 5;
  const modalMonthlyRate = modalIsAnnual ? (modalRoiPercent / 12) / 100 : (modalRoiPercent / 100);
  const modalNumAmount = parseFloat(amount) || 0;
  const modalEstMonthlyReturn = modalNumAmount * modalMonthlyRate;
  const modalPerk = getPerkTier(modalNumAmount);
  const modalIsBelowMin = applyModal ? (modalNumAmount < applyModal.minInvestment) : false;

  useEffect(() => {
    // --- SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const cacheData = localStorage.getItem('kfpl_client_opportunities_cache');
      if (cacheData) {
        setOpportunities(JSON.parse(cacheData));
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to parse opportunities cache:', e);
    }

    fetchProjects();
  }, []);

  const openCount = opportunities.filter(o => o.status === 'Open').length;

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">Project Selection</h1>
          <p className="kfpl-page-subtitle">Explore new investment opportunities and apply</p>
        </div>
        <div className="kfpl-page-header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="kfpl-ps-stat-chip">
            <span className="kfpl-ps-stat-chip-dot kfpl-ps-stat-chip-dot--live"></span>
            <span>{openCount} Open</span>
          </div>
          <div className="kfpl-ps-stat-chip">
            <span style={{ fontSize: '0.875rem' }}>📋</span>
            <span>{opportunities.length} Total</span>
          </div>
        </div>
      </div>

      <div className="kfpl-portfolio-grid">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', gridColumn: '1 / -1' }}>
            <span className="kfpl-spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
            No investment opportunities found
          </div>
        ) : (
          opportunities.map((opp, idx) => {
            const slotsFilled = opp.totalSlots - opp.slotsAvailable;
            const fillPercent = Math.round((slotsFilled / opp.totalSlots) * 100);
            const isFull = opp.status === 'Slot Full';
            const accentColor = getSegmentStyle(opp.segment).tag;

            // Summary mapping
            const summary = opp.summary || "Entertainment production opportunity.";

            return (
            <div
              key={opp.id}
              className="kfpl-portfolio-card"
              style={{
                '--portfolio-accent': accentColor,
                animationDelay: `${idx * 0.08}s`
              }}
            >
              {/* Card Header / Image Area */}
              <div
                className="kfpl-portfolio-card-media"
                style={{
                  backgroundImage: opp.bannerImg ? `linear-gradient(rgba(6, 29, 19, 0.5), rgba(6, 29, 19, 0.8)), url(${opp.bannerImg})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <span className="kfpl-portfolio-card-initials">{opp.initials}</span>
                <span className="kfpl-portfolio-card-status">{opp.status}</span>
              </div>

              {/* Card Body */}
              <div className="kfpl-portfolio-card-body">
                <div className="kfpl-portfolio-card-topline">
                  <span className="kfpl-portfolio-segment">{opp.segment}</span>
                  <strong>Min: ₹{(opp.minInvestment / 100000).toFixed(1)}L</strong>
                </div>

                <h2>{opp.name}</h2>
                <p>{summary}</p>

                {/* Metrics */}
                <div className="kfpl-portfolio-metrics">
                  <div>
                    <span>Risk / Reward</span>
                    <strong>{opp.riskReward.split(' / ')[0]}</strong>
                  </div>
                  <div>
                    <span>ROI Rate</span>
                    <strong>{opp.riskReward.split(' / ')[1]}</strong>
                  </div>
                  <div>
                    <span>Available</span>
                    <strong>{opp.slotsAvailable} slots</strong>
                  </div>
                </div>

                {/* Progress bar of slot fullness */}
                <div className="kfpl-portfolio-progress-row">
                  <span>Funding Progress</span>
                  <strong>{fillPercent}% Filled</strong>
                </div>
                <div className="kfpl-progress">
                  <div className="kfpl-progress-fill" style={{ width: `${fillPercent}%`, background: accentColor === '#DC2626' ? 'var(--color-gold)' : 'var(--portfolio-accent)' }} />
                </div>

                {/* Action button */}
                <div style={{ marginTop: '16px' }}>
                  {opp.status === 'Open' ? (
                    <button
                      className="kfpl-btn kfpl-btn--primary"
                      onClick={() => setApplyModal(opp)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                      Apply Now
                    </button>
                  ) : (
                    <button
                      className="kfpl-btn kfpl-btn--ghost"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
                      disabled
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      Slots Full
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* ── Apply Modal using React Portal ─────────────────────── */}
      {applyModal && createPortal(
        <div className="kfpl-modal-overlay" onClick={() => setApplyModal(null)} style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'rgba(6, 29, 19, 0.45)', zIndex: 9999 }}>
          <div className="kfpl-ps-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '100%', overflow: 'hidden', borderRadius: '16px', background: '#fff', boxShadow: '0 24px 64px rgba(6, 29, 19, 0.15)' }}>
            {/* Modal Top Banner (Cover Image) */}
            <div
              className="kfpl-ps-modal-banner"
              style={{
                backgroundImage: applyModal.bannerImg
                  ? `linear-gradient(rgba(6, 29, 19, 0.2), rgba(6, 29, 19, 0.85)), url(${applyModal.bannerImg})`
                  : modalSeg?.bg,
                backgroundSize: 'cover',
                backgroundPosition: 'left center',
                padding: '24px',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                position: 'relative'
              }}
            >
              <div className="kfpl-ps-modal-banner-pattern"></div>
              <div className="kfpl-ps-modal-banner-content" style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 2 }}>
                <span className="kfpl-ps-modal-banner-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '8px', color: '#fff' }}>
                  {modalSeg?.icon}
                </span>
                <div>
                  <span className="kfpl-ps-modal-banner-segment" style={{ color: 'rgba(255, 255, 255, 0.85)', display: 'block', fontWeight: 600 }}>
                    {applyModal.segment}
                  </span>
                  <h2 className="kfpl-ps-modal-banner-title" style={{ color: '#fff', margin: '4px 0 0 0', textShadow: '0 2px 8px rgba(0,0,0,0.6)', fontSize: '1.4rem', fontWeight: 800 }}>
                    Apply for {applyModal.name}
                  </h2>
                </div>
              </div>
              <button
                className="kfpl-ps-modal-close-btn"
                onClick={() => setApplyModal(null)}
                style={{
                  background: '#fff',
                  border: 'none',
                  color: 'var(--color-text-primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  zIndex: 3
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Project Quick Info Strip */}
            <div className="kfpl-ps-modal-info-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#F8FAF9', borderBottom: '1px solid var(--color-border)', textAlign: 'center', padding: '16px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Min. Investment</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--color-text-primary)', marginTop: '4px' }}>₹{applyModal.minInvestment.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Slots Available</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--color-text-primary)', marginTop: '4px' }}>{applyModal.slotsAvailable} / {applyModal.totalSlots}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Risk / Expected ROI</span>
                <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--color-text-primary)', marginTop: '4px' }}>{applyModal.riskReward}</strong>
              </div>
            </div>

            {/* Form Body */}
            <div className="kfpl-ps-modal-body" style={{ padding: '24px', background: '#fff', overflowY: 'auto', flex: 1 }}>
              {/* Summary */}
              <div style={{ marginBottom: '20px', background: '#F0F5F2', padding: '14px', borderRadius: '10px', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong>Project Summary:</strong> {applyModal.summary}
              </div>

              {/* Input Block */}
              <div className="kfpl-input-group" style={{ marginBottom: '20px' }}>
                <label className="kfpl-input-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Enter Investment Amount (₹) <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '16px', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>₹</span>
                  <input
                    className="kfpl-input"
                    type="number"
                    placeholder={`Minimum ${applyModal.minInvestment.toLocaleString('en-IN')}`}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 32px',
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: modalIsBelowMin && amount ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                      outline: 'none'
                    }}
                  />
                </div>
                {modalIsBelowMin && amount && (
                  <span style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                    ⚠️ Amount must be at least ₹{applyModal.minInvestment.toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {/* Interactive Forecast & Perks */}
              {modalNumAmount > 0 && !modalIsBelowMin && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: '#F9FAF9',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px dashed var(--color-gold)',
                  marginBottom: '20px'
                }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Est. Monthly Payout</span>
                    <strong style={{ fontSize: '1.125rem', color: 'var(--color-success)', fontWeight: 800 }}>
                      ₹{Math.round(modalEstMonthlyReturn).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Qualifying Tier</span>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: modalPerk.color,
                      background: modalPerk.bg,
                      marginTop: '4px'
                    }}>
                      {modalPerk.name}
                    </span>
                  </div>
                </div>
              )}

              {/* Acknowledge Checkbox */}
              <label className="kfpl-ps-modal-checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', userSelect: 'none', margin: '0 0 12px 0', textAlign: 'left' }}>
                <input
                  type="checkbox"
                  className="kfpl-ps-modal-checkbox"
                  checked={ackRisk}
                  onChange={e => setAckRisk(e.target.checked)}
                />
                <div className="kfpl-ps-modal-checkbox-custom">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px' }}><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span className="kfpl-ps-modal-checkbox-text" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  I acknowledge the risks associated with this investment and understand the project profile: <strong>{applyModal.riskReward}</strong>
                </span>
              </label>

              {/* Agree to terms Checkbox */}
              <label className="kfpl-ps-modal-checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', userSelect: 'none', margin: 0, textAlign: 'left' }}>
                <input
                  type="checkbox"
                  className="kfpl-ps-modal-checkbox"
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                />
                <div className="kfpl-ps-modal-checkbox-custom">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px' }}><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span className="kfpl-ps-modal-checkbox-text" style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  I agree to the Kinetoscope <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and the <strong>Investment Agreement</strong>.
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="kfpl-ps-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', background: '#F8FAF9', borderTop: '1px solid var(--color-border)' }}>
              <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setApplyModal(null)} style={{ padding: '10px 20px' }}>Cancel</button>
              <button
                className="kfpl-btn kfpl-btn--primary"
                disabled={!amount || modalIsBelowMin || !ackRisk || !agreeTerms}
                onClick={handleApply}
                style={{
                  padding: '10px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: (!amount || modalIsBelowMin || !ackRisk || !agreeTerms) ? 'not-allowed' : 'pointer',
                  opacity: (!amount || modalIsBelowMin || !ackRisk || !agreeTerms) ? 0.5 : 1
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                Submit Application
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============ END: ProjectSelection.jsx ============ */
