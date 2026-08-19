/* ============================================================
   Page: Portfolio.jsx
   Description: KFPL portfolio with premium segment overview and project detail drawer
   ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SEGMENTS } from '../../constants';
import { apiRequest } from '../../config/apiHelper';
import { getSWRCache, setSWRCache } from '../../utils/swrHelper';
import { formatCurrency } from '../../utils/formatters';

const SEGMENT_COLORS = {
  'Film Making': '#10B981',
  Music: '#7C3AED',
  Distribution: '#2563EB',
  'Trading & Syndication': '#F59E0B',
  'Content IP Bank': '#0F766E',
  'Film Exhibition': '#0891B2',
};

const SEGMENT_ABBR = {
  'Film Making': 'FM',
  Distribution: 'DS',
  Music: 'MS',
  'Trading & Syndication': 'TS',
  'Content IP Bank': 'IP',
  'Film Exhibition': 'EX',
};

function cleanValue(value) {
  return value.replace(/^.+?(?=\d)/, '\u20B9');
}

function parseCroreValue(value) {
  const cleaned = cleanValue(value);
  const match = cleaned.match(/([\d.]+)\s*(Cr|L)/i);

  if (!match) return 0;

  const number = Number(match[1]);
  return match[2].toLowerCase() === 'cr' ? number : number / 100;
}

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('All');
  const [drawerProject, setDrawerProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMediaIndex, setActiveMediaIndex] = useState(null);

  const [dbSegments, setDbSegments] = useState([]);

  useEffect(() => {
    if (!drawerProject) {
      setActiveMediaIndex(null);
    }
  }, [drawerProject]);

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

  useEffect(() => {
    // --- User-Scoped SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const parsed = getSWRCache('cl_portfolio');
      if (parsed) {
        const sanitizedCache = parsed.map(p => ({
          ...p,
          minInvestment: p.minInvestment !== undefined ? p.minInvestment : 200000
        }));
        setProjects(sanitizedCache);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to parse portfolio cache:', e);
    }

    const fetchProjects = async () => {
      try {
        const [projectsRes, investmentsRes, segmentsRes] = await Promise.all([
          apiRequest('/api/client/projects').catch(() => null),
          apiRequest('/api/client/investments').catch(() => null),
          apiRequest('/api/client/segments').catch(() => null),
        ]);

        if (segmentsRes) {
          const segList = Array.isArray(segmentsRes)
            ? segmentsRes
            : (segmentsRes.segments || segmentsRes.data?.segments || (Array.isArray(segmentsRes.data) ? segmentsRes.data : []));
          setDbSegments(segList);
        }

        const raw = extractProjects(projectsRes);
        const filteredRaw = raw.filter(p => p.name !== '__KFPL_DUMMY__');

        // Extract client's invested project IDs and segment names
        let myProjectIds = [];
        let mySegments = [];
        if (investmentsRes) {
          const list = Array.isArray(investmentsRes) 
            ? investmentsRes 
            : (investmentsRes.investments || investmentsRes.data?.investments || (Array.isArray(investmentsRes.data) ? investmentsRes.data : []));
          
          list.forEach(inv => {
            // Extract from top-level projectId
            const proj = inv.projectId || inv.project || '';
            if (proj && typeof proj === 'object') {
              myProjectIds.push(String(proj._id || proj.id || ''));
            } else if (proj) {
              myProjectIds.push(String(proj));
            }
            if (inv.segment) {
              mySegments.push(inv.segment.trim().toLowerCase());
            }

            // Also extract from segmentAllocation[] for multi-segment investments
            if (Array.isArray(inv.segmentAllocation)) {
              inv.segmentAllocation.forEach(alloc => {
                if (alloc.projectId) {
                  const allocProjId = typeof alloc.projectId === 'object'
                    ? String(alloc.projectId._id || alloc.projectId.id || '')
                    : String(alloc.projectId);
                  if (allocProjId) myProjectIds.push(allocProjId);
                }
                if (alloc.segmentName) {
                  mySegments.push(alloc.segmentName.trim().toLowerCase());
                }
              });
            }
          });
        }

        // Filter projects: show client's invested projects if available, otherwise show complete portfolio catalog
        let investedProjects = filteredRaw.filter(p => {
          const pId = String(p._id || p.id);
          const hasIdMatch = myProjectIds.includes(pId);
          if (hasIdMatch) return true;

          const pSeg = (p.segment || '').trim().toLowerCase();
          return mySegments.includes(pSeg);
        });

        // Fallback to all company portfolio projects if client has no specific investment projects matched
        let finalProjectsList = investedProjects.length > 0 ? investedProjects : filteredRaw;

        const mapped = finalProjectsList.map(p => ({
          id: p._id || p.id,
          name: p.name || '',
          segment: p.segment || '',
          status: p.status || 'Planning',
          targetFunding: p.targetFunding || 0,
          fundedAmount: p.fundedAmount || 0,
          minInvestment: p.minInvestment !== undefined ? p.minInvestment : (p.minInvestmentAmount || 200000),
          value: p.targetFunding
            ? formatCurrency(p.targetFunding)
            : (p.portfolioValue && p.portfolioValue !== '₹0.0 Cr' && p.portfolioValue !== '₹0 Cr' ? p.portfolioValue : formatCurrency(Number(p.value || 0))),
          totalSlots: p.totalSlots !== undefined ? p.totalSlots : 20,
          slotsAvailable: p.slotsAvailable !== undefined ? p.slotsAvailable : 20,
          bookedSlots: p.bookedSlots !== undefined ? p.bookedSlots : Math.max(0, (p.totalSlots || 20) - (p.slotsAvailable || 20)),
          milestone: p.milestoneProgress !== undefined ? p.milestoneProgress : (p.milestone !== undefined ? p.milestone : 0),
          summary: p.summary || '',
          risk: p.riskLevel || p.risk || 'Medium',
          horizon: p.horizon || '',
          roi: p.monthlyRoi || p.roi || '',
          health: p.health || 'On Track',
          media: (p.mediaFiles || []).map(url => {
            const cleanUrl = url.split('?')[0];
            const lastSegment = cleanUrl.split('/').pop() || '';
            const rawExt = lastSegment.includes('.') ? lastSegment.split('.').pop()?.toLowerCase() : '';
            const ext = (rawExt && rawExt.length <= 5) ? rawExt : '';
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'tiff'];
            const isRawUpload = cleanUrl.includes('/raw/upload/');
            return {
              id: url,
              name: lastSegment || 'File',
              url: url,
              ext: ext,
              isImage: imageExts.includes(ext),
              isRawUpload: isRawUpload
            };
          }),
          bannerImg: p.bannerImage || p.bannerImg || '',
          update: p.currentUpdate || p.update || '',
          allocation: p.allocationFocus || p.allocation || '',
        }));
        setProjects(mapped);
        setSWRCache('cl_portfolio', mapped);
      } catch (err) {
        console.error('Failed to load portfolio projects, using fallback:', err);
        const stored = localStorage.getItem('kfpl_portfolio_projects');
        if (stored) {
          setProjects(JSON.parse(stored));
        } else {
          setProjects([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!drawerProject) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [drawerProject]);

  const enrichedProjects = useMemo(() => {
    return projects.map(project => {
      return {
        ...project,
        summary: project.summary || '',
        risk: project.risk || 'Medium',
        horizon: project.horizon || '12 Months',
        roi: project.roi || '1.0%',
        health: project.health || 'On Track',
        update: project.update || '',
        allocation: project.allocation || '',
        accent: SEGMENT_COLORS[project.segment] || '#10B981',
        valueLabel: (project.value && project.value !== '₹0.0 Cr' && project.value !== '₹0 Cr')
          ? cleanValue(project.value)
          : formatCurrency(project.targetFunding || 0),
        valueCr: parseCroreValue(project.value || '₹0 Cr'),
        initials: SEGMENT_ABBR[project.segment] || (project.name || 'KP').slice(0, 2).toUpperCase(),
      };
    });
  }, [projects]);

  const filteredProjects = activeTab === 'All'
    ? enrichedProjects
    : enrichedProjects.filter(project => (project.segment || '').trim().toLowerCase() === activeTab.trim().toLowerCase());

  const clientInvestmentSum = useMemo(() => {
    try {
      const auth = localStorage.getItem('kfpl_client_auth');
      if (auth) {
        const parsed = JSON.parse(auth);
        const user = parsed.client || parsed.user || {};
        if (user.totalInvestment) return Number(user.totalInvestment);
      }
    } catch (e) {}
    return 0;
  }, []);

  const totalRawPortfolioValue = useMemo(() => {
    if (clientInvestmentSum > 0) return clientInvestmentSum;
    return enrichedProjects.reduce((sum, p) => sum + Number(p.targetFunding || p.fundedAmount || p.minInvestment || 0), 0);
  }, [enrichedProjects, clientInvestmentSum]);

  const formattedPortfolioValue = useMemo(() => {
    const val = totalRawPortfolioValue;
    if (val <= 0) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return formatCurrency(val);
  }, [totalRawPortfolioValue]);

  const averageProgress = Math.round(
    enrichedProjects.reduce((sum, project) => sum + (project.milestone || 0), 0) / (enrichedProjects.length || 1)
  );
  const activeProjects = enrichedProjects.filter(project => !['Released', 'Planned'].includes(project.status)).length;
  const completedProjects = enrichedProjects.filter(project => project.milestone >= 100).length;

  const summaryCards = [
    { label: 'Portfolio Value', value: formattedPortfolioValue, meta: 'Across active Kinetoscope assets' },
    { label: 'Live Projects', value: enrichedProjects.length, meta: `${activeProjects} currently in motion` },
    { label: 'Avg. Milestone', value: `${averageProgress}%`, meta: 'Weighted by active project count' },
    { label: 'Completed', value: completedProjects, meta: 'Released or fully delivered' },
  ];

  const drawer = drawerProject && createPortal(
    <>
      <div className="kfpl-drawer-overlay kfpl-portfolio-drawer-overlay" onClick={() => setDrawerProject(null)}></div>
      <aside className="kfpl-drawer kfpl-portfolio-drawer" aria-label={`${drawerProject.name} details`}>
        <div className="kfpl-drawer-header kfpl-portfolio-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{drawerProject.name}</h2>
            <span className="kfpl-portfolio-segment" style={{ marginTop: 0 }}>{drawerProject.segment}</span>
          </div>
          <button className="kfpl-modal-close" onClick={() => setDrawerProject(null)} aria-label="Close project details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="kfpl-drawer-body kfpl-portfolio-drawer-body" style={{ '--portfolio-accent': drawerProject.accent }}>
          <div className="kfpl-portfolio-drawer-visual" style={{
            backgroundImage: drawerProject.bannerImg ? `linear-gradient(rgba(6, 29, 19, 0.5), rgba(6, 29, 19, 0.8)), url(${drawerProject.bannerImg})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '250px',
          }}>
            <span>{drawerProject.initials}</span>
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#F59E0B' }}>Max Target: {formatCurrency(drawerProject.targetFunding || drawerProject.value || 0)}</strong>
              <small style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>Min Investment: {formatCurrency(drawerProject.minInvestment || 0)}</small>
            </div>
          </div>

          <p className="kfpl-portfolio-drawer-summary">{drawerProject.summary}</p>

          <div className="kfpl-portfolio-drawer-kpis">
            <div>
              <span>Min. Investment</span>
              <strong>{formatCurrency(drawerProject.minInvestment || 0)}</strong>
            </div>
            <div>
              <span>Max Target Funding</span>
              <strong style={{ color: '#F59E0B' }}>{formatCurrency(drawerProject.targetFunding || drawerProject.value || 0)}</strong>
            </div>
            <div>
              <span>Funded Amount</span>
              <strong style={{ color: '#10B981' }}>{formatCurrency(drawerProject.fundedAmount || 0)}</strong>
            </div>
            <div>
              <span>Available Slots</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {drawerProject.slotsAvailable ?? 20} / {drawerProject.totalSlots ?? 20} Slots
              </strong>
              <small style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                {Math.max(0, (drawerProject.totalSlots ?? 20) - (drawerProject.slotsAvailable ?? 20))} Booked • {drawerProject.slotsAvailable ?? 20} Remaining
              </small>
            </div>
            <div>
              <span>Status</span>
              <strong>{drawerProject.status}</strong>
            </div>
            <div>
              <span>Monthly ROI</span>
              <strong>{drawerProject.roi}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>{drawerProject.risk}</strong>
            </div>
            <div>
              <span>Horizon</span>
              <strong>{drawerProject.horizon}</strong>
            </div>
            <div>
              <span>Segment</span>
              <strong>{drawerProject.segment}</strong>
            </div>
            <div>
              <span>Health</span>
              <strong>{drawerProject.health}</strong>
            </div>
          </div>

          <div className="kfpl-portfolio-drawer-section">
            <h3>Milestone Progress</h3>
            <div className="kfpl-portfolio-progress-row">
              <span>{drawerProject.health}</span>
              <strong>{drawerProject.milestone}%</strong>
            </div>
            <div className="kfpl-progress kfpl-portfolio-drawer-progress">
              <div className="kfpl-progress-fill" style={{ width: `${drawerProject.milestone}%` }}></div>
            </div>
          </div>

          <div className="kfpl-portfolio-drawer-section">
            <h3>Current Update</h3>
            <p>{drawerProject.update || 'Project under active tracking.'}</p>
          </div>

          <div className="kfpl-portfolio-drawer-section">
            <h3>Allocation Focus</h3>
            <p>{drawerProject.allocation || 'General project operational capital.'}</p>
          </div>

          {/* Project Media & Files */}
          <div className="kfpl-portfolio-drawer-section">
            <style>{`
              .kfpl-media-file-link {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: #F8FAFC;
                border: 1.5px solid #E2E8F0;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
              }
              .kfpl-media-file-link:hover {
                background: #FFFFFF;
                border-color: var(--color-gold, #C5A880);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
                transform: translateY(-2px);
              }
            `}</style>
            <h3>Project Media & Files</h3>
            {(drawerProject.media || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', border: '2px dashed #E2E8F0', borderRadius: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                No files uploaded for this project yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(drawerProject.media || []).map((m, index) => (
                  <div 
                    key={m.id}
                    className="kfpl-media-file-link"
                    onClick={() => setActiveMediaIndex(index)}
                  >
                    {m.isImage ? (
                      <img src={m.url} alt={m.name} style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 42, height: 42, borderRadius: 6, background: 'linear-gradient(135deg, #1e3a5f 0%, #2563EB 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', flexShrink: 0, border: '1px solid #BFDBFE' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline stroke="#93C5FD" points="14 2 14 8 20 8" />
                        </svg>
                        <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#93C5FD', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{m.ext || 'file'}</span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {m.isImage
                          ? 'Click to preview in viewer'
                          : m.ext
                          ? `${m.ext.toUpperCase()} • Click to preview`
                          : 'Document • Click to preview'}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {/* Preview button */}
                      <button
                        title="Preview"
                        onClick={() => setActiveMediaIndex(index)}
                        style={{ background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748B', transition: 'all 0.18s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.color = 'var(--color-gold)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {/* Open in new tab button */}
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in new tab"
                        style={{ background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748B', transition: 'all 0.18s', textDecoration: 'none' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );

  const segmentTabs = useMemo(() => {
    const dbSegNames = dbSegments.map(s => s.name || s.title || s.segmentName).filter(Boolean);
    const projSegNames = projects.map(p => p.segment).filter(Boolean);
    const combined = ['All', ...dbSegNames, ...projSegNames];

    const uniqueMap = new Map();
    combined.forEach(name => {
      const key = name.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, name.trim());
      }
    });
    return Array.from(uniqueMap.values());
  }, [projects, dbSegments]);

  return (
    <div className="kfpl-page kfpl-portfolio-page">
      <section className="kfpl-portfolio-hero">
        <div className="kfpl-portfolio-hero-copy">
          <span className="kfpl-portfolio-eyebrow">Investor portfolio</span>
          <h1 className="kfpl-page-title">Kinetoscope Portfolio</h1>
          <p className="kfpl-page-subtitle">
            Explore project health, segment exposure, milestone progress, and current operational updates.
          </p>
        </div>
        <div className="kfpl-portfolio-hero-panel">
          <span className="kfpl-portfolio-hero-label">Portfolio Coverage</span>
          <strong>{segmentTabs.length - 1}</strong>
          <span>Entertainment investment segments</span>
        </div>
      </section>

      <section className="kfpl-portfolio-summary" aria-label="Portfolio summary">
        {summaryCards.map(card => (
          <div key={card.label} className="kfpl-portfolio-summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.meta}</small>
          </div>
        ))}
      </section>

      <section className="kfpl-portfolio-toolbar" aria-label="Portfolio filters">
        <div className="kfpl-portfolio-tabs">
          {segmentTabs.map(tab => {
            const count = tab === 'All'
              ? enrichedProjects.length
              : enrichedProjects.filter(project => (project.segment || '').trim().toLowerCase() === tab.trim().toLowerCase()).length;

            return (
              <button
                key={tab}
                type="button"
                className={`kfpl-portfolio-tab ${activeTab.trim().toLowerCase() === tab.trim().toLowerCase() ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span>{tab}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="kfpl-portfolio-grid" aria-label="Portfolio projects">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', gridColumn: '1 / -1' }}>
            <span className="kfpl-spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading portfolio data...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
            No projects found in this segment
          </div>
        ) : (
          filteredProjects.map(project => (
            <button
              key={project.id}
              type="button"
              className="kfpl-portfolio-card"
              style={{ '--portfolio-accent': project.accent }}
              onClick={() => setDrawerProject(project)}
            >
              <div className="kfpl-portfolio-card-media" style={{
                backgroundImage: project.bannerImg ? `linear-gradient(rgba(6, 29, 19, 0.5), rgba(6, 29, 19, 0.8)), url(${project.bannerImg})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}>
                <span className="kfpl-portfolio-card-initials">{project.initials}</span>
                <span className="kfpl-portfolio-card-status">{project.health}</span>
              </div>

              <div className="kfpl-portfolio-card-body">
                <div className="kfpl-portfolio-card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="kfpl-portfolio-segment">{project.segment}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--color-text-muted, #64748B)', display: 'block', fontSize: '0.6875rem' }}>
                      Min: <strong style={{ color: 'var(--color-text-primary, #1E293B)' }}>{formatCurrency(project.minInvestment || 0)}</strong>
                    </span>
                    <span style={{ color: 'var(--color-gold, #D97706)', fontWeight: 800, fontSize: '0.8125rem' }}>
                      Max: {formatCurrency(project.targetFunding || project.value || 0)}
                    </span>
                  </div>
                </div>

                <h2>{project.name}</h2>
                <p>{project.summary}</p>

                <div className="kfpl-portfolio-metrics">
                  <div>
                    <span>Status</span>
                    <strong>{project.status}</strong>
                  </div>
                  <div>
                    <span>Monthly ROI</span>
                    <strong>{project.roi}</strong>
                  </div>
                  <div>
                    <span>Risk</span>
                    <strong>{project.risk}</strong>
                  </div>
                </div>

                <div className="kfpl-portfolio-progress-row">
                  <span>Milestone Progress</span>
                  <strong>{project.milestone}%</strong>
                </div>
                <div className="kfpl-progress">
                  <div className="kfpl-progress-fill" style={{ width: `${project.milestone}%` }}></div>
                </div>

                {project.update && (
                  <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-success, #10B981)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </svg>
                      LATEST UPDATE
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary, #1E293B)', lineHeight: 1.4 }}>{project.update}</div>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </section>

      {drawer}
      {activeMediaIndex !== null && drawerProject && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            userSelect: 'none',
            animation: 'fadeIn 0.25s ease'
          }}
          onClick={() => setActiveMediaIndex(null)}
        >
          {/* Styles for animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.98); }
              to { opacity: 1; transform: scale(1); }
            }
            .kfpl-slider-nav-btn {
              background: rgba(255,255,255,0.08);
              border: 1px solid rgba(255,255,255,0.15);
              color: white;
              width: 50px;
              height: 50px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s;
              flex-shrink: 0;
            }
            .kfpl-slider-nav-btn:hover:not(:disabled) {
              background: var(--color-gold, #C5A880) !important;
              color: #000 !important;
              border-color: var(--color-gold, #C5A880) !important;
              transform: scale(1.1);
            }
            .kfpl-slider-close {
              position: absolute;
              top: 20px;
              right: 20px;
              background: rgba(255,255,255,0.1);
              border: 1px solid rgba(255,255,255,0.15);
              color: white;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.25s;
              z-index: 10000;
            }
            .kfpl-slider-close:hover {
              background: #ef4444 !important;
              border-color: #ef4444 !important;
              transform: rotate(90deg) scale(1.1);
            }
            .kfpl-slider-open-btn:hover {
              background: rgba(255,255,255,0.12) !important;
              border-color: var(--color-gold, #C5A880) !important;
              color: var(--color-gold, #C5A880) !important;
            }
          `}</style>

          {/* Close button */}
          <button className="kfpl-slider-close" onClick={() => setActiveMediaIndex(null)}>✕</button>

          {/* Content wrapper */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '1200px',
              padding: '0 24px',
              gap: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Button */}
            <button 
              className="kfpl-slider-nav-btn"
              disabled={drawerProject.media.length <= 1}
              style={{ opacity: drawerProject.media.length <= 1 ? 0.3 : 1 }}
              onClick={() => {
                setActiveMediaIndex(prev => (prev - 1 + drawerProject.media.length) % drawerProject.media.length);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 24, height: 24 }}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Center Media Display */}
            <div 
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: '80vh',
                gap: '16px'
              }}
            >
              {drawerProject.media[activeMediaIndex] && drawerProject.media[activeMediaIndex].isImage ? (
                <img 
                  src={drawerProject.media[activeMediaIndex].url} 
                  alt={drawerProject.media[activeMediaIndex].name} 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '70vh',
                    borderRadius: '12px',
                    objectFit: 'contain',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                />
              ) : (
                drawerProject.media[activeMediaIndex] && (() => {
                  const m = drawerProject.media[activeMediaIndex];
                  const ext = m.ext || '';
                  const isPdf = ext === 'pdf';
                  const isDocViewable = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext);
                  // Cloudinary raw uploads and known doc types → Google Docs Viewer
                  const useGoogleViewer = isDocViewable || (m.isRawUpload && !isPdf && !m.isImage);
                  const iframeUrl = isPdf
                    ? m.url
                    : useGoogleViewer
                    ? `https://docs.google.com/viewer?url=${encodeURIComponent(m.url)}&embedded=true`
                    : null;

                  return (
                    <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                      {/* Header bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #1e3a5f, #2563EB)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', flexShrink: 0 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline stroke="#93C5FD" points="14 2 14 8 20 8" />
                          </svg>
                          <span style={{ fontSize: '0.4rem', fontWeight: 800, color: '#93C5FD', textTransform: 'uppercase' }}>{ext || 'DOC'}</span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ textDecoration: 'none', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', flexShrink: 0 }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 13, height: 13 }}>
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          Open
                        </a>
                      </div>

                      {/* Embedded iframe or fallback */}
                      {iframeUrl ? (
                        <iframe
                          key={iframeUrl}
                          src={iframeUrl}
                          title={m.name}
                          onClick={e => e.stopPropagation()}
                          style={{
                            width: '100%',
                            height: '62vh',
                            border: 'none',
                            borderRadius: '10px',
                            background: '#fff',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
                          }}
                        />
                      ) : (
                        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                          Preview not available for this file type.<br />
                          <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-gold)', textDecoration: 'none', fontWeight: 600 }}>Open in new tab instead →</a>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Counter + filename */}
              {drawerProject.media[activeMediaIndex] && (
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
                    {activeMediaIndex + 1} / {drawerProject.media.length}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500, maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {drawerProject.media[activeMediaIndex].name}
                  </p>
                </div>
              )}
            </div>

            {/* Next Button */}
            <button 
              className="kfpl-slider-nav-btn"
              disabled={drawerProject.media.length <= 1}
              style={{ opacity: drawerProject.media.length <= 1 ? 0.3 : 1 }}
              onClick={() => {
                setActiveMediaIndex(prev => (prev + 1) % drawerProject.media.length);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 24, height: 24 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Bottom: Open original link — only for images */}
          {drawerProject.media[activeMediaIndex] && drawerProject.media[activeMediaIndex].isImage && (
            <a 
              href={drawerProject.media[activeMediaIndex].url}
              target="_blank"
              rel="noopener noreferrer"
              className="kfpl-slider-open-btn"
              style={{
                position: 'absolute',
                bottom: '24px',
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '9px 20px',
                borderRadius: '30px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                transition: 'all 0.2s'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 13, height: 13 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open Original
            </a>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============ END: Portfolio.jsx ============ */
