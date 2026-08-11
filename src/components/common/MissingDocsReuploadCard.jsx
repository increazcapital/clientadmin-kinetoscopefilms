import { useState } from 'react';
import { apiRequest } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';

export default function MissingDocsReuploadCard({ client, loading = false, onDocUploaded }) {
  const { addToast } = useToast();
  const [uploadingDoc, setUploadingDoc] = useState(null);

  if (loading || !client) return null;

  // Determine missing documents (agreement is handled exclusively by KycAgreementCard)
  const missingList = [];
  if (!client.panDocument) {
    missingList.push({ key: 'panDocument', label: 'PAN Card Document' });
  }
  if (!client.aadhaarDocument && !client.idProofDocument) {
    missingList.push({ key: 'aadhaarDocument', label: 'ID Proof (Aadhaar / Passport)' });
  }
  if (!client.bankProofDocument) {
    missingList.push({ key: 'bankProofDocument', label: 'Bank Details Document' });
  }
  if (!client.agreementDocument) {
    missingList.push({ key: 'agreementDocument', label: 'Signed Client Participation Agreement' });
  }

  if (missingList.length === 0) return null;

  const handleFileUpload = async (docKey, file) => {
    if (!file) return;

    const allowed = ['pdf', 'docx', 'doc', 'jpeg', 'jpg', 'png', 'webp'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      addToast('Please select a valid PDF, DOCX, or Image file.', 'error');
      return;
    }

    setUploadingDoc(docKey);

    try {
      const formData = new FormData();
      formData.append(docKey, file);
      formData.append('docType', docKey);
      formData.append('file', file);

      let res;
      if (docKey === 'agreementDocument') {
        res = await apiRequest('/api/client/documents/agreement', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await apiRequest('/api/client/documents/kyc', {
          method: 'POST',
          body: formData,
        });
      }

      const updatedUrl = res?.data?.url || res?.data?.agreementDocument || res?.data?.[docKey] || 'uploaded';
      addToast(`${file.name} uploaded successfully! Kinetoscope Films Team will review it shortly.`, 'success', 'Upload Successful');
      onDocUploaded?.(docKey, updatedUrl);
    } catch (err) {
      console.error('Failed to upload document:', err);
      addToast(err.message || 'Failed to upload document.', 'error', 'Upload Error');
    } finally {
      setUploadingDoc(null);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.85) 100%)',
        border: '1px solid rgba(248, 113, 113, 0.45)',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#991B1B', letterSpacing: '-0.2px' }}>
            Action Required: Missing KYC Document(s) Re-upload
          </h4>
          <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#B91C1C', lineHeight: 1.45, fontWeight: 500 }}>
            The <strong>Kinetoscope Films Team</strong> requires you to re-upload the following document(s) to verify your account:
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '16px' }}>
        {missingList.map((doc) => (
          <div
            key={doc.key}
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(252, 165, 165, 0.8)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span
                  style={{
                    background: '#FEE2E2',
                    color: '#991B1B',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Action Required
                </span>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0F172A' }}>
                {doc.label}
              </div>
            </div>

            <div>
              <input
                type="file"
                id={`missing-client-${doc.key}`}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                style={{ display: 'none' }}
                disabled={uploadingDoc === doc.key}
                onChange={(e) => handleFileUpload(doc.key, e.target.files?.[0])}
              />
              <label
                htmlFor={`missing-client-${doc.key}`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.84rem',
                  padding: '10px 16px',
                  cursor: uploadingDoc === doc.key ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  border: 'none',
                  transition: 'all 0.2s ease',
                  userSelect: 'none',
                }}
              >
                {uploadingDoc === doc.key ? (
                  <>
                    <svg className="kfpl-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    </svg>
                    Uploading File...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload {doc.label.split(' ')[0]} Document
                  </>
                )}
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
