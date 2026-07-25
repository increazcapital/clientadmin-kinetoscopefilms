/* ============================================================
   Component: LineChart.jsx
   Description: SVG line chart with clean curves and hover tooltip
   ============================================================ */

import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function LineChart({ data, height = 220, color = '#10B981' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return (
      <div className="kfpl-line-chart-wrap" style={{ height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', gap: '8px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span>No historical ROI earnings recorded yet</span>
      </div>
    );
  }

  // Handle single data point by padding previous 5 months as baseline
  let chartData = [...data];
  if (chartData.length === 1) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const singleMonthStr = chartData[0].month || 'Jul';
    let monthIdx = months.findIndex(m => m.toLowerCase() === singleMonthStr.toLowerCase().slice(0, 3));
    if (monthIdx === -1) monthIdx = new Date().getMonth();

    const padded = [];
    for (let i = 5; i >= 1; i--) {
      const idx = (monthIdx - i + 12) % 12;
      padded.push({ month: months[idx], amount: 0 });
    }
    padded.push(chartData[0]);
    chartData = padded;
  }

  const values = chartData.map(d => Number(d.amount || 0));
  const maxValRaw = Math.max(...values, 0);
  const minValRaw = Math.min(...values, 0);
  const diff = maxValRaw - minValRaw;

  // Ensure top and bottom breathing room
  const maxVal = maxValRaw + (diff === 0 ? (maxValRaw > 0 ? maxValRaw * 0.4 : 100) : diff * 0.25);
  const minVal = Math.max(0, minValRaw - (diff === 0 ? (maxValRaw > 0 ? maxValRaw * 0.4 : 0) : diff * 0.1));

  const padding = { top: 30, right: 35, bottom: 40, left: 35 };
  const chartWidth = 540;
  const chartHeight = height;
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const getX = (i) => padding.left + (i / (chartData.length > 1 ? chartData.length - 1 : 1)) * plotW;
  const getY = (val) => {
    const range = maxVal - minVal;
    if (range === 0) return padding.top + plotH / 2;
    return padding.top + plotH - (((val || 0) - minVal) / range) * plotH;
  };

  const points = chartData.map((d, i) => ({ x: getX(i), y: getY(Number(d.amount || 0)) }));

  // Build Smooth Bezier Curve Path
  let linePath = '';
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      linePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  // Area path for subtle clean fill
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + plotH} L ${points[0].x} ${padding.top + plotH} Z`
    : '';

  // Grid lines (3 horizontal lines)
  const gridCount = 3;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const y = padding.top + (plotH / gridCount) * i;
    const val = maxVal - ((maxVal - minVal) / gridCount) * i;
    return { y, val };
  });

  const activePoint = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  return (
    <div className="kfpl-line-chart-wrap" style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: `${height}px`, overflow: 'visible' }}>
        <defs>
          <linearGradient id="roiAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <g className="kfpl-line-chart-grid">
          {gridLines.map((g, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={g.y}
              x2={chartWidth - padding.right}
              y2={g.y}
              stroke="var(--color-border-light, #E2E8F0)"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.6"
            />
          ))}
        </g>

        {/* Area fill */}
        <path d={areaPath} fill="url(#roiAreaGradient)" />

        {/* Clean Line Path */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Dots */}
        {points.map((p, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? color : '#FFFFFF'}
                stroke={color}
                strokeWidth="2.5"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  setHoveredIndex(i);
                  const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        {chartData.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={chartHeight - 10}
            textAnchor="middle"
            style={{
              fontSize: '11px',
              fontWeight: hoveredIndex === i ? 700 : 500,
              fill: hoveredIndex === i ? color : 'var(--color-text-muted, #64748B)',
              transition: 'fill 0.15s ease',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            {d.month}
          </text>
        ))}
      </svg>

      {/* ── Clean Floating Info Tooltip ─────────────────────── */}
      {hoveredIndex !== null && activePoint && (
        <div
          style={{
            position: 'absolute',
            top: `${mousePos.y - 65}px`,
            left: `${mousePos.x}px`,
            transform: 'translateX(-50%)',
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
            color: '#FFFFFF',
            zIndex: 1000,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            transition: 'top 0.05s ease-out, left 0.05s ease-out'
          }}
        >
          <div style={{ fontSize: '0.725rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {activePoint.month} Payout
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: color, marginTop: '2px' }}>
            {formatCurrency(activePoint.amount)}
          </div>
        </div>
      )}
    </div>
  );
}
