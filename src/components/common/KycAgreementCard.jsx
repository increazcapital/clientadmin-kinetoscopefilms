/* ============================================================
   Component: KycAgreementCard.jsx
   Description: Home Screen & Profile KYC Agreement Upload & Download Card for Client Portal.
                Downloads the exact original client agreement.docx file,
                displays highlighted instructions to save as PDF for upload,
                uploads signed pdf/doc/docx for KYC review.
                On Dashboard Home: Shows 24h Congratulations Banner when verified, then hides completely after 24h.
                On Profile Page: Permanently displays verified document view & download.
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';

export default function KycAgreementCard({
  agreementUrl,
  agreementVerified,
  agreementVerifiedAt,
  clientName,
  onUploadSuccess,
  isDashboardHome = false,
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);

  const nameKey = (clientName || 'client').replace(/\s+/g, '_');

  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`client_kyc_banner_dismissed_${nameKey}`) === 'true';
  });

  // ── Calculate 2-hour expiration for verified banner on Dashboard Home ──
  let isExpired = dismissed;
  if (agreementVerified && !isExpired) {
    let verifyTime = agreementVerifiedAt ? new Date(agreementVerifiedAt).getTime() : null;
    const storageKey = `client_agreement_verified_time_${nameKey}`;
    if (!verifyTime) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        verifyTime = parseInt(stored, 10);
      } else {
        verifyTime = Date.now();
        localStorage.setItem(storageKey, verifyTime.toString());
      }
    } else {
      localStorage.setItem(storageKey, verifyTime.toString());
    }
    const elapsedHours = (Date.now() - verifyTime) / (1000 * 60 * 60);
    if (elapsedHours >= 2) {
      isExpired = true;
    }
  }

  // 1. If on Dashboard Home & verified for > 2 hours or dismissed -> Hide completely from Dashboard Home!
  if (isDashboardHome && agreementVerified && isExpired) {
    return null;
  }

  // 2. If on Dashboard Home & verified for <= 2 hours -> Show Congratulations Banner!
  if (isDashboardHome && agreementVerified && !isExpired) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          padding: '18px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.08)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#10B981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
            }}
          >
            ✓
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#065F46' }}>
              Congratulations! Official Agreement Verified & Approved 🎉
            </h4>
            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#047857', lineHeight: 1.45 }}>
              Your signed agreement and KYC documents have been successfully verified by Kinetoscope Films Team. You can view or download your official contract anytime in your <strong>My Profile</strong> page.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="kfpl-btn kfpl-btn--secondary"
            onClick={() => navigate('/profile')}
            style={{ fontSize: '0.8rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
          >
            View in My Profile
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`client_kyc_banner_dismissed_${nameKey}`, 'true');
              setDismissed(true);
            }}
            style={{
              background: 'rgba(6, 95, 70, 0.1)',
              border: 'none',
              color: '#065F46',
              fontSize: '1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '8px',
              lineHeight: 1
            }}
            title="Dismiss banner"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  /* ── Download Exact Original Client Agreement .docx File ─ */
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/agreements/client_agreement.docx';
    link.download = 'Client_Agreement.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Official Client Agreement (.docx) downloaded successfully!', 'success', 'Download Complete');
  };

  /* ── File Upload Handler ────────────────── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['pdf', 'docx', 'doc', 'jpeg', 'jpg', 'png', 'webp'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      addToast('Please upload a .pdf, .docx, .doc, or Image file.', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      addToast('File size must be under 15 MB.', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest('/api/client/documents/agreement', {
        method: 'POST',
        body: formData,
      });

      if (res && (res.success || res.status === 'success' || res.data?.agreementDocument)) {
        const uploadedUrl = res.data?.agreementDocument || res.agreementDocument || '';
        addToast('Signed agreement uploaded successfully for KYC review!', 'success');
        if (onUploadSuccess) onUploadSuccess(uploadedUrl);
      } else {
        addToast(res?.message || 'Failed to upload agreement.', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Error uploading agreement document.', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const hasAgreement = Boolean(agreementUrl && agreementUrl.trim() !== '');

  return (
    <div
      style={{
        background: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-border-light, #e2e8f0)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--color-success, #10B981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 15l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)' }}>
                Official Client Participation Agreement (KYC Requirement)
              </h3>
              {hasAgreement ? (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: agreementVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: agreementVerified ? '#059669' : '#D97706',
                    border: `1px solid ${agreementVerified ? '#10B981' : '#F59E0B'}`,
                  }}
                >
                  {agreementVerified ? 'VERIFIED AGREEMENT' : 'SIGNED & UPLOADED (PENDING REVIEW)'}
                </span>
              ) : (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#DC2626',
                    border: '1px solid #EF4444',
                  }}
                >
                  ACTION REQUIRED
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--color-text-muted, #64748b)', lineHeight: 1.5 }}>
              Download the official Client Agreement (.docx) document, fill in your required details, and upload the signed agreement for KYC verification.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {!agreementVerified && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="kfpl-btn kfpl-btn--secondary"
              onClick={handleDownloadTemplate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', padding: '8px 14px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Agreement (.docx)
            </button>

            <label
              className="kfpl-btn kfpl-btn--primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8125rem',
                padding: '8px 16px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploading ? 'Uploading...' : hasAgreement ? 'Re-upload Signed Copy' : 'Upload Signed Agreement'}
              <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileChange} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>

      {/* ═══ HIGHLIGHTED INSTRUCTION BOX FOR PDF UPLOAD (Only when not verified) ═══ */}
      {!agreementVerified && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{ color: '#B45309', marginTop: '2px', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#92400E', lineHeight: 1.5 }}>
            <strong style={{ color: '#B45309', fontWeight: 700 }}>Kindly Note:</strong> After downloading the agreement (.docx), please fill in your details, sign the contract, and save/export or scan it as a PDF file (.pdf). Uploading in <strong>PDF format (.pdf)</strong> is highly recommended for official KYC verification and instant in-browser document preview.
          </div>
        </div>
      )}

      {/* Uploaded File Info Card */}
      {hasAgreement && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px 16px',
            background: 'var(--color-background, #f8fafc)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold, #b38600)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)' }}>
                {clientName ? `${clientName.replace(/\s+/g, '_')}_Signed_Agreement` : 'Signed_Client_Agreement'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted, #64748b)' }}>
                Document uploaded for Super Admin verification • Cloud Secured
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href={agreementUrl}
              target="_blank"
              rel="noreferrer"
              className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
              style={{ fontSize: '0.75rem', padding: '5px 12px', textDecoration: 'none' }}
            >
              View Document
            </a>
            <a
              href={agreementUrl}
              download
              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
              style={{ fontSize: '0.75rem', padding: '5px 10px' }}
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
