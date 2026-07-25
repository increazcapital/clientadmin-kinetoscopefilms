/* ============================================================
   Component: DonutChart.jsx (Solid Pie Chart)
   Description: True Solid Pie Chart with clean hover info tooltip
   ============================================================ */

import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

const SEGMENT_COLORS = ['#10B981', '#1565C0', '#F59E0B', '#7C3AED', '#0891B2', '#EC4899'];

export default function DonutChart({ data, size = 220, defaultLabel = 'Segments', defaultValue, totalInvestment = 0 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 110, y: 110 });

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: `${size}px`, color: 'var(--color-text-muted)', fontSize: '0.85rem', gap: '8px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
          <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
        </svg>
        <span>No allocation data available</span>
      </div>
    );
  }

  // Math for 100% Solid Pie Chart (No center hole)
  const actualStrokeWidth = (size - 16) / 2;
  const radius = (size - 16) / 4;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate total portfolio sum from data or prop
  const totalSum = totalInvestment || data.reduce((s, item) => s + (item.amount || item.investmentAmount || 0), 0);

  // Calculate segment offsets
  let accumulated = 0;
  const segments = data.map((item, i) => {
    const percent = item.value !== undefined ? item.value : (item.percentage || 0);
    const dashArray = circumference * (percent / 100);
    const dashOffset = circumference * (1 - accumulated / 100);
    accumulated += percent;

    const segmentAmt = item.amount || item.investmentAmount || (totalSum > 0 ? Math.round((totalSum * percent) / 100) : 0);

    return {
      ...item,
      percent,
      amount: segmentAmt,
      dashArray,
      dashOffset,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    };
  });

  const activeSeg = hoveredIndex !== null ? segments[hoveredIndex] : null;

  return (
    <div className="kfpl-pie-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="kfpl-pie-wrap" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg width={size} height={size} className="kfpl-pie-chart" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {/* Background disc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-surface, #F1F5F9)"
            strokeWidth={actualStrokeWidth}
          />
          {/* Solid Pie Slices */}
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={hoveredIndex === i ? actualStrokeWidth + 4 : actualStrokeWidth}
              strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
              strokeDashoffset={seg.dashOffset}
              className="kfpl-pie-segment"
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
              style={{
                transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.5 : 1,
                cursor: 'pointer'
              }}
            />
          ))}
        </svg>
      </div>

      {/* ── Clean Mouse-Tracking Hover Info Box Tooltip ─────────────────────── */}
      {hoveredIndex !== null && activeSeg && (
        <div
          className="kfpl-pie-hover-info-box"
          style={{
            position: 'absolute',
            top: `${mousePos.y - 100}px`,
            left: `${mousePos.x}px`,
            transform: 'translateX(-50%)',
            background: '#0F172A',
            border: `1.5px solid ${activeSeg.color}`,
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
            color: '#FFFFFF',
            zIndex: 1000,
            minWidth: '190px',
            pointerEvents: 'none',
            transition: 'top 0.05s ease-out, left 0.05s ease-out',
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeSeg.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#F8FAFC' }}>{activeSeg.segment}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.775rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>Allocation:</span>
              <span style={{ fontWeight: 800, color: activeSeg.color }}>{activeSeg.percent}%</span>
            </div>
            {activeSeg.amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                <span style={{ color: '#94A3B8', fontWeight: 500 }}>Investment:</span>
                <span style={{ fontWeight: 800, color: '#10B981' }}>{formatCurrency(activeSeg.amount)}</span>
              </div>
            )}
            {activeSeg.roiPercentage && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                <span style={{ color: '#94A3B8', fontWeight: 500 }}>Expected ROI:</span>
                <span style={{ fontWeight: 800, color: '#F59E0B' }}>{activeSeg.roiPercentage}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
