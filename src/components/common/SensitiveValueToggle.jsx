import { useState } from 'react';

/**
 * Reusable Eye Toggle Component for Sensitive PII Fields
 * Displays masked string (e.g. •••••••• 4829) by default with a high-visibility Eye toggle button.
 */
export default function SensitiveValueToggle({ value, maskLength = 4, style = {} }) {
  const [show, setShow] = useState(false);

  if (!value || value === '—' || value === '-') {
    return <span style={{ color: 'rgba(255, 255, 255, 0.5)', ...style }}>—</span>;
  }

  const str = String(value).trim();

  const getMasked = (val) => {
    if (val.length <= maskLength) return val;
    const visibleSuffix = val.slice(-maskLength);
    const maskedPrefix = '•'.repeat(Math.min(val.length - maskLength, 8));
    return `${maskedPrefix} ${visibleSuffix}`;
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', ...style }}>
      <span style={{ fontWeight: 600, fontFamily: show ? 'inherit' : 'monospace', letterSpacing: show ? 'normal' : '1px' }}>
        {show ? str : getMasked(str)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShow(!show);
        }}
        title={show ? 'Hide sensitive information' : 'Show full unmasked sensitive information'}
        style={{
          background: show ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.22)',
          border: show ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(16, 185, 129, 0.6)',
          borderRadius: '6px',
          padding: '3px 10px',
          cursor: 'pointer',
          color: show ? '#FBBF24' : '#34D399',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '0.75rem',
          fontWeight: 700,
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
        }}
      >
        {show ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            <span>Hide</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Show</span>
          </>
        )}
      </button>
    </span>
  );
}
