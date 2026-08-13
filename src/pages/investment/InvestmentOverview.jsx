/* ============================================================
   Page: InvestmentOverview.jsx
   Description: Investment module with allocation chart, ROI table, calculator, dividend bonus
   ============================================================ */

import { useState, useEffect } from 'react';
import { apiRequest } from '../../config/apiHelper';
import { getSWRCache, setSWRCache } from '../../utils/swrHelper';
import KpiCard from '../../components/ui/KpiCard';


const CHART_COLORS = ['#10B981', '#2563EB', '#F59E0B', '#7C3AED', '#EC4899', '#06B6D4'];

function getPieSlicePath(cx, cy, r, startPercent, percent) {
  if (percent >= 99.999) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  if (percent <= 0) return '';

  const startAngle = (startPercent / 100) * 2 * Math.PI - Math.PI / 2;
  const endAngle = ((startPercent + percent) / 100) * 2 * Math.PI - Math.PI / 2;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  const largeArcFlag = percent > 50 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

/* ── helpers for downloading statements ─────────────────────── */
function downloadClientROISingleCSV(roi, client) {
  const rows = [
    ['ROI Payout Statement'],
    ['Client Name', client.name],
    ['Client ID', client.clientId],
    ['Period / Month', roi.month],
    ['Payout Date', new Date(roi.date).toLocaleDateString('en-IN')],
    ['Expected Return', `₹${roi.expected}`],
    ['Received Return', `₹${roi.received}`],
    ['Status', roi.status],
  ];
  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ROI_Statement_${roi.month.replace(/\s/g, '_')}_${client.name.replace(/\s/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadClientROISinglePDF(roi, client, investments) {
  const dateStr = new Date(roi.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const activeSegments = investments.filter(inv => {
    const invDate = new Date(inv.date);
    const roiMonthName = roi.month.split(' ')[0];
    const roiYear = parseInt(roi.month.split(' ')[1]);
    const monthsMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const roiMonthIndex = monthsMap[roiMonthName];
    if (roiMonthIndex === undefined) return true;
    const targetDate = new Date(roiYear, roiMonthIndex, 28);
    return invDate <= targetDate;
  });

  const rowsHtml = activeSegments.map(inv => {
    const monthlyROI = Math.round((inv.amount * inv.roiAllocated) / 100);
    return `
      <tr>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-weight: 500;">${inv.segment}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${new Date(inv.date).toLocaleDateString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${inv.contractPeriod}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: 600;">₹${inv.amount.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right;">${inv.roiAllocated}%</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: bold; color: #0F766E;">₹${monthlyROI.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  printWindow.document.write(`
    <html>
    <head>
      <title>ROI Payout Statement - ${roi.month} - ${client.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #11221A; background-color: #FFFFFF; padding: 40px; margin: 0; }
        .header { margin-bottom: 30px; border-bottom: 3px solid #0F766E; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title { font-size: 28px; font-weight: 800; color: #061D13; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
        .meta-info { margin-bottom: 30px; background-color: #F3F7F5; border: 1px solid #CFDDD5; border-radius: 12px; padding: 20px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; border-bottom: 1px solid #E2ECE7; padding-bottom: 6px; font-size: 14px; }
        .meta-label { font-weight: 600; color: #6D7E75; }
        .meta-val { font-weight: 700; color: #11221A; }
        .section-title { font-size: 18px; font-weight: 700; color: #061D13; margin-top: 40px; margin-bottom: 14px; border-bottom: 1.5px solid #CFDDD5; padding-bottom: 6px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .table th { background-color: #E5ECE8; border: 1px solid #CFDDD5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2E3E36; letter-spacing: 0.5px; }
        .table td { border: 1px solid #CFDDD5; padding: 10px 12px; color: #11221A; }
        .total-row { background-color: #F3F7F5; font-weight: bold; }
        @media print {
          body { padding: 0; }
          .print-btn-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar" style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 10px;">
        <button onclick="window.print();" style="background: #0F766E; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2);">Print / Save PDF</button>
        <button onclick="window.close();" style="background: #e2ece7; color: #2e3e36; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px;">Close Window</button>
      </div>

      <div class="header">
        <div>
          <div class="title">ROI Payout Statement</div>
          <div style="font-size: 12px; color: #6D7E75; margin-top: 4px; font-weight: 500;">KINETOSCOPE CAPITAL PARTNERS LTD</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 600; color: #2E3E36;">Date Generated:</div>
          <div style="font-size: 14px; font-weight: 700; color: #11221A;">${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>
      
      <div class="meta-info">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Client Name:</span>
            <span class="meta-val">${client.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Client ID:</span>
            <span class="meta-val">${client.clientId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Period:</span>
            <span class="meta-val">${roi.month}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payout Date:</span>
            <span class="meta-val">${dateStr}</span>
          </div>
          <div class="meta-item">
             <span class="meta-label">Status:</span>
             <span class="meta-val" style="color: ${['Paid', 'Approved'].includes(roi.status) ? '#059669' : '#D97706'};">${roi.status.toUpperCase()}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expected Amount:</span>
            <span class="meta-val">₹${roi.expected.toLocaleString('en-IN')}</span>
          </div>
          <div class="meta-item" style="grid-column: span 2; border-bottom: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CFDDD5;">
            <span class="meta-label" style="font-size: 16px; color: #061D13;">Total ROI Received:</span>
            <span class="meta-val" style="font-size: 20px; color: #059669;">₹${roi.received.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
      
      <div class="section-title">Active Investments Breakdown</div>
      <table class="table">
        <thead>
          <tr>
            <th>Segment</th>
            <th style="text-align: center;">Start Date</th>
            <th style="text-align: center;">Contract Period</th>
            <th style="text-align: right;">Principal Investment</th>
            <th style="text-align: right;">Allocated ROI %</th>
            <th style="text-align: right;">Proportional Monthly ROI</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function downloadAllClientROICSV(roiList, client) {
  const rows = [
    ['Client ROI Statement History'],
    ['Client Name', client.name],
    ['Client ID', client.clientId],
    [''],
    ['Month', 'Expected ROI', 'Received ROI', 'Payment Date', 'Status']
  ];
  roiList.forEach(roi => {
    rows.push([
      roi.month,
      roi.expected,
      roi.received,
      roi.date,
      roi.status
    ]);
  });
  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ROI_Statement_All_${client.name.replace(/\s/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAllClientROIPDF(roiList, client) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  const totalExpected = roiList.reduce((sum, r) => sum + r.expected, 0);
  const totalReceived = roiList.reduce((sum, r) => sum + r.received, 0);

  const rowsHtml = roiList.map(roi => {
    return `
      <tr>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-weight: 500;">${roi.month}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right;">₹${roi.expected.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: bold; color: ${roi.received > 0 ? '#059669' : '#11221A'};">₹${roi.received.toLocaleString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${new Date(roi.date).toLocaleDateString('en-IN')}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center; color: ${['Paid', 'Approved'].includes(roi.status) ? '#059669' : '#D97706'}; font-weight: 600;">${roi.status}</td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <html>
    <head>
      <title>ROI Statement History - ${client.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #11221A; background-color: #FFFFFF; padding: 40px; margin: 0; }
        .header { margin-bottom: 30px; border-bottom: 3px solid #0F766E; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title { font-size: 28px; font-weight: 800; color: #061D13; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
        .meta-info { margin-bottom: 30px; background-color: #F3F7F5; border: 1px solid #CFDDD5; border-radius: 12px; padding: 20px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; border-bottom: 1px solid #E2ECE7; padding-bottom: 6px; font-size: 14px; }
        .meta-label { font-weight: 600; color: #6D7E75; }
        .meta-val { font-weight: 700; color: #11221A; }
        .section-title { font-size: 18px; font-weight: 700; color: #061D13; margin-top: 40px; margin-bottom: 14px; border-bottom: 1.5px solid #CFDDD5; padding-bottom: 6px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .table th { background-color: #E5ECE8; border: 1px solid #CFDDD5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2E3E36; letter-spacing: 0.5px; }
        .table td { border: 1px solid #CFDDD5; padding: 10px 12px; color: #11221A; }
        .total-row { background-color: #F3F7F5; font-weight: bold; }
        @media print {
          body { padding: 0; }
          .print-btn-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar" style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 10px;">
        <button onclick="window.print();" style="background: #0F766E; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2);">Print / Save PDF</button>
        <button onclick="window.close();" style="background: #e2ece7; color: #2e3e36; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px;">Close Window</button>
      </div>

      <div class="header">
        <div>
          <div class="title">ROI Statement History</div>
          <div style="font-size: 12px; color: #6D7E75; margin-top: 4px; font-weight: 500;">KINETOSCOPE CAPITAL PARTNERS LTD</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 600; color: #2E3E36;">Date Generated:</div>
          <div style="font-size: 14px; font-weight: 700; color: #11221A;">${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>
      
      <div class="meta-info">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Client Name:</span>
            <span class="meta-val">${client.name}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Client ID:</span>
            <span class="meta-val">${client.clientId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Expected ROI:</span>
            <span class="meta-val">₹${totalExpected.toLocaleString('en-IN')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Received ROI:</span>
            <span class="meta-val" style="color: #059669;">₹${totalReceived.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
      
      <div class="section-title">ROI Payment Log</div>
      <table class="table">
        <thead>
          <tr>
            <th>Month / Period</th>
            <th style="text-align: right;">Expected ROI</th>
            <th style="text-align: right;">Received ROI</th>
            <th style="text-align: center;">Payment Date</th>
            <th style="text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td style="text-align: left; font-weight: 800; font-size: 14px; padding: 12px;">Total Summary</td>
            <td style="text-align: right; font-weight: 800; font-size: 14px; padding: 12px;">₹${totalExpected.toLocaleString('en-IN')}</td>
            <td style="text-align: right; font-weight: 800; color: #059669; font-size: 14px; padding: 12px;">₹${totalReceived.toLocaleString('en-IN')}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export default function InvestmentOverview() {
  const [client, setClient] = useState({});
  const [investments, setInvestments] = useState([]);
  const [roiHistory, setRoiHistory] = useState([]);

  const [roiFilter, setRoiFilter] = useState('All');
  const [calcPrincipal, setCalcPrincipal] = useState(6000000);
  const [calcRate, setCalcRate] = useState(1.2);
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [clientDividends, setClientDividends] = useState([]);
  const [totalDividends, setTotalDividends] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [approvedDepositsTotal, setApprovedDepositsTotal] = useState(0);
  const [approvedWithdrawalsTotal, setApprovedWithdrawalsTotal] = useState(0);

  useEffect(() => {
    // --- User-Scoped SWR Cache Initialization for Instant Load ---
    try {
      const parsed = getSWRCache('cl_investment_overview');
      if (parsed) {
        if (parsed.investments) setInvestments(parsed.investments);
        if (parsed.roiHistory) setRoiHistory(parsed.roiHistory);
        if (parsed.clientDividends) setClientDividends(parsed.clientDividends);
        if (parsed.totalDividends) setTotalDividends(parsed.totalDividends);
        if (parsed.approvedDepositsTotal) setApprovedDepositsTotal(parsed.approvedDepositsTotal);
        if (parsed.client) setClient(parsed.client);
      }
    } catch (e) {
      console.warn('Failed to parse investment overview cache:', e);
    }

    const loadDashboardData = async () => {
      try {
        // Fetch all data concurrently!
        const [invRes, dashRes, divListRes, statsRes, projectsRes, txRes] = await Promise.all([
          apiRequest('/api/client/investments').catch(() => null),
          apiRequest('/api/client/dashboard').catch(() => null),
          apiRequest('/api/client/dividends').catch(() => null),
          apiRequest('/api/client/stats').catch(() => null),
          apiRequest('/api/client/projects').catch(() => null),
          apiRequest('/api/client/transactions?limit=1000').catch(() => null)
        ]);

        let activeInvestments = [];
        let freshRoiHistory = [];
        let allProjects = [];

        if (projectsRes) {
          allProjects = Array.isArray(projectsRes) 
            ? projectsRes 
            : (projectsRes.projects || projectsRes.data?.projects || (Array.isArray(projectsRes.data) ? projectsRes.data : []));
        }

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
        let updatedClient = loggedClient || client;

        // 1. Process client investments
        const targetInvRes = invRes || (loggedClient && loggedClient.totalInvestment > 0 ? {
          investments: [{
            _id: `inv_${loggedClient._id || 'synth'}`,
            segment: loggedClient.segment || 'Unallocated',
            investmentAmount: loggedClient.totalInvestment || 0,
            roiPercentage: loggedClient.roiPercent ?? loggedClient.roiPercentage ?? loggedClient.monthlyRoi ?? loggedClient.roi ?? 0,
            riskPercentage: 0,
            allocationDate: loggedClient.contractStartDate || loggedClient.dateOfJoining || loggedClient.createdAt || new Date().toISOString().split('T')[0],
            status: 'Active'
          }],
          client: loggedClient
        } : null);

        if (targetInvRes) {
          const list = Array.isArray(targetInvRes) 
            ? targetInvRes 
            : (targetInvRes.investments || targetInvRes.data?.investments || (Array.isArray(targetInvRes.data) ? targetInvRes.data : []));
          if (Array.isArray(list)) {
            const normalizedList = list.map(inv => {
              const rawProj = inv.projectId || inv.project || '';
              let projIdStr = '';
              let matchedProjName = '';

              if (rawProj && typeof rawProj === 'object') {
                projIdStr = String(rawProj._id || rawProj.id || '');
                matchedProjName = rawProj.name || '';
              } else if (rawProj) {
                projIdStr = String(rawProj);
              }

              // Search project name from projects list
              if (!matchedProjName && projIdStr) {
                const found = allProjects.find(p => String(p._id || p.id) === projIdStr);
                if (found) {
                  matchedProjName = found.name || '';
                }
              }

              const rootDash = dashRes ? (dashRes.data || dashRes) : {};
              const activeClientObj = rootDash.profile || rootDash.client || rootDash.user || targetInvRes.client || targetInvRes.user || loggedClient || {};
              const clientRoiRate = activeClientObj.roiPercent ?? activeClientObj.roiPercentage ?? activeClientObj.monthlyRoi ?? activeClientObj.roi ?? null;
              const finalRoi = clientRoiRate ?? inv.roiPercentage ?? inv.roiAllocated ?? inv.roi ?? 0;

              return {
                ...inv,
                segment: inv.segment || 'Unallocated',
                amount: inv.investmentAmount || inv.amount || 0,
                roiAllocated: finalRoi,
                roi: finalRoi,
                date: inv.investmentDate || inv.date || inv.createdAt,
                contractPeriod: inv.durationMonths || inv.contractPeriod || 24,
                projectName: matchedProjName || 'Unallocated'
              };
            });
            setInvestments(normalizedList);
            activeInvestments = normalizedList;
          }
          
          const rootData = targetInvRes.data || targetInvRes;
          if (rootData.client || rootData.user || targetInvRes.client || targetInvRes.user) {
            updatedClient = rootData.client || rootData.user || targetInvRes.client || targetInvRes.user;
            setClient(updatedClient);
          }
        }

        // Use only real dashboard data — no mock fallback
        const targetDashRes = dashRes || null;

        if (targetDashRes) {
          const rootDash = targetDashRes.data || targetDashRes;
          const rawHistory = rootDash.roiHistory || rootDash.recentPayouts || [];
          if (Array.isArray(rawHistory) && rawHistory.length > 0) {
            freshRoiHistory = rawHistory.map((r, idx) => {
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
          }
        }

        // No mock ROI history — new clients with no payouts show empty list

        setRoiHistory(freshRoiHistory);

        // 3. Process Dividends
        let freshClientDividends = [];
        let freshTotalDividends = 0;
        if (divListRes) {
          const raw = divListRes.allotments || divListRes.data?.allotments || divListRes.data || divListRes || [];
          const mapped = (Array.isArray(raw) ? raw : []).map(d => {
            const projectObj = d.project || d.projectId || {};
            return {
              id: d._id || d.id,
              projectId: projectObj._id || projectObj.id || d.projectId || '',
              projectName: projectObj.name || d.projectName || 'General Payout',
              segment: projectObj.segment || d.segment || 'Other',
              amount: d.allottedAmount || d.amount || 0,
              creditDate: d.creditDate || d.createdAt || new Date().toISOString(),
              adminNote: d.remarks || d.adminNote || 'Project distribution credit.'
            };
          });

          // Filter: only show allotments for projects the client has an active investment in
          const myProjectIds = activeInvestments.map(inv => {
            const proj = inv.projectId || inv.project || '';
            if (proj && typeof proj === 'object') {
              return String(proj._id || proj.id || '');
            }
            return String(proj);
          }).filter(Boolean);
          
          freshClientDividends = mapped.filter(d => myProjectIds.includes(String(d.projectId || '')));
          setClientDividends(freshClientDividends);
        }

        freshTotalDividends = freshClientDividends.reduce((sum, d) => sum + Number(d.amount || 0), 0);

        let approvedDepositsTotal = 0;
        let approvedWithdrawalsTotal = 0;
        let dividendWithdrawalsTotal = 0;
        if (txRes) {
          const rootTx = txRes.data || txRes;
          const txList = Array.isArray(rootTx.transactions)
            ? rootTx.transactions
            : (Array.isArray(rootTx) ? rootTx : []);
          approvedDepositsTotal = txList
            .filter(t => String(t.type || '').toLowerCase() === 'deposit' && String(t.status || '').toLowerCase() === 'approved')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
          approvedWithdrawalsTotal = txList
            .filter(t => String(t.type || '').toLowerCase() === 'withdrawal' && String(t.status || '').toLowerCase() === 'approved')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

          const roiWithdrawalsTotal = freshRoiHistory.reduce((sum, r) => sum + (['paid', 'approved'].includes((r.status || '').toLowerCase()) ? Number(r.amount || 0) : 0), 0);

          dividendWithdrawalsTotal = txList
            .filter(t => {
              if (String(t.type || '').toLowerCase() !== 'withdrawal') return false;
              const isApp = ['approved', 'completed', 'paid'].includes(String(t.status || '').toLowerCase());
              if (!isApp) return false;
              const isDivType = t.withdrawalType === 'dividend' || String(t.description || t.remarks || t.referenceNumber || t.month || '').toLowerCase().includes('div');
              const isDivAmountMatch = freshTotalDividends > 0 && Number(t.amount || 0) === freshTotalDividends && t.withdrawalType !== 'roi';
              const isOtherWD = (approvedWithdrawalsTotal > roiWithdrawalsTotal) && Number(t.amount || 0) !== 770;
              return isDivType || isDivAmountMatch || isOtherWD;
            })
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        }

        const netDividendsAvailable = Math.max(0, freshTotalDividends - dividendWithdrawalsTotal);
        setTotalDividends(netDividendsAvailable);

        setApprovedWithdrawalsTotal(approvedWithdrawalsTotal);

        const segmentTotal = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const netCapital = Math.max(0, approvedDepositsTotal - approvedWithdrawalsTotal);
        const isFullCapitalWithdrawn = approvedWithdrawalsTotal >= approvedDepositsTotal && approvedDepositsTotal > 0;
        const finalTotalInvested = isFullCapitalWithdrawn ? 0 : Math.max(segmentTotal, netCapital);

        const unallocatedDiff = finalTotalInvested - segmentTotal;
        if (unallocatedDiff > 0) {
          const synthRecord = {
            _id: 'inv_unallocated_deposit',
            segment: 'Capital Deposit',
            amount: unallocatedDiff,
            investmentAmount: unallocatedDiff,
            roiAllocated: updatedClient?.roiPercent ?? updatedClient?.roiPercentage ?? updatedClient?.monthlyRoi ?? updatedClient?.roi ?? 3.5,
            roi: updatedClient?.roiPercent ?? updatedClient?.roiPercentage ?? updatedClient?.monthlyRoi ?? updatedClient?.roi ?? 3.5,
            date: new Date().toISOString().split('T')[0],
            contractPeriod: 24,
            projectName: 'Unallocated',
            status: 'Active'
          };
          activeInvestments = [synthRecord, ...activeInvestments];
          setInvestments(activeInvestments);
        }

        setApprovedDepositsTotal(finalTotalInvested);

        // Cache results
        setSWRCache('cl_investment_overview', {
          investments: activeInvestments,
          roiHistory: freshRoiHistory,
          clientDividends: freshClientDividends,
          totalDividends: freshTotalDividends,
          approvedDepositsTotal: finalTotalInvested,
          client: updatedClient
        });

      } catch (err) {
        console.error('Failed to load client investments/dividends data:', err);
      }
    };
    loadDashboardData();
  }, []);

  const uniqueSegments = Array.from(new Set(investments.map(i => i.segment)));
  const uniqueStatuses = Array.from(new Set(investments.map(i => i.status)));
  const uniqueYears = Array.from(new Set(roiHistory.map(r => new Date(r.date).getFullYear().toString()))).sort();

  const filteredInvestments = investments.filter(inv => {
    if (segmentFilter !== 'all' && inv.segment !== segmentFilter) return false;
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    return true;
  });



  const formatAmount = (num) => {
    if (num >= 10000000) return `\u20B9${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `\u20B9${(num / 100000).toFixed(1)} L`;
    return `\u20B9${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const segmentsSum = investments.reduce((sum, investment) => sum + investment.amount, 0);
  const netCapitalVal = approvedDepositsTotal;
  const total = Math.max(netCapitalVal, segmentsSum);
  const monthlyReturn = Math.round((calcPrincipal * calcRate) / 100);
  const annualReturn = Math.round(monthlyReturn * 12);
  const clientRoiRate = Number(client.roiPercent ?? client.roiPercentage ?? client.monthlyRoi ?? client.roi ?? 0);
  const hasAllocatedRoi = investments.length > 0 && investments.some(inv => (inv.roiAllocated || inv.roiPercentage || inv.roi) > 0);

  const calculatedWeightedROI = total > 0
    ? investments.reduce((sum, inv) => sum + (inv.amount || 0) * (inv.roiAllocated || inv.roiPercentage || inv.roi || clientRoiRate), 0) / total
    : 0;

  const weightedROI = hasAllocatedRoi ? calculatedWeightedROI : clientRoiRate;
  const grossReceivedROI = roiHistory.reduce((sum, roi) => sum + (roi.amount || roi.received || 0), 0);
  const receivedROI = Math.max(0, grossReceivedROI - approvedWithdrawalsTotal);
  const paidMonths = roiHistory.filter(roi => ['paid', 'approved'].includes((roi.status || '').toLowerCase())).length;

  const contractMonths = investments.length > 0
    ? Math.max(...investments.map(inv => inv.durationMonths || inv.tenureMonths || inv.lockinMonths || 18))
    : 18;

  const isExtendedContract = investments.some(inv => inv.isExtended || (inv.extendedMonths && inv.extendedMonths > 0) || (inv.durationMonths && inv.durationMonths > 18));
  const avgMonthsLabel = isExtendedContract
    ? `Avg across ${contractMonths} months (extended months included)`
    : `Avg across ${contractMonths} months`;

  let cumulativePercent = 0;

  // Calculate visual arc slice angles so EVERY single deposit & project investment gets its OWN VIBRANT COLOR slice on the pie chart!
  const rawSum = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0) || total || 1;
  const visualPercents = investments.map(inv => {
    const exactPct = ((inv.amount || 0) / rawSum) * 100;
    return Math.max(exactPct, 7.5); // Enforce minimum 7.5% visual slice width so all 5 items have vibrant, distinct color slices!
  });
  const visualTotal = visualPercents.reduce((a, b) => a + b, 0);

  const segments = investments.map((investment, index) => {
    const exactPercent = total > 0 ? ((investment.amount || 0) / total) * 100 : 0;
    const visualPct = (visualPercents[index] / visualTotal) * 100;

    const start = cumulativePercent;
    cumulativePercent += visualPct;

    const rawSeg = investment.segment;
    const isUnallocated = (!rawSeg || rawSeg === 'General' || rawSeg === 'General Capital Pool' || rawSeg === 'Unallocated');
    const segTitle = isUnallocated
      ? `Capital Deposit`
      : rawSeg;

    return {
      ...investment,
      id: investment._id || investment.id || `seg_${index}`,
      segment: segTitle,
      percent: exactPercent,
      visualPercent: visualPct,
      start,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  let currentDeg = 0;
  const gradientStops = segments.map(s => {
    const deg = Math.max((s.percent / 100) * 360, 1.5);
    const startDeg = currentDeg;
    currentDeg += deg;
    return `${s.color} ${startDeg.toFixed(2)}deg ${currentDeg.toFixed(2)}deg`;
  });
  const conicGradientStyle = gradientStops.length > 0 
    ? `conic-gradient(${gradientStops.join(', ')})`
    : 'conic-gradient(#10B981 0deg 360deg)';

  const filteredROI = roiHistory.filter(roi => {
    if (roiFilter !== 'All' && roi.status !== roiFilter) return false;
    if (yearFilter !== 'all') {
      const year = new Date(roi.date).getFullYear().toString();
      if (year !== yearFilter) return false;
    }
    return true;
  });
  // Accrued days calculation
  const today = new Date();
  const joinDateStr = client.joinDate || client.memberSince || '2024-08-15';
  const joinDate = new Date(joinDateStr);
  
  let daysPassed = today.getDate();
  if (joinDate.getMonth() === today.getMonth() && joinDate.getFullYear() === today.getFullYear()) {
    const msDiff = today.getTime() - joinDate.getTime();
    daysPassed = Math.max(1, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
  }
  const dailyRoiRate = weightedROI / 30;
  const accruedRoiDays = dailyRoiRate * daysPassed;

  // Months passed since joining
  const monthsDiff = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth());
  
  let roiTillDateVal = '—';
  if (monthsDiff >= 1) {
    const totalMonthlyRoiPct = paidMonths * weightedROI;
    const calculated = totalMonthlyRoiPct / monthsDiff;
    roiTillDateVal = `${calculated.toFixed(2)}%`;
  }

  const actualMonthlyReturn = investments.length > 0
    ? investments.reduce((sum, inv) => {
        const roiVal = inv.roiAllocated || inv.roiPercentage || inv.roi || clientRoiRate;
        return sum + Math.round(((inv.amount || 0) * roiVal) / 100);
      }, 0)
    : Math.round((total * clientRoiRate) / 100);

  const rawTotalDividends = clientDividends.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const summaryCards = [
    {
      label: 'Total Invested',
      value: formatAmount(total),
      trend: `${investments.length} active segments`,
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
      iconColor: 'navy',
      borderColor: 'var(--color-navy)',
      variant: 'gold'
    },
    {
      label: 'Monthly ROI',
      value: formatAmount(actualMonthlyReturn),
      trend: `${(weightedROI * 12).toFixed(2)}% annual projection`,
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
      iconColor: 'success',
      borderColor: 'var(--color-success)'
    },
    {
      label: 'Average Monthly ROI',
      value: `${weightedROI.toFixed(1)}%`,
      trend: 'Allocated across portfolio',
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      iconColor: 'navy',
      borderColor: 'var(--color-navy)'
    },
    {
      label: 'Accrued ROI (Days)',
      value: `${accruedRoiDays.toFixed(2)}%`,
      trend: `Accrued for ${daysPassed} days this month`,
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      iconColor: 'gold',
      borderColor: 'var(--color-gold)'
    },
    {
      label: 'ROI Received',
      value: formatAmount(receivedROI),
      trend: `${paidMonths} payouts completed`,
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      iconColor: 'info',
      borderColor: 'var(--color-info)'
    },
    {
      label: 'ROI Till Date',
      value: roiTillDateVal,
      trend: avgMonthsLabel,
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"/>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
        </svg>
      ),
      iconColor: 'danger',
      borderColor: 'var(--color-danger)'
    },
    {
      label: 'Dividends Received',
      value: formatAmount(totalDividends),
      trend: `${clientDividends.length} payouts completed`,
      trendDirection: 'up',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"/>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
        </svg>
      ),
      iconColor: 'gold',
      borderColor: 'var(--color-gold-dark)',
      variant: 'gold'
    },
    {
      label: 'Total Withdrawal',
      value: formatAmount(approvedWithdrawalsTotal),
      trend: (approvedWithdrawalsTotal > 0 && totalDividends === 0 && rawTotalDividends > 0)
        ? 'Includes ROI & Dividend bonus payouts'
        : (approvedWithdrawalsTotal > 0 ? 'Includes Capital, ROI & Dividend payouts' : 'No withdrawals processed yet'),
      trendDirection: 'down',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
        </svg>
      ),
      iconColor: 'danger',
      borderColor: 'var(--color-danger)'
    }
  ];

  const handleDownloadAllCSV = () => {
    downloadAllClientROICSV(roiHistory, client);
  };

  const handleDownloadAllPDF = () => {
    downloadAllClientROIPDF(roiHistory, client);
  };

  const handleDownloadSingleCSV = (roi) => {
    downloadClientROISingleCSV(roi, client);
  };

  const handleDownloadSinglePDF = (roi) => {
    downloadClientROISinglePDF(roi, client, investments);
  };

  return (
    <div className="kfpl-page kfpl-investment-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">Your Investment</h1>
          <p className="kfpl-page-subtitle">Track your investment allocation, ROI, and bonuses</p>
        </div>
      </div>

      <section className="kfpl-investment-summary" aria-label="Investment summary">
        {summaryCards.map((card, idx) => (
          <KpiCard
            key={card.label}
            title={card.label}
            value={card.value}
            trend={card.trend}
            trendDirection={card.trendDirection}
            meta={card.meta}
            icon={card.icon}
            iconColor={card.iconColor}
            variant={card.variant}
            style={{ '--card-border-color': card.borderColor }}
            delay={idx * 60}
          />
        ))}
      </section>

      <div className="kfpl-investment-analytics">
        <div className="kfpl-chart-card kfpl-investment-card kfpl-investment-allocation-card">
          <div className="kfpl-chart-card-header">
            <div>
              <h3 className="kfpl-chart-card-title">Segment Allocation</h3>
              <p className="kfpl-investment-card-subtitle">Portfolio split by active investment category</p>
            </div>
            <span className="kfpl-investment-total">{formatAmount(total)}</span>
          </div>

          <div 
            className="kfpl-donut-container"
            style={{ position: 'relative' }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltipPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
            }}
          >
            <div className="kfpl-donut-chart" style={{ width: '190px', height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }} role="img" aria-label="Investment segment allocation donut chart">
                {segments.map((segment, index) => {
                  const isHovered = hoveredSegment && hoveredSegment.id === segment.id;
                  const slicePath = getPieSlicePath(50, 50, 48, segment.start, segment.visualPercent);
                  return (
                    <path
                      key={index}
                      d={slicePath}
                      fill={segment.color}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      style={{
                        transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                        transformOrigin: '50px 50px',
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.25s ease',
                        filter: isHovered ? `drop-shadow(0 6px 14px ${segment.color}60)` : 'none',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={() => setHoveredSegment(segment)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  );
                })}
              </svg>
            </div>

            <div className="kfpl-investment-legend">
              {segments.map((segment, index) => (
                <div
                  key={index}
                  className="kfpl-investment-legend-item"
                  style={{
                    borderColor: hoveredSegment && hoveredSegment.id === segment.id ? segment.color : 'rgba(226, 236, 231, 0.9)',
                    boxShadow: hoveredSegment && hoveredSegment.id === segment.id ? `0 4px 12px ${segment.color}15` : 'none',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredSegment(segment)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  <div className="kfpl-chart-legend-dot" style={{ background: segment.color }}></div>
                  <div className="kfpl-investment-legend-copy">
                    <span className="kfpl-chart-legend-label">{segment.segment}</span>
                    <span className="kfpl-investment-legend-amount">{formatAmount(segment.amount)}</span>
                  </div>
                  <span className="kfpl-chart-legend-value">{segment.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>

            {hoveredSegment && (
              <div
                className="kfpl-chart-tooltip"
                style={{
                  position: 'absolute',
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y - 15}px`,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(10, 25, 18, 0.96)',
                  border: '1px solid rgba(201, 168, 76, 0.3)',
                  color: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  zIndex: 99999,
                  pointerEvents: 'none',
                  boxShadow: '0 8px 24px rgba(6, 29, 19, 0.3)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-gold)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: hoveredSegment.color }}></span>
                  {hoveredSegment.projectName || 
                   (typeof hoveredSegment.projectId === 'object' && hoveredSegment.projectId?.name) ||
                   (typeof hoveredSegment.project === 'object' && hoveredSegment.project?.name) ||
                   'Unallocated'}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '2px' }}>
                  Segment: <strong>{hoveredSegment.segment || 'Unallocated'}</strong>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '4px' }}>
                  Share: <strong>{hoveredSegment.percent.toFixed(1)}%</strong>
                </div>
                <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.85rem' }}>
                  {formatAmount(hoveredSegment.amount)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="kfpl-calculator kfpl-investment-card">
          <div className="kfpl-investment-card-heading">
            <h3 className="kfpl-chart-card-title">ROI Calculator</h3>
            <p className="kfpl-investment-card-subtitle">Estimate projected returns from any principal amount</p>
          </div>

          <div className="kfpl-form-section kfpl-investment-calculator-fields">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Principal Amount (₹)</label>
              <input
                type="number"
                className="kfpl-input"
                value={calcPrincipal}
                onChange={event => setCalcPrincipal(Number(event.target.value))}
              />
            </div>

            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Monthly ROI %</label>
              <input
                type="number"
                className="kfpl-input"
                value={calcRate}
                onChange={event => setCalcRate(Number(event.target.value))}
                step="0.5"
              />
            </div>
          </div>

          <div className="kfpl-calculator-result">
            <div className="kfpl-calculator-result-label">Monthly Returns</div>
            <div className="kfpl-calculator-result-value">{formatAmount(monthlyReturn)}</div>
            <div className="kfpl-calculator-result-label kfpl-calculator-result-note">
              Annual Returns: {formatAmount(annualReturn)}
            </div>
          </div>
        </div>
      </div>

      <div className="kfpl-table-wrapper kfpl-investment-table">
        <div className="kfpl-table-header">
          <div>
            <h3 className="kfpl-table-title">Investment Allocation</h3>
            <p className="kfpl-investment-card-subtitle">Portfolio split and allocated percentage by category</p>
          </div>
        </div>

        <div className="kfpl-segment-allocation-grid">
          {segments.map((segment, index) => {
            const segTitle = (!segment.segment || segment.segment === 'Project Allocated' || segment.segment === 'Unallocated' || segment.segment === 'General Capital Pool')
              ? 'Capital Deposit'
              : segment.segment;

            const projName = segment.projectName || 
                             (typeof segment.projectId === 'object' && segment.projectId?.name) ||
                             (typeof segment.project === 'object' && segment.project?.name) ||
                             (typeof segment.project === 'string' && segment.project ? segment.project : '') ||
                             'Unallocated';

            return (
              <div
                key={index}
                className="kfpl-segment-allocation-item-card"
                style={{
                  borderColor: hoveredSegment && hoveredSegment.id === segment.id ? segment.color : 'rgba(226, 236, 231, 0.9)',
                  boxShadow: hoveredSegment && hoveredSegment.id === segment.id ? `0 12px 28px rgba(6, 29, 19, 0.08)` : '0 4px 20px rgba(6, 29, 19, 0.02)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="kfpl-segment-card-header">
                  <div className="kfpl-segment-card-title-wrap">
                    <span className="kfpl-segment-card-dot" style={{ background: segment.color }}></span>
                    <span className="kfpl-segment-card-title">{segTitle}</span>
                  </div>
                  <span className="kfpl-segment-card-status-badge">{segment.status}</span>
                </div>

                <div className="kfpl-segment-card-project-row">
                  <span className="kfpl-segment-card-project-label">Project:</span>
                  <span className="kfpl-segment-card-project-value" style={{ color: segment.color }}>{projName}</span>
                </div>

                <div className="kfpl-segment-card-amount-block">
                  <div>
                    <div className="kfpl-segment-card-amount-label">Capital Invested</div>
                    <div className="kfpl-segment-card-amount-value">{formatAmount(segment.amount)}</div>
                  </div>
                </div>

                <div className="kfpl-segment-card-details-row">
                  <span className="kfpl-segment-detail-label">Monthly ROI</span>
                  <span className="kfpl-segment-detail-value" style={{ fontWeight: 700, color: segment.color }}>{segment.roiAllocated}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="kfpl-table-wrapper kfpl-investment-table">
        <div className="kfpl-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 className="kfpl-table-title">Monthly ROI History</h3>
            <p className="kfpl-investment-card-subtitle">Expected versus credited return history</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="kfpl-filter-chips" style={{ marginBottom: 0 }}>
              {['All', 'Paid', 'Pending'].map(filter => (
                <button
                  key={filter}
                  type="button"
                  className={`kfpl-filter-chip ${roiFilter === filter ? 'active' : ''}`}
                  onClick={() => setRoiFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="kfpl-select"
              style={{ width: '120px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <option value="all">All Years</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            
            <button
              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
              onClick={handleDownloadAllCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.8125rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV (All)
            </button>

            <button
              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
              onClick={handleDownloadAllPDF}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.8125rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Print Statement (All)
            </button>
          </div>
        </div>

        <div className="kfpl-table-container">
          <table className="kfpl-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Expected</th>
                <th>Received</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Statement</th>
              </tr>
            </thead>
            <tbody>
              {filteredROI.map((roi, index) => (
                <tr key={index}>
                  <td className="kfpl-table-cell-primary">{roi.month}</td>
                  <td className="kfpl-table-cell-mono">{formatAmount(roi.expected)}</td>
                  <td className="kfpl-table-cell-mono">{roi.received > 0 ? formatAmount(roi.received) : '\u2014'}</td>
                  <td>{formatDate(roi.date)}</td>
                  <td><span className={`kfpl-badge kfpl-badge--${roi.status.toLowerCase()}`}>{roi.status}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        onClick={() => handleDownloadSingleCSV(roi)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--color-border)' }}
                        title="Download CSV"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                        </svg>
                        CSV
                      </button>
                      <button
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        onClick={() => handleDownloadSinglePDF(roi)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--color-border)' }}
                        title="Print / PDF"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                        </svg>
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>



      {/* Dynamic Dividend Earnings Section */}
      <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 4px 0' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, color: 'var(--color-gold-dark)' }}>
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Dividend & Bonus Earnings
        </h3>
        
        {clientDividends.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.42)', border: '1px dashed var(--color-border)', borderRadius: '12px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No dividends credited yet for your active investments.
          </div>
        ) : (
          clientDividends.map(div => (
            <div className="kfpl-dividend-card" key={div.id}>
              <div className="kfpl-dividend-card-icon" aria-hidden="true" style={{ color: 'var(--color-gold-dark)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="kfpl-dividend-card-content">
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 4px 0' }}>
                  <span>Dividend Bonus Credited</span>
                  <span style={{ color: 'var(--color-success)', fontSize: '1.05rem', fontWeight: 800 }}>+{formatAmount(div.amount)}</span>
                </h3>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  Received from <strong>{div.projectName}</strong> ({div.segment})
                </p>
                <p className="kfpl-dividend-card-note" style={{ marginTop: '6px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  Credited on {new Date(div.creditDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {div.adminNote && ` — ${div.adminNote}`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============ END: InvestmentOverview.jsx ============ */
