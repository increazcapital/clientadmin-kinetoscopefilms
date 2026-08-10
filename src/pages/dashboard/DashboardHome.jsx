/* ============================================================
   Page: DashboardHome.jsx
   Description: Premium client dashboard with matching super-admin styling,
                custom SVG charts, quick actions, and personal widgets.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { JOURNEY_STEPS, PERK_TIERS } from '../../constants';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import DonutChart from '../../components/charts/DonutChart';
import LineChart from '../../components/charts/LineChart';
import Modal from '../../components/ui/Modal';
import KpiCard from '../../components/ui/KpiCard';
import { apiRequest } from '../../config/apiHelper';
import { getApiUrl } from '../../config/apiUrl';
import KycAgreementCard from '../../components/common/KycAgreementCard';
import MissingDocsReuploadCard from '../../components/common/MissingDocsReuploadCard';


const formatAgentID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  const str = String(rawId).trim();
  if (str.toUpperCase().startsWith('KFPL-AG-')) return str.toUpperCase();
  const digits = str.match(/\d+/);
  if (digits) {
    let val = parseInt(digits[0], 10);
    if (val < 1000) val += 1000;
    return `KFPL-AG-${val}`;
  }
  return 'KFPL-AG-1001';
};

export default function DashboardHome() {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('overview');

  const [supportConfig, setSupportConfig] = useState({
    clientSupportEmail: 'support@kfpl.com',
    clientSupportPhone: '+91 98765 43210',
    clientSupportWhatsapp: '919876543210',
    supportHours: 'Mon - Sat, 10 AM to 6 PM IST',
  });

  useEffect(() => {
    const fetchSupportSettings = async () => {
      try {
        const res = await fetch(getApiUrl('/api/system-settings/support'));
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) {
            let email = json.data.clientSupportEmail;
            if (!email || !email.includes('@')) email = 'support@kfpl.com';
            setSupportConfig({
              clientSupportEmail: email,
              clientSupportPhone: json.data.clientSupportPhone || '+91 98765 43210',
              clientSupportWhatsapp: json.data.clientSupportWhatsapp || '919876543210',
              supportHours: json.data.supportHours || 'Mon - Sat, 10 AM to 6 PM IST',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch support settings on dashboard:', err);
      }
    };
    fetchSupportSettings();
  }, []);

  const [client, setClient] = useState(() => {
    const authData = localStorage.getItem('kfpl_client_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        const c = parsed.client || parsed.user || {};
        return {
          ...c,
          name: c.fullName || c.name || 'Investor',
          onboardingComplete: c.onboardingComplete || false,
        };
      } catch (e) {
        console.error('Failed to parse client auth from localStorage:', e);
      }
    }
    return { name: 'Investor', onboardingComplete: false };
  });
  const [stats, setStats] = useState({
    totalInvested: 0,
    monthlyROI: 0,
    roiRate: 0,
    perkTier: 'Silver',
    nextROIDate: '—',
  });
  const [investments, setInvestments] = useState([]);
  const [roiHistory, setRoiHistory] = useState([]);
  const [journey, setJourney] = useState({
    accountCreated: true,
    onboardingComplete: false,
    kycSubmitted: false,
    agreementSigned: false,
    firstInvestment: false,
    roiConfigured: false,
    firstRoiReceived: false
  });
  const [projects, setProjects] = useState([]);

  // Helper parser for projects
  const extractProjects = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.projects && Array.isArray(res.projects)) return res.projects;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.projects && Array.isArray(res.data.projects)) return res.data.projects;
    }
    for (const key of Object.keys(res)) {
      if (Array.isArray(res[key])) {
        return res[key];
      }
    }
    return [];
  };

  const [statusHistory, setStatusHistory] = useState([]);
  const [clientHistoryLogs, setClientHistoryLogs] = useState([]);
  const [expandedClientCards, setExpandedClientCards] = useState({});
  const [expandedMediaCards, setExpandedMediaCards] = useState({});
  const [previewMedia, setPreviewMedia] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historySegmentFilter, setHistorySegmentFilter] = useState('all');

  useEffect(() => {
    // --- SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const cacheData = localStorage.getItem('kfpl_client_dashboard_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        if (parsed.client) setClient(parsed.client);
        if (parsed.stats) setStats(parsed.stats);
        if (parsed.investments) setInvestments(parsed.investments);
        if (parsed.roiHistory) setRoiHistory(parsed.roiHistory);
        if (parsed.journey) setJourney(parsed.journey);
        if (parsed.projects) setProjects(parsed.projects);
        if (parsed.statusHistory) setStatusHistory(parsed.statusHistory);
        if (parsed.clientHistoryLogs) setClientHistoryLogs(parsed.clientHistoryLogs);
      }
    } catch (e) {
      console.warn('Failed to parse client dashboard cache:', e);
    }

    const loadClientDashboardData = async () => {
      try {
        // Parallelized concurrent API queries
        const [dashRes, projectsRes, historyRes, advisorRes, txRes] = await Promise.all([
          apiRequest('/api/client/dashboard').catch(() => null),
          apiRequest('/api/client/projects').catch(() => null),
          apiRequest('/api/client/projects/updates/history').catch(() => null),
          apiRequest('/api/client/wealth-advisor').catch(() => null),
          apiRequest('/api/client/transactions').catch(() => null)
        ]);

        let updatedClient = null;
        let updatedStats = null;
        let updatedInvestments = [];
        let updatedRoiHistory = [];
        let updatedJourney = null;
        let updatedProjects = [];
        let updatedStatusHistory = [];
        let updatedHistoryLogs = [];

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

        const loggedClient = getLoggedInClient();
        let root = null;
        if (dashRes) {
          root = dashRes.data || dashRes;
        } else if (loggedClient) {
          const investmentVal = loggedClient.totalInvestment || 0;
          const roiRateVal = loggedClient.roiPercent || loggedClient.roiPercentage || 0;
          const fallbackInvests = [];
          
          const generatedHistory = [];
          if (investmentVal > 0) {
            try {
              const allocDateStr = loggedClient.contractStartDate || loggedClient.dateOfJoining || new Date().toISOString().split('T')[0];
              const startDate = new Date(allocDateStr);
              const endDate = new Date();
              if (!isNaN(startDate.getTime())) {
                let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                const targetMonth = endDate.getMonth();
                const targetYear = endDate.getFullYear();
                let index = 1;
                while (current <= endDate) {
                  const monthStr = current.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                  const amt = Math.round((investmentVal * roiRateVal) / 100);
                  const isCurrentMonth = current.getMonth() === targetMonth && current.getFullYear() === targetYear;
                  generatedHistory.push({
                    _id: `roi_${loggedClient._id || 'mock'}_${index}`,
                    payoutMonth: monthStr,
                    month: monthStr,
                    roiRate: roiRateVal,
                    amount: amt,
                    status: isCurrentMonth ? 'Pending' : 'Paid',
                    processedDate: isCurrentMonth ? '—' : new Date(current.getFullYear(), current.getMonth() + 1, 0).toLocaleDateString('en-IN')
                  });
                  index++;
                  current.setMonth(current.getMonth() + 1);
                }
              }
            } catch (e) {}
          }

          root = {
            profile: loggedClient,
            client: loggedClient,
            totalInvestment: investmentVal,
            investments: fallbackInvests,
            roiHistory: generatedHistory.reverse()
          };
        }

        // 1. Process Dashboard Response
        if (root) {
          const rawClient = root.profile || root.client || root.user || {};
          const hasNominee = !!(rawClient.nomineeName || rawClient.nominee?.name);
          const hasRisk = !!(rawClient.riskProfile);
          const onboardingCompleteVal = rawClient.onboardingComplete || (hasNominee && hasRisk);
          
          updatedClient = {
            ...rawClient,
            name: rawClient.fullName || rawClient.name || 'Investor',
            onboardingComplete: onboardingCompleteVal
          };

          if (advisorRes) {
            const rawAdv = advisorRes.data?.advisor || advisorRes.data || advisorRes.advisor || advisorRes.agent;
            if (rawAdv && (rawAdv.name || rawAdv.fullName)) {
              updatedClient.agentName = rawAdv.fullName || rawAdv.name || rawClient.agentName || 'Wealth Advisor';
              updatedClient.agentId = rawAdv.agentCode || rawAdv.code || rawAdv.agentId || rawAdv._id || rawClient.agentId || '';
              updatedClient.advisorPhone = rawAdv.phone || rawAdv.mobile || rawAdv.phoneNumber || '';
              updatedClient.advisorEmail = rawAdv.email || '';
            } else {
              updatedClient.agentName = '';
              updatedClient.agentId = '';
              updatedClient.advisorPhone = '';
              updatedClient.advisorEmail = '';
            }
          }

          setClient(updatedClient);

          // Use actual ROI rate from backend profile — no hardcoded fallback
          const clientRoiRate = updatedClient
            ? (updatedClient.roiPercent ?? updatedClient.roiPercentage ?? updatedClient.monthlyRoi ?? updatedClient.roi ?? null)
            : null;
          const finalRoiRate = clientRoiRate ?? 0;

          let monthlyRoiVal = 0;
          if (Array.isArray(root.investments)) {
            monthlyRoiVal = root.investments.reduce((sum, inv) => {
              const amt = inv.investmentAmount || inv.amount || 0;
              const roi = finalRoiRate || inv.roiPercentage || inv.roi || 0;
              return sum + (amt * (roi / 100));
            }, 0);
          }

          const backendTotal = root.totalInvestment !== undefined ? root.totalInvestment :
                               (root.totalInvestmentAmount !== undefined ? root.totalInvestmentAmount :
                               (root.stats?.totalInvested || 0));

          // Use backend Investment-model total as primary (persists even if tx history is cleared).
          // Fall back to approvedDepositsSum only if backend shows 0 and transactions show a higher amount.
          let transactionsList = [];
          if (txRes) {
            const rootTx = txRes.data || txRes;
            if (Array.isArray(rootTx.transactions)) {
              transactionsList = rootTx.transactions;
            } else if (Array.isArray(rootTx)) {
              transactionsList = rootTx;
            } else if (Array.isArray(txRes)) {
              transactionsList = txRes;
            }
          }
          const approvedDepositsSum = transactionsList
            .filter(t => t.type === 'deposit' && String(t.status || '').toLowerCase() === 'approved')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

          // Primary = Investment model value from backend
          const finalTotalInvested = Number(backendTotal) || 0;

          updatedStats = {
            totalInvested: finalTotalInvested,
            monthlyROI: monthlyRoiVal || root.expectedMonthlyRoi || root.stats?.monthlyROI || 0,
            roiRate: finalRoiRate ?? root.roiRate ?? root.roiAverage ?? root.stats?.roiRate ?? 0,
            perkTier: rawClient.tier || root.stats?.perkTier || 'Silver',
            nextROIDate: root.nextRoiDate || root.stats?.nextROIDate || '—',
          };
          setStats(updatedStats);

          if (root.investments) {
            updatedInvestments = root.investments.map(inv => ({
              ...inv,
              amount: inv.investmentAmount || inv.amount || 0,
              roiAllocated: finalRoiRate || inv.roiPercentage || inv.roiAllocated || inv.roi || 0,
              roi: finalRoiRate || inv.roiPercentage || inv.roiAllocated || inv.roi || 0,
              date: inv.investmentDate || inv.date || inv.createdAt,
              contractPeriod: inv.durationMonths || inv.contractPeriod || 24
            }));
            setInvestments(updatedInvestments);
          }
          const rawHistory = root.roiHistory || root.recentPayouts || [];
          if (Array.isArray(rawHistory) && rawHistory.length > 0) {
            updatedRoiHistory = rawHistory.map((r, idx) => {
              const amt = Number(r.amount || r.received || r.expected || 0);
              const isPaidOrApproved = ['paid', 'approved'].includes(String(r.status || '').toLowerCase());
              const rawDate = r.date || r.paidAt || r.processedDate || r.payoutDate || r.createdAt;
              let derivedMonth = r.month || r.payoutMonth || r.period;
              if (!derivedMonth || derivedMonth === '—') {
                if (rawDate) {
                  const d = new Date(rawDate);
                  if (!isNaN(d.getTime())) {
                    derivedMonth = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                  }
                }
              }
              if (!derivedMonth || derivedMonth === '—') {
                derivedMonth = new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
              }

              return {
                _id: r._id || r.id || `roi_${idx}`,
                month: derivedMonth,
                payoutMonth: derivedMonth,
                date: rawDate || new Date().toISOString(),
                expected: r.expected || amt,
                received: isPaidOrApproved ? (r.received || amt) : 0,
                amount: amt,
                status: isPaidOrApproved ? (String(r.status).toLowerCase() === 'paid' ? 'Paid' : 'Approved') : (r.status || 'Approved'),
                processedDate: r.processedDate || r.paidAt || '—'
              };
            });
            setRoiHistory(updatedRoiHistory);
          // No mock ROI history — if backend returns empty, show empty list for new clients
          } else {
            setRoiHistory([]);
          }
          // Dynamically compute onboarding and journey steps in frontend
          const isKycSubmitted = ['PENDING', 'VERIFIED', 'APPROVED'].includes(String(rawClient.kycStatus || rawClient.kyc || '').toUpperCase());
          const isKycVerified = ['VERIFIED', 'APPROVED'].includes(String(rawClient.kycStatus || rawClient.kyc || '').toUpperCase());

          const hasInvestments = updatedInvestments.length > 0 || (root.totalInvestment > 0);
          const hasReceivedRoi = updatedRoiHistory.length > 0;

          updatedJourney = {
            accountCreated: true,
            onboardingComplete: onboardingCompleteVal,
            kycSubmitted: isKycVerified,
            agreementSigned: isKycVerified,
            firstInvestment: hasInvestments,
            roiConfigured: hasInvestments,
            firstRoiReceived: hasReceivedRoi
          };
          setJourney(updatedJourney);
        }

        // 2. Process Projects Response
        if (projectsRes) {
          const raw = extractProjects(projectsRes);
          const filteredRaw = raw.filter(p => p.name !== '__KFPL_DUMMY__');
          updatedProjects = filteredRaw.map(p => ({
            id: p._id || p.id,
            name: p.name || '',
            segment: p.segment || '',
            status: p.status || 'Planning',
            value: p.portfolioValue || p.value || '₹0 Cr',
            milestone: p.milestoneProgress !== undefined ? p.milestoneProgress : (p.progress !== undefined ? p.progress : 0),
            summary: p.summary || '',
            risk: p.riskLevel || p.risk || 'Medium',
            horizon: p.horizon || '',
            roi: p.monthlyRoi || p.roi || '',
            health: p.health || 'On Track',
            bannerImg: p.bannerImage || p.bannerImg || '',
            media: (p.mediaFiles || p.media || []).map((item, idx) => {
              const fileUrl = typeof item === 'string' ? item : (item?.url || item?.path || '');
              const fileName = typeof item === 'object' && item?.name ? item.name : (fileUrl ? fileUrl.split('/').pop() : `File ${idx + 1}`);
              return {
                id: fileUrl || idx,
                name: fileName || `File ${idx + 1}`,
                type: fileUrl && fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 'image/png' : 'application/pdf',
                size: 0,
                dataUrl: fileUrl,
                uploadedAt: new Date().toISOString()
              };
            })
          }));
          setProjects(updatedProjects);

          updatedStatusHistory = updatedProjects.map((p, idx) => ({
            id: p.id || idx,
            type: 'project',
            segment: p.segment,
            project: p.name,
            status: p.status,
            progress: p.milestone,
            note: p.summary || 'Project is under active development and tracking.',
            date: p.health || 'On Track',
            bannerImg: p.bannerImg,
            media: p.media || []
          }));
          setStatusHistory(updatedStatusHistory);
        }

        // 3. Process History Response
        if (historyRes) {
          let list = [];
          if (Array.isArray(historyRes)) {
            list = historyRes;
          } else if (historyRes.history && Array.isArray(historyRes.history)) {
            list = historyRes.history;
          } else if (historyRes.data && Array.isArray(historyRes.data)) {
            list = historyRes.data;
          } else if (historyRes.data?.history && Array.isArray(historyRes.data.history)) {
            list = historyRes.data.history;
          }
          updatedHistoryLogs = list.map(h => ({
            id: h._id || h.id,
            type: h.type || 'project',
            segment: h.segment || '',
            project: h.project || h.projectName || '',
            status: h.status || '',
            progress: h.progress || 0,
            note: h.notes || h.note || '',
            date: h.date || (h.createdAt ? new Date(h.createdAt).toISOString().split('T')[0] : '—'),
          }));
          setClientHistoryLogs(updatedHistoryLogs);
        }

        // Save fresh data to SWR Cache
        try {
          const sanitizeClient = updatedClient || client ? { ...(updatedClient || client) } : null;
          if (sanitizeClient?.profilePic && sanitizeClient.profilePic.length > 2000) {
            delete sanitizeClient.profilePic;
          }

          localStorage.setItem('kfpl_client_dashboard_cache', JSON.stringify({
            client: sanitizeClient,
            stats: updatedStats || stats,
            investments: updatedInvestments,
            roiHistory: updatedRoiHistory,
            journey: updatedJourney || journey,
            projects: updatedProjects,
            statusHistory: updatedStatusHistory,
            clientHistoryLogs: updatedHistoryLogs
          }));
        } catch (_) {}

      } catch (err) {
        console.error('Failed to load client dashboard:', err);
      }
    };

    loadClientDashboardData();

    const handleApprovalEvent = (e) => {
      if (!e || e.key === 'kfpl_approval_event' || e.type === 'kfpl_approval_event') {
        loadClientDashboardData();
      }
    };

    window.addEventListener('storage', handleApprovalEvent);
    window.addEventListener('kfpl_approval_event', handleApprovalEvent);

    const pollInterval = setInterval(loadClientDashboardData, 8000);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleApprovalEvent);
      window.removeEventListener('kfpl_approval_event', handleApprovalEvent);
    };
  }, []);

  const SEGMENT_COLORS = {
    'Film Making': '#10B981', Distribution: '#1565C0', Music: '#7C3AED',
    'Trading & Syndication': '#F59E0B', 'Content IP Bank': '#0F766E', 'Film Exhibition': '#0891B2',
  };

  // Removed mock statusHistory initialization to keep client updates clean and real.

  useEffect(() => {
    if (statusHistory.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % statusHistory.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [statusHistory]);

  const handlePrevSlide = () => {
    if (statusHistory.length === 0) return;
    setCurrentSlideIndex(prev => (prev - 1 + statusHistory.length) % statusHistory.length);
  };

  const handleNextSlide = () => {
    if (statusHistory.length === 0) return;
    setCurrentSlideIndex(prev => (prev + 1) % statusHistory.length);
  };

  // Calculate journey progress
  const completedSteps = JOURNEY_STEPS.filter(step => journey[step.key]).length;
  const progress = Math.round((completedSteps / JOURNEY_STEPS.length) * 100);
  const fillPercent = completedSteps > 0 ? ((completedSteps - 1) / (JOURNEY_STEPS.length - 1)) * 100 : 0;

  const showOnboardingBanner = !client.onboardingComplete && !(client.nomineeName || client.nominee?.name) && !(client.riskProfile);

  // Prepare Donut Chart data dynamically (aggregated by segment)
  const totalInvestedAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const segmentSums = {};
  investments.forEach(inv => {
    segmentSums[inv.segment] = (segmentSums[inv.segment] || 0) + inv.amount;
  });
  const segmentAllocation = Object.keys(segmentSums).map(seg => ({
    segment: seg,
    value: totalInvestedAmount > 0 ? Math.round((segmentSums[seg] / totalInvestedAmount) * 100) : 0
  }));

  // Prepare Line Chart data dynamically
  let lineChartData = [];
  if (roiHistory && roiHistory.length > 0) {
    lineChartData = roiHistory.map(roi => {
      const rawMonth = roi.payoutMonth || roi.month || '';
      const cleanMonth = rawMonth ? rawMonth.split(' ')[0] : '—';
      const amountVal = roi.amount !== undefined ? roi.amount : (roi.received || roi.expected || 0);
      return {
        month: cleanMonth,
        amount: Number(amountVal)
      };
    });
  } else if (investments && investments.length > 0) {
    // Generate expected payout projection based on active investments so the graph is never blank
    const monthlyExpected = investments.reduce((sum, inv) => {
      const amt = inv.amount || 0;
      const roi = inv.roi || inv.roiAllocated || 0;
      return sum + (amt * (roi / 100));
    }, 0);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    
    // Generate 6 months of projection
    lineChartData = Array.from({ length: 6 }, (_, i) => {
      const idx = (currentMonthIdx - 5 + i + 12) % 12;
      return {
        month: months[idx],
        amount: monthlyExpected
      };
    });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Quick Action Config
  const quickActionItems = [
    { label: 'Raise Query', subtitle: 'Service request', route: '/service-requests/new', color: '#7B1FA2', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
    { label: 'Add Funds', subtitle: 'Invest in slots', route: '/projects', color: '#10B981', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg> },
    { label: 'Request Payout', subtitle: 'Withdraw request', route: '/payments', color: '#C62828', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
    { label: 'View Portfolio', subtitle: 'Active portfolio', route: '/portfolio', color: '#1565C0', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg> },
    { label: 'Support Details', subtitle: 'Contact desk', route: '/profile?tab=support', color: '#0E7490', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  ];

  return (
    <div className="kfpl-page" id="client-dashboard-page">

      {/* ═══════════════ WELCOME HERO BANNER ═══════════════ */}
      <div className="kfpl-welcome-banner">
        <div className="kfpl-welcome-content">
          <div className="kfpl-welcome-text">
            <div className="kfpl-welcome-eyebrow">Client investment portal</div>
            <h1 className="kfpl-welcome-title">
              Welcome back, <span className="kfpl-welcome-name">{client.name}</span>
            </h1>
            <p className="kfpl-welcome-subtitle">
              {dateStr} — Here's your portal and investment overview.
            </p>
          </div>
          <div className="kfpl-welcome-stats">
            <div className="kfpl-stat-pill">
              <span className="kfpl-stat-pill-value">
                {formatCurrency(stats.totalInvested)}
              </span>
              <span className="kfpl-stat-pill-label">Total Invested</span>
            </div>
            <div className="kfpl-stat-pill">
              <span className="kfpl-stat-pill-value">
                {formatCurrency(stats.monthlyROI)}
              </span>
              <span className="kfpl-stat-pill-label">Monthly ROI</span>
            </div>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="kfpl-welcome-deco" aria-hidden="true">
          <div className="kfpl-welcome-circle kfpl-welcome-circle--1" />
          <div className="kfpl-welcome-circle kfpl-welcome-circle--2" />
          <div className="kfpl-welcome-circle kfpl-welcome-circle--3" />
        </div>
      </div>

      {/* KYC PENDING WARNING BANNER */}
      {String(client.kycStatus || client.kyc || '').toUpperCase() === 'PENDING' && !client.agreementDocumentVerified && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: '#FEF3C7', color: '#D97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h4 style={{ margin: '0 0 2px', fontSize: '0.95rem', fontWeight: 700, color: '#B45309' }}>
                KYC Verification Pending
              </h4>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#92400E' }}>
                Your KYC documents have been submitted and are currently awaiting review & approval by Kinetoscope Films Team.
              </p>
            </div>
          </div>
          <span style={{
            background: '#FEF3C7', color: '#B45309', border: '1px solid #F59E0B',
            padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap'
          }}>
            Pending Approval
          </span>
        </div>
      )}

      {/* MISSING DOCUMENTS RE-UPLOAD CARD */}
      <MissingDocsReuploadCard
        client={client}
        loading={!client || !client.name}
        onDocUploaded={(docKey, newUrl) => {
          setClient(prev => {
            const updated = { ...prev, [docKey]: newUrl };
            try {
              const cacheData = localStorage.getItem('kfpl_client_dashboard_cache');
              if (cacheData) {
                const parsed = JSON.parse(cacheData);
                if (parsed.client) parsed.client[docKey] = newUrl;
                safeSetLocalStorage('kfpl_client_dashboard_cache', parsed);
              }
              const authData = localStorage.getItem('kfpl_client_auth');
              if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed.client) parsed.client[docKey] = newUrl;
                safeSetLocalStorage('kfpl_client_auth', parsed);
              }
            } catch (e) {}
            return updated;
          });
        }}
      />

      {/* KYC AGREEMENT CARD */}
      <div style={{ marginTop: '20px' }}>
        <KycAgreementCard
          agreementUrl={client.agreementDocument}
          agreementVerified={client.agreementDocumentVerified}
          agreementVerifiedAt={client.agreementDocumentVerifiedAt}
          clientName={client.name}
          isDashboardHome={true}
          onUploadSuccess={(newUrl) => {
            setClient(prev => ({ ...prev, agreementDocument: newUrl }));
          }}
        />
      </div>

      {/* ═══════════════ LIVE INVESTMENT STATUS UPDATES SLIDER ═══════════════ */}
      <div className="kfpl-section-header" style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="kfpl-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 18, height: 18, color: 'var(--color-success)' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Live Portfolio & Segment Updates
        </h3>
        <button
          className="kfpl-btn kfpl-btn--ghost kfpl-btn--xs"
          onClick={() => setShowHistoryModal(true)}
          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          View Full History Log
        </button>
      </div>

      <div className="kfpl-status-slider-container" style={{ position: 'relative', marginBottom: '28px' }}>
        {statusHistory.length === 0 ? (
          <div className="kfpl-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No status updates published yet.
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {/* Slider Navigation Buttons */}
            <button
              onClick={handlePrevSlide}
              className="kfpl-slider-nav-btn prev"
              style={{
                position: 'absolute', left: '-15px', zIndex: 10,
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'all 0.2s', fontWeight: 'bold'
              }}
            >
              &larr;
            </button>

            {/* Slider Viewport */}
            <div className="kfpl-slider-viewport" style={{ overflow: 'hidden', width: '100%', borderRadius: '12px' }}>
              <div
                className="kfpl-slider-track"
                style={{
                  display: 'flex',
                  transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: `translateX(-${currentSlideIndex * 100}%)`
                }}
              >
                {statusHistory.map((update) => {
                  const accent = SEGMENT_COLORS[update.segment] || '#10B981';

                  const cardUpdates = clientHistoryLogs.filter(h => {
                    if (update.type === 'segment') {
                      return h.segment === update.segment && h.type === 'segment';
                    } else {
                      return h.project === update.project;
                    }
                  });
                  const sortedUpdates = [...cardUpdates].sort((a, b) => new Date(b.date) - new Date(a.date));
                  const displayUpdates = sortedUpdates.length > 0
                    ? sortedUpdates
                    : [{ id: 'current', note: update.note, date: update.date, status: update.status, progress: update.progress }];

                  const isExpanded = !!expandedClientCards[update.id];
                  const firstTwo = displayUpdates.slice(0, 2);
                  const remaining = displayUpdates.slice(2);

                  // Extract project banner or first uploaded image attachment as fallback
                  const projectImageItem = (update.media || []).find(m =>
                    m.type?.startsWith('image/') ||
                    m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i)
                  );
                  const historyImageItem = cardUpdates
                    .flatMap(h => h.media || [])
                    .find(m => m.type?.startsWith('image/') || m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i));

                  const imageSrc = update.bannerImg || projectImageItem?.dataUrl || historyImageItem?.dataUrl || '';

                  return (
                    <div
                      key={update.id}
                      className="kfpl-slider-slide"
                      style={{
                        minWidth: '100%', boxSizing: 'border-box',
                        padding: '4px'
                      }}
                    >
                      <div
                        className="kfpl-card kfpl-status-slider-card"
                        style={{
                          padding: '0',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
                        }}
                      >
                        {/* ── IMAGE SECTION WITH ROUNDED EDGES ── */}
                        {imageSrc ? (
                          <div style={{ margin: '14px 14px 0', borderRadius: '12px', height: '230px', overflow: 'hidden', position: 'relative' }}>
                            <img
                              src={imageSrc}
                              alt={update.project}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                              position: 'absolute', inset: 0,
                              background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)'
                            }} />
                            <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 2 }}>
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                                letterSpacing: '0.05em',
                                padding: '4px 12px', borderRadius: '20px',
                                background: accent, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                display: 'inline-block',
                                backdropFilter: 'blur(4px)'
                              }}>{update.segment}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            margin: '14px 14px 0',
                            borderRadius: '12px',
                            height: '190px',
                            background: `linear-gradient(135deg, ${accent}0d 0%, ${accent}03 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #f1f5f9',
                            position: 'relative'
                          }}>
                            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: accent, opacity: 0.18, letterSpacing: '-1px' }}>
                              {update.project ? update.project.substring(0, 2).toUpperCase() : update.segment.substring(0, 2).toUpperCase()}
                            </span>
                            <div style={{ position: 'absolute', bottom: '12px', left: '12px' }}>
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                                letterSpacing: '0.05em',
                                padding: '4px 12px', borderRadius: '20px',
                                background: accent, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                display: 'inline-block',
                                backdropFilter: 'blur(4px)'
                              }}>{update.segment}</span>
                            </div>
                          </div>
                        )}

                        {/* ── CARD BODY ── */}
                        <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          {/* Title + Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ minWidth: 0 }}>
                              <h3 style={{
                                fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0,
                                letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }}>
                                {update.type === 'segment' || !update.project ? `${update.segment} Segment Update` : update.project}
                              </h3>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                                Last Active: {update.date}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flexShrink: 0 }}>
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 700,
                                color: '#10b981', background: '#10b98115',
                                padding: '2px 8px', borderRadius: '4px', border: '1px solid #10b98125'
                              }}>{update.status}</span>
                            </div>
                          </div>

                          {/* Progress bar container */}
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>Milestone Progress</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: accent }}>{update.progress}%</span>
                            </div>
                             <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '3.5px', overflow: 'hidden' }}>
                               <div style={{ width: `${update.progress}%`, height: '100%', background: accent, borderRadius: '3.5px', transition: 'width 0.4s ease' }} />
                             </div>
                           </div>

                           {/* ── HIGHLIGHTED TIMELINE LOGS & UPDATES CONTAINER ── */}
                           <div style={{
                             display: 'flex',
                             flexDirection: 'column',
                             gap: '8px',
                             background: '#f8fafc',
                             border: '1px solid #e2e8f0',
                             padding: '14px',
                             borderRadius: '12px',
                             boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                           }}>
                             <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                               Timeline Logs & Updates
                             </span>
                             
                             {/* First 2 updates */}
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                               {firstTwo.map((up, idx) => (
                                 <div key={up.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                   <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: accent, marginTop: '6px', flexShrink: 0 }} />
                                   <div style={{ flex: 1, minWidth: 0 }}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                       <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{up.date}</span>
                                       {up.status && <span style={{ fontSize: '0.58rem', color: accent, background: `${accent}10`, padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>{up.status}</span>}
                                     </div>
                                     <p style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.5, margin: '2px 0 0' }}>
                                       {up.note}
                                     </p>
                                   </div>
                                 </div>
                               ))}
                             </div>

                             {/* Accordion panel for remaining updates */}
                             {remaining.length > 0 && (
                               <div>
                                 <div
                                   style={{
                                     maxHeight: isExpanded ? '1000px' : '0px',
                                     overflow: 'hidden',
                                     transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                     display: 'flex',
                                     flexDirection: 'column',
                                     gap: '8px',
                                     marginTop: isExpanded ? '8px' : '0'
                                   }}
                                 >
                                   {remaining.map((up, idx) => (
                                     <div key={up.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                       <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1', marginTop: '6px', flexShrink: 0 }} />
                                       <div style={{ flex: 1, minWidth: 0 }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                           <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{up.date}</span>
                                           {up.status && <span style={{ fontSize: '0.58rem', color: '#64748b', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>{up.status}</span>}
                                         </div>
                                         <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, margin: '2px 0 0' }}>
                                           {up.note}
                                         </p>
                                       </div>
                                     </div>
                                   ))}
                                 </div>

                                 {/* Accordion Toggle Trigger Button */}
                                 <button
                                   onClick={() => setExpandedClientCards(prev => ({ ...prev, [update.id]: !isExpanded }))}
                                   style={{
                                     background: 'none', border: 'none', color: accent, fontSize: '0.72rem',
                                     fontWeight: 700, cursor: 'pointer', padding: '4px 0 0', display: 'flex',
                                     alignItems: 'center', gap: '3px', outline: 'none'
                                   }}
                                 >
                                   {isExpanded ? 'Show Less' : `View More Updates (+${remaining.length})`}
                                   <svg
                                     viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                     style={{ width: 10, height: 10, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                   >
                                     <polyline points="6 9 12 15 18 9" />
                                   </svg>
                                 </button>
                               </div>
                             )}
                           </div>

                           {/* ── HIGHLIGHTED FILES & ATTACHMENTS GRID & ACCORDION ── */}
                           {(update.media || []).length > 0 && (() => {
                             const mediaList = update.media || [];
                             const firstEight = mediaList.slice(0, 8);
                             const remainingMedia = mediaList.slice(8);
                             const isMediaExpanded = !!expandedMediaCards[update.id];

                             return (
                               <div style={{
                                 marginTop: '12px',
                                 padding: '14px',
                                 borderRadius: '12px',
                                 background: '#f8fafc',
                                 border: '1px solid #e2e8f0',
                                 display: 'flex',
                                 flexDirection: 'column',
                                 gap: '10px',
                                 boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                               }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                     Files & Attachments
                                   </span>
                                   <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>
                                     {mediaList.length} File(s)
                                   </span>
                                 </div>

                                 {/* Main 4x2 Grid (up to 8 items) */}
                                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                   {firstEight.map(m => (
                                     <div key={m.id} style={{
                                       position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '10px',
                                       overflow: 'hidden', cursor: 'pointer', background: '#ffffff',
                                       border: '1px solid #e2e8f0',
                                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                                       boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                     }} onClick={() => setPreviewMedia(m)}>
                                       {m.type?.startsWith('image/') || m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                         <img src={m.dataUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                       ) : (
                                         <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{m.name?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                                       )}
                                     </div>
                                   ))}
                                 </div>

                                 {/* Accordion list for elements past the 4x2 grid (> 8 items) */}
                                 {remainingMedia.length > 0 && (
                                   <div>
                                     <div style={{
                                       maxHeight: isMediaExpanded ? '2000px' : '0px',
                                       overflow: 'hidden',
                                       transition: 'max-height 0.3s ease-in-out',
                                       marginTop: isMediaExpanded ? '8px' : '0'
                                     }}>
                                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                         {remainingMedia.map(m => (
                                           <div key={m.id} style={{
                                             position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '10px',
                                             overflow: 'hidden', cursor: 'pointer', background: '#ffffff',
                                             border: '1px solid #e2e8f0',
                                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                                             boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                           }} onClick={() => setPreviewMedia(m)}>
                                             {m.type?.startsWith('image/') || m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                               <img src={m.dataUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                             ) : (
                                               <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{m.name?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                                             )}
                                           </div>
                                         ))}
                                       </div>
                                     </div>

                                     <button
                                       onClick={() => setExpandedMediaCards(prev => ({ ...prev, [update.id]: !isMediaExpanded }))}
                                       style={{
                                         background: 'none', border: 'none', color: accent, fontSize: '0.72rem',
                                         fontWeight: 700, cursor: 'pointer', padding: '8px 0 0', display: 'flex',
                                         alignItems: 'center', gap: '3px', outline: 'none'
                                       }}
                                     >
                                       {isMediaExpanded ? 'Show Less Files' : `View More Files (+${remainingMedia.length})`}
                                       <svg
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                         style={{ width: 10, height: 10, transform: isMediaExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                       >
                                         <polyline points="6 9 12 15 18 9" />
                                       </svg>
                                     </button>
                                   </div>
                                 )}
                               </div>
                             );
                          })()}

                          {/* Premium Segmented Action Buttons Row */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', justifyContent: 'flex-end' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedUpdate(update); }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                background: '#fff', color: '#475569', fontSize: '0.72rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                              </svg>
                              Details
                            </button>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowHistoryModal(true); }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                background: '#fff', color: '#475569', fontSize: '0.72rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                                <path d="M12 8v4l3 3"/>
                                <circle cx="12" cy="12" r="10"/>
                              </svg>
                              History
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleNextSlide}
              className="kfpl-slider-nav-btn next"
              style={{
                position: 'absolute', right: '-15px', zIndex: 10,
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'all 0.2s', fontWeight: 'bold'
              }}
            >
              &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Onboarding Profile Alert Banner */}
      {showOnboardingBanner && (
        <div className="kfpl-onboarding-banner" onClick={() => navigate('/onboarding/details')} style={{ cursor: 'pointer', marginBottom: '24px' }}>
          <div className="kfpl-onboarding-banner-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <div className="kfpl-onboarding-banner-text">
            <h4>Complete Your Profile</h4>
            <p>Add your nominee details and select your risk profile to complete onboarding.</p>
          </div>
          <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm">Complete Now →</button>
        </div>
      )}

      {/* Journey Progress Bar */}
      <div className="kfpl-journey" style={{ marginBottom: '28px' }}>
        <div className="kfpl-journey-header">
          <div>
            <h2 className="kfpl-journey-title">Your Investment Journey</h2>
            <p className="kfpl-journey-subtitle">{completedSteps} of {JOURNEY_STEPS.length} milestones completed</p>
          </div>
          <div className="kfpl-journey-progress-summary">
            <span className="kfpl-journey-status">On track</span>
            <div className="kfpl-journey-percent">{progress}<span>%</span></div>
          </div>
        </div>
        <div className="kfpl-journey-bar">
          <div className="kfpl-journey-line">
            <div className="kfpl-journey-line-fill" style={{ width: `${fillPercent}%` }}></div>
          </div>
          {JOURNEY_STEPS.map((step, i) => {
            const isCompleted = journey[step.key];
            const isCurrent = !isCompleted && (i === 0 || journey[JOURNEY_STEPS[i - 1]?.key]);
            const stepState = isCompleted ? 'completed' : isCurrent ? 'current' : 'pending';
            return (
              <div key={step.id} className={`kfpl-journey-step ${stepState}`}>
                <div className={`kfpl-journey-dot ${stepState}`}>
                  {isCompleted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : step.id}
                </div>
                <div className="kfpl-journey-step-copy">
                  <span className="kfpl-journey-step-index">Step {String(i + 1).padStart(2, '0')}</span>
                  <span className="kfpl-journey-label">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ 6 KPI CARDS (2x3) GRID ═══════════════ */}
      <div className="kfpl-dashboard-kpis">
        <KpiCard
          title="Total Invested"
          value={formatCurrency(stats.totalInvested)}
          trend="Active capital across selected projects"
          trendDirection="up"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>}
          iconColor="gold"
          className="kfpl-kpi-card--total"
          variant="gold"
          delay={0}
        />

        <KpiCard
          title="Monthly ROI"
          value={formatCurrency(stats.monthlyROI)}
          trend="Expected monthly payout"
          trendDirection="up"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
          iconColor="success"
          className="kfpl-kpi-card--roi"
          delay={80}
        />

        <KpiCard
          title="ROI Rate"
          value={`${stats.roiRate}%`}
          trend="Annual"
          trendDirection="up"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          iconColor="info"
          className="kfpl-kpi-card--rate"
          delay={160}
        />

        <KpiCard
          title="Perk Tier"
          value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', color: stats.perkTier === 'Gold' ? '#D97706' : stats.perkTier === 'Platinum' ? '#64748B' : stats.perkTier === 'Diamond' ? '#0891B2' : '#9CA3AF' }}>
                {stats.perkTier === 'Silver' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M9 18l3-6 3 6"/><path d="M8 22h8"/><path d="M12 18v4"/></svg>
                )}
                {stats.perkTier === 'Gold' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                )}
                {stats.perkTier === 'Platinum' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="M10 9l2-6 2 6"/><path d="M6 9l6 13 6-13"/></svg>
                )}
                {stats.perkTier === 'Diamond' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12l5-8h10l5 8-10 10L2 12z"/><path d="M7 4l5 8M17 4l-5 8M2 12h20"/></svg>
                )}
              </span>
              <span>{stats.perkTier}</span>
            </span>
          }
          trend="Recognition benefits enabled"
          trendDirection="up"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>}
          iconColor="warning"
          className="kfpl-kpi-card--perk"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/perks')}
          delay={240}
        />

        <KpiCard
          title="Next ROI Date"
          value={stats.nextROIDate && stats.nextROIDate !== '—' ? new Date(stats.nextROIDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          trend="Upcoming payout schedule"
          trendDirection="up"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
          iconColor="navy"
          className="kfpl-kpi-card--date"
          delay={320}
        />

        <KpiCard
          title="Active Projects"
          value={investments.length}
          trend="Diversified portfolio segments"
          trendDirection="up"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>}
          iconColor="info"
          className="kfpl-kpi-card--projects"
          delay={400}
        />
      </div>

      {/* ═══════════════ CHARTS 2-COLUMN GRID ═══════════════ */}
      <div className="kfpl-dashboard-charts-grid">
        {/* Segment Allocation Chart */}
        <div className="kfpl-chart-card kfpl-chart-card--glass">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Asset Allocation</div>
              <div className="kfpl-chart-subtitle">Portfolio distribution by segment</div>
            </div>
            <span className="kfpl-badge kfpl-badge--active">Allocated</span>
          </div>
          <div className="kfpl-chart-body">
            <DonutChart data={segmentAllocation} defaultValue={investments.length} defaultLabel="Segments" />
          </div>
          <div className="kfpl-chart-legend">
            {segmentAllocation.map((seg, i) => (
              <div className="kfpl-legend-item" key={seg.segment}>
                <span className="kfpl-legend-dot" style={{ background: ['#10B981', '#1565C0', '#2E7D32', '#E65100', '#7B1FA2', '#00838F'][i % 6] }} />
                <span>{seg.segment}</span>
                <span className="kfpl-legend-value">{seg.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ROI Earnings Line Chart */}
        <div className="kfpl-chart-card kfpl-chart-card--glass">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Monthly ROI Earnings</div>
              <div className="kfpl-chart-subtitle">Historical ROI payout tracking</div>
            </div>
            <span className="kfpl-badge kfpl-badge--gold-tier">Paid</span>
          </div>
          <div className="kfpl-chart-body">
            <LineChart data={lineChartData} height={220} color="#10B981" />
          </div>
        </div>
      </div>

      {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
      <div className="kfpl-quick-actions-section">
        <div className="kfpl-section-header">
          <h3 className="kfpl-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, color: 'var(--color-gold)' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            Quick Portal Actions
          </h3>
          <span className="kfpl-section-subtitle">One-click actions to manage your investment</span>
        </div>
        <div className="kfpl-quick-actions-grid">
          {quickActionItems.map((action, i) => (
            <button
              key={i}
              className="kfpl-quick-action-btn"
              onClick={() => navigate(action.route)}
              style={{ '--action-color': action.color }}
            >
              <div className="kfpl-quick-action-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="kfpl-quick-action-icon-wrap" style={{ background: `${action.color}12`, color: action.color }}>
                {action.icon}
              </div>
              <div className="kfpl-quick-action-text">
                <span className="kfpl-quick-action-label">{action.label}</span>
                <span className="kfpl-quick-action-sublabel">{action.subtitle}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ BOTTOM WIDGETS ═══════════════ */}
      <div className="kfpl-dashboard-widgets" style={{ marginBottom: '24px' }}>

        {/* Widget 1: Recent Payouts */}
        <div className="kfpl-chart-card">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Recent Payouts</div>
              <div className="kfpl-chart-subtitle">Last 5 ROI transfers</div>
            </div>
            <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/investment')}>View History</button>
          </div>
          <div className="kfpl-chart-body" style={{ padding: '8px 24px 24px' }}>
            <div className="kfpl-widget-list">
              {roiHistory.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>
                  No ROI payouts received yet.
                </div>
              ) : (
                roiHistory.slice(0, 5).map((roi, idx) => (
                  <div className="kfpl-widget-item" key={idx}>
                    <div className="kfpl-widget-rank silver">
                      {idx + 1}
                    </div>
                    <div className="kfpl-widget-item-info">
                      <div className="kfpl-widget-item-name">{roi.month}</div>
                      <div className="kfpl-widget-item-sub">
                        {(() => {
                          const isPaid = String(roi.status || '').toLowerCase() === 'paid';
                          const displayStatus = isPaid ? 'Paid' : 'Approved';
                          const badgeClass = isPaid ? 'paid' : 'approved';
                          return (
                            <>
                              Status: <span className={`kfpl-badge kfpl-badge--${badgeClass}`} style={{ fontSize: '0.625rem', padding: '1px 6px' }}>{displayStatus}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="kfpl-widget-item-value" style={{ color: 'var(--color-success)' }}>
                      {formatCurrency(roi.received > 0 ? roi.received : roi.expected)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Widget 2: Portfolio Projects */}
        <div className="kfpl-chart-card">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Project Milestones</div>
              <div className="kfpl-chart-subtitle">Status of active projects</div>
            </div>
            <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/portfolio')}>All Projects</button>
          </div>
          <div className="kfpl-chart-body" style={{ padding: '8px 24px 24px' }}>
            <div className="kfpl-widget-list">
              {projects.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>
                  No active projects found.
                </div>
              ) : (
                projects.slice(0, 4).map((project) => (
                  <div className="kfpl-widget-item" key={project.id}>
                    <div className="kfpl-widget-item-info">
                      <div className="kfpl-widget-item-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{project.name}</span>
                        <span className="text-muted text-xs" style={{ marginLeft: 'auto', fontWeight: '500' }}>{project.milestone}%</span>
                      </div>
                      <div className="kfpl-widget-item-sub" style={{ marginTop: '4px' }}>
                        <div className="kfpl-progress" style={{ height: '6px' }}>
                          <div className="kfpl-progress-fill" style={{ width: `${project.milestone}%` }}></div>
                        </div>
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: '4px', fontSize: '0.6875rem' }}>
                        {project.segment} • {project.status}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Widget 3: Wealth Advisor Contact */}
        <div className="kfpl-chart-card">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Personal Wealth Advisor</div>
              <div className="kfpl-chart-subtitle">Get in touch with your manager</div>
            </div>
          </div>
          <div className="kfpl-chart-body" style={{ padding: '16px 24px 24px' }}>
            {client.agentName && client.agentId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-dark) 100%)',
                  color: 'var(--color-white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: '800',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                }}>
                  {(client.agentName || 'Agent').trim().split(/\s+/).map(n => n[0] || '').join('').toUpperCase() || 'AG'}
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>{client.agentName}</h4>
                  <p className="text-muted text-sm" style={{ marginTop: '2px' }}>ID: {formatAgentID(client.agentId)} • Senior Wealth Manager</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                  <a href={`tel:${client.advisorPhone || ''}`} className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call
                  </a>
                  <a href={`https://wa.me/${client.advisorPhone || ''}`} target="_blank" rel="noopener noreferrer" className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ flex: 1, background: '#25D366', borderColor: '#25D366' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp
                  </a>
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
                  Available Mon - Sat, 10 AM to 6 PM IST
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px 0', textAlign: 'center' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" style={{ width: 28, height: 28 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '2px' }}>Direct Admin Client</p>
                  <p className="text-muted text-xs">Direct Super Admin support team</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
                  <a href={`tel:${(supportConfig.clientSupportPhone || '+919876543210').replace(/\s/g, '')}`} className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call Support
                  </a>
                  <a href={`https://wa.me/${(supportConfig.clientSupportWhatsapp || '919876543210').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ flex: 1, background: '#25D366', borderColor: '#25D366' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp
                  </a>
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
                  {supportConfig.supportHours || 'Mon - Sat, 10 AM to 6 PM IST'}
                </p>
              </div>
            )}
          </div>
        </div>


        {/* ═══════ Media Preview Modal ═══════ */}
        <Modal
          isOpen={!!previewMedia}
          onClose={() => setPreviewMedia(null)}
          title={previewMedia?.name || 'File Preview'}
          size={previewMedia?.type?.startsWith('image/') || previewMedia?.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 'lg' : 'md'}
          footer={
            <>
              <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setPreviewMedia(null)}>Close</button>
              {previewMedia?.dataUrl && (
                <a
                  href={previewMedia.dataUrl}
                  download={previewMedia.name}
                  className="kfpl-btn kfpl-btn--primary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download File
                </a>
              )}
            </>
          }
        >
          {previewMedia && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              {previewMedia.type?.startsWith('image/') || previewMedia.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img
                  src={previewMedia.dataUrl}
                  alt={previewMedia.name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                />
              ) : (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>{previewMedia.name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      File Type: {previewMedia.type || 'Unknown'} • Size: {previewMedia.size ? `${(previewMedia.size / 1024).toFixed(1)} KB` : 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ═══════ Selected Update Detail Modal ═══════ */}
        <Modal
          isOpen={!!selectedUpdate}
          onClose={() => setSelectedUpdate(null)}
          title={selectedUpdate ? (selectedUpdate.type === 'segment' || !selectedUpdate.project ? `${selectedUpdate.segment} Segment Update` : selectedUpdate.project) : 'Update Details'}
          size={selectedUpdate?.media?.length > 0 ? 'lg' : 'md'}
          footer={
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setSelectedUpdate(null)}>Close</button>
          }
        >
          {selectedUpdate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kfpl-badge" style={{ background: `${SEGMENT_COLORS[selectedUpdate.segment] || '#10B981'}15`, color: SEGMENT_COLORS[selectedUpdate.segment] || '#10B981', border: `1px solid ${SEGMENT_COLORS[selectedUpdate.segment] || '#10B981'}40` }}>
                  {selectedUpdate.segment}
                </span>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>{selectedUpdate.date}</span>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--color-text)', fontStyle: 'italic' }}>
                  "{selectedUpdate.note}"
                </p>
              </div>

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  <span className="text-muted">Milestone Completion</span>
                  <span style={{ color: SEGMENT_COLORS[selectedUpdate.segment] || '#10B981' }}>{selectedUpdate.progress}%</span>
                </div>
                <div className="kfpl-progress" style={{ height: '8px', margin: 0 }}>
                  <div className="kfpl-progress-fill" style={{ width: `${selectedUpdate.progress}%`, background: SEGMENT_COLORS[selectedUpdate.segment] || '#10B981' }}></div>
                </div>
              </div>

              {/* Attached Files */}
              {(selectedUpdate.media || []).length > 0 && (
                <div>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text)' }}>Attached Files</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {selectedUpdate.media.map(m => (
                      <div key={m.id} style={{
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '8px',
                        padding: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'center',
                        textAlign: 'center'
                      }}>
                        {m.type?.startsWith('image/') ? (
                          <img src={m.dataUrl} alt={m.name} style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
                        ) : (
                          <div style={{
                            height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--color-surface)', width: '100%', borderRadius: '4px',
                            fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)'
                          }}>
                            {m.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                          </div>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                          {m.name}
                        </span>
                        <a
                          href={m.dataUrl}
                          download={m.name}
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--xs"
                          style={{ width: '100%', textDecoration: 'none', textAlign: 'center', display: 'block', padding: '4px' }}
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ═══════ History Log Modal ═══════ */}
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title="Investment Status History"
          size="lg"
          footer={
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowHistoryModal(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                className="kfpl-input"
                placeholder="Search history by project or note..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <select
                className="kfpl-select"
                value={historySegmentFilter}
                onChange={e => setHistorySegmentFilter(e.target.value)}
                style={{ width: '180px' }}
              >
                <option value="all">All Segments</option>
                {Object.keys(SEGMENT_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* List of historical records */}
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {statusHistory
                .filter(log => {
                  const matchesSearch =
                    (log.project || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                    (log.note || '').toLowerCase().includes(historySearch.toLowerCase());
                  const matchesSegment =
                    historySegmentFilter === 'all' || log.segment === historySegmentFilter;
                  return matchesSearch && matchesSegment;
                })
                .length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
                  No update history found matching your filters.
                </div>
              ) : statusHistory
                .filter(log => {
                  const matchesSearch =
                    (log.project || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                    (log.note || '').toLowerCase().includes(historySearch.toLowerCase());
                  const matchesSegment =
                    historySegmentFilter === 'all' || log.segment === historySegmentFilter;
                  return matchesSearch && matchesSegment;
                })
                .map(log => {
                  const accent = SEGMENT_COLORS[log.segment] || '#10B981';
                  return (
                    <div key={log.id} style={{
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                      onClick={() => { setShowHistoryModal(false); setSelectedUpdate(log); }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="kfpl-badge" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}30`, fontSize: '0.65rem', padding: '2px 6px' }}>{log.segment}</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {log.type === 'segment' || !log.project ? 'Segment-Wide Update' : log.project}
                          </strong>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{log.date}</span>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0, fontStyle: 'italic' }}>
                        "{log.note || 'No notes posted.'}"
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-light)', paddingTop: '6px', marginTop: '2px' }}>
                        <span>Status: <strong>{log.status}</strong> • Progress: <strong>{log.progress}%</strong></span>
                        {(log.media || []).length > 0 && (
                          <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                            {log.media.length} File(s)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
