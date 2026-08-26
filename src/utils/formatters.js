// ID & Currency Formatters

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(2)} K`;
  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-IN');
}

export function formatROI(roi) {
  if (roi === undefined || roi === null) return '0%';
  const num = Number(roi);
  if (isNaN(num)) return String(roi);
  return `${num.toFixed(1)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return String(dateStr);
  }
}

export function getCategoryFromAmount(amount) {
  if (amount > 10000000) return 'diamond';
  if (amount > 2500000) return 'gold';
  return 'silver';
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return String(dateStr);
  }
}

export function getTier(amount) {
  if (amount > 10000000) return 'diamond';
  if (amount > 2500000) return 'gold';
  return 'silver';
}

export function formatClientID(rawId) {
  if (!rawId || rawId === '—' || rawId === 'undefined' || rawId === 'null') return 'YLDIQ-CL-1001';
  const str = String(rawId).trim();
  const m = str.match(/(?:CL[-_ ]*)+([0-9]+)/i) || str.match(/([0-9]+)/);
  if (m && m[1]) {
    let val = parseInt(m[1], 10);
    if (val < 1000) val += 1000;
    return `YLDIQ-CL-${val}`;
  }
  return 'YLDIQ-CL-1001';
}

export function formatAgentID(rawId) {
  if (!rawId || rawId === '—' || rawId === 'undefined' || rawId === 'null') return 'YLDIQ-AG-1001';
  const str = String(rawId).trim();
  const m = str.match(/(?:AG|AGT)[-_ ]*([0-9]+)/i) || str.match(/([0-9]+)/);
  if (m && m[1]) {
    let val = parseInt(m[1], 10);
    if (val < 1000) val += 1000;
    return `YLDIQ-AG-${val}`;
  }
  return 'YLDIQ-AG-1001';
}
