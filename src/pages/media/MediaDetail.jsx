import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../config/apiHelper';

const extractArticles = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  
  if (res.articles && Array.isArray(res.articles)) return res.articles;
  if (res.news && Array.isArray(res.news)) return res.news;
  if (res.data && Array.isArray(res.data)) return res.data;
  
  if (res.data && typeof res.data === 'object') {
    if (res.data.articles && Array.isArray(res.data.articles)) return res.data.articles;
    if (res.data.news && Array.isArray(res.data.news)) return res.data.news;
  }
  
  for (const key of Object.keys(res)) {
    if (Array.isArray(res[key])) {
      return res[key];
    }
  }
  
  return [];
};

// Category-based fallback Unsplash images for premium visual layout
export const getArticleCover = (article) => {
  if (article && article.imageUrl && article.imageUrl.trim() !== '') {
    return article.imageUrl;
  }
  return null;
};

export default function MediaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestArticles, setLatestArticles] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState({});

  // Interactive States
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(() => Math.floor(45 + Math.random() * 60));
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showCopiedAlert, setShowCopiedAlert] = useState(false);
  const [subscribedEmail, setSubscribedEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [submittingSubscribe, setSubmittingSubscribe] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll to top on mount or ID change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      let art = null;
      let feed = [];

      try {
        const [detailRes, feedRes] = await Promise.all([
          apiRequest(`/api/client/articles/${id}`)
            .catch(() => apiRequest(`/api/client/news/${id}`))
            .catch(() => apiRequest(`/api/agent/articles/${id}`))
            .catch(() => apiRequest(`/api/agent/news/${id}`))
            .catch(() => null),
          apiRequest('/api/client/articles')
            .catch(() => apiRequest('/api/agent/articles'))
            .catch(() => null)
        ]);

        if (detailRes) {
          art = detailRes.data?.article || detailRes.data || detailRes.article || (detailRes._id || detailRes.id ? detailRes : null);
        }

        if (feedRes) {
          feed = extractArticles(feedRes);
        }

        // Fallback 1: Match by ID in feed list
        if ((!art || !art.title) && feed.length > 0) {
          art = feed.find(a => String(a._id || a.id) === String(id));
        }

        // Fallback 2: If still not matched and feed has articles, fallback to first available article
        if ((!art || !art.title) && feed.length > 0) {
          art = feed[0];
        }

        if (art && art.title) {
          const rawContent = art.content || '';
          const cleanContent = rawContent.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
          const rawExcerpt = art.excerpt || '';
          const cleanExcerpt = rawExcerpt.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');

          const mappedArticle = {
            id: art._id || art.id,
            title: art.title || '',
            excerpt: cleanExcerpt,
            content: cleanContent,
            category: art.category || 'Company News',
            author: art.author || 'KFPL Communications',
            date: art.publishDate || art.date || art.createdAt || new Date().toISOString(),
            status: art.status || 'Published',
            imageUrl: art.imageUrl || art.featuredImage || '',
            quote: art.specialQuote || art.quote || '',
            quoteAuthor: art.quoteAuthorRole || art.quoteAuthor || '',
            advisory: art.advisoryNotice || art.advisory || '',
          };
          setArticle(mappedArticle);

          const mappedFeed = feed.map(a => {
            const rawFeedContent = a.content || '';
            const cleanFeedContent = rawFeedContent.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
            const rawFeedExcerpt = a.excerpt || '';
            const cleanFeedExcerpt = rawFeedExcerpt.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
            return {
              id: a._id || a.id,
              title: a.title || '',
              excerpt: cleanFeedExcerpt,
              category: a.category || 'Company News',
              date: a.publishDate || a.date || a.createdAt || new Date().toISOString(),
              imageUrl: a.imageUrl || a.featuredImage || '',
              author: a.author || 'KFPL Communications',
              content: cleanFeedContent,
            };
          });

          setLatestArticles(mappedFeed.filter(a => a.id !== mappedArticle.id).slice(0, 4));

          const related = mappedFeed.filter(a => a.id !== mappedArticle.id && a.category === mappedArticle.category).slice(0, 2);
          const others = related.length < 2
            ? [...related, ...mappedFeed.filter(a => a.id !== mappedArticle.id && a.category !== mappedArticle.category).slice(0, 2 - related.length)]
            : related;
          setRelatedArticles(others);

          const catCounts = mappedFeed.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
            return acc;
          }, {});
          setCategoriesWithCounts(catCounts);
        } else {
          setArticle(null);
        }
      } catch (err) {
        console.error('Error loading article details in MediaDetail:', err);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="kfpl-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
          <span className="kfpl-spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Loading article details...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="kfpl-page">
        <div className="kfpl-article-not-found">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <h2>Article Not Found</h2>
          <p>The article you're looking for doesn't exist or has been removed.</p>
          <button className="kfpl-btn kfpl-btn--primary" onClick={() => navigate('/media')}>Back to Media & News</button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(article.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const cleanText = article.content ? article.content.replace(/<[^>]*>/g, ' ') : '';
  const wordCount = cleanText.trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const coverUrl = getArticleCover(article);
  const viewCount = 1250 + (parseInt(id) || 1) * 342;

  // Share Functions
  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopiedAlert(true);
    setTimeout(() => setShowCopiedAlert(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt,
        url: window.location.href,
      }).catch(err => console.log('Error sharing:', err));
    } else {
      handleCopyLink();
    }
  };

  const handleSubscribeSubmit = async (e) => {
    e.preventDefault();
    const targetEmail = (subscribedEmail || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    setSubmittingSubscribe(true);

    try {
      const res = await apiRequest('/api/client/articles/subscribe', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail })
      });

      const stored = localStorage.getItem('kfpl_newsletter_subscribers');
      let subs = stored ? JSON.parse(stored) : [];
      if (!subs.includes(targetEmail)) {
        subs.push(targetEmail);
        localStorage.setItem('kfpl_newsletter_subscribers', JSON.stringify(subs));
      }

      setIsSubscribed(true);
      setSubscribedEmail('');
      setTimeout(() => setIsSubscribed(false), 5000);
    } catch (err) {
      console.error('Failed to subscribe:', err);
      alert(err.message || 'Failed to subscribe to newsletter. Please try again.');
    } finally {
      setSubmittingSubscribe(false);
    }
  };

  // Structured paragraphs parser
  const renderParagraphs = () => {
    if (article.content && (article.content.includes('<') && article.content.includes('>'))) {
      return <div dangerouslySetInnerHTML={{ __html: article.content }} />;
    }

    if (!article.content) return null;

    const paragraphs = article.content.split('\n\n');

    return paragraphs.map((p, idx) => {
      // Check if it's the CEO quotation block
      if (p.trim().startsWith('"') && (p.includes('CEO') || p.includes('said'))) {
        if (article.quote) {
          return null; // Skip parsing duplicate text blockquote when custom quote is supplied
        }
        return (
          <div key={idx} className="kfpl-pub-ceo-quote-card">
            <span className="kfpl-pub-quote-icon">“</span>
            <p className="kfpl-pub-quote-text">{p.replace(/"/g, '')}</p>
            <div className="kfpl-pub-quote-author">
              <div className="kfpl-pub-quote-avatar">
                {article.author ? article.author.split(' ').map(n => n[0]).join('').toUpperCase() : 'K'}
              </div>
              <div className="kfpl-pub-quote-details">
                <span className="kfpl-pub-quote-name">{article.author || 'KFPL Team'}</span>
                <span className="kfpl-pub-quote-role">Chief Executive Officer, KFPL Group</span>
              </div>
            </div>
          </div>
        );
      }

      // Check if it's a bulleted list
      if (p.startsWith('•') || p.startsWith('-')) {
        const items = p.split('\n').map(li => li.replace(/^[•\-]\s*/, '').trim());
        return (
          <ul key={idx} className="kfpl-pub-article-list">
            {items.map((item, lidx) => (
              <li key={lidx}>{item}</li>
            ))}
          </ul>
        );
      }

      // Check if it's a numbered list
      if (/^\d+\./.test(p)) {
        const items = p.split('\n').map(li => li.replace(/^\d+\.\s*/, '').trim());
        return (
          <ol key={idx} className="kfpl-pub-article-ol-list">
            {items.map((item, lidx) => (
              <li key={lidx}>{item}</li>
            ))}
          </ol>
        );
      }

      // Normal paragraph
      return <p key={idx}>{p}</p>;
    });
  };

  return (
    <div className="kfpl-page kfpl-investor-portal-detail-page">
      {/* Toast Alert for Copy Action */}
      <div className={`kfpl-pub-toast-alert ${showCopiedAlert ? 'visible' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Link copied to clipboard
      </div>

      <div className="kfpl-investor-detail-container">
        {/* Back Button */}
        <button className="kfpl-article-back-premium" onClick={() => navigate('/media')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Investor Media & Insights
        </button>



      {/* Main Two-Column Premium Layout */}
      <div className="kfpl-investor-portal-layout">
        
        {/* Left Column - Core Content */}
        <div className="kfpl-investor-main-column">
          
          {/* Top Hero Section */}
          <div className="kfpl-pub-premium-header">
            <div className="kfpl-pub-header-top-row">
              <span className="kfpl-pub-category-badge">{article.category}</span>
              <div className="kfpl-pub-views-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {viewCount} views
              </div>
            </div>
            
            <h1 className="kfpl-pub-premium-title">{article.title}</h1>
            
            {article.excerpt && (
              <p className="kfpl-pub-premium-summary">{article.excerpt}</p>
            )}
            
            {/* Meta Row: Author, Verified badge, Dates, Buttons */}
            <div className="kfpl-pub-premium-meta-strip">
              <div className="kfpl-pub-author-card">
                <div className="kfpl-pub-author-avatar-wrap">
                  {article.author ? article.author.split(' ').map(n => n[0]).join('').toUpperCase() : 'K'}
                </div>
                <div className="kfpl-pub-author-text">
                  <div className="kfpl-pub-author-row">
                    <span className="kfpl-pub-author-name">{article.author || 'KFPL Team'}</span>
                    <span className="kfpl-pub-verified-badge" title="Verified Publisher">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    </span>
                  </div>
                  <div className="kfpl-pub-meta-sub">
                    <span>{formattedDate}</span>
                    <span className="kfpl-pub-meta-divider">•</span>
                    <span>{readTime} min read</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Cinematic Hero Cover Image */}
          {coverUrl && (
            <div className="kfpl-pub-premium-banner">
              <img src={coverUrl} alt={article.title} className="kfpl-pub-premium-img" />
              <div className="kfpl-pub-premium-overlay"></div>
            </div>
          )}

          {/* Article Body */}
          <div className="kfpl-pub-article-container">
            <div className="kfpl-article-body kfpl-premium-body">
              {renderParagraphs()}

              {article.quote && (
                <div className="kfpl-pub-ceo-quote-card">
                  <span className="kfpl-pub-quote-icon">“</span>
                  <p className="kfpl-pub-quote-text">{article.quote}</p>
                  <div className="kfpl-pub-quote-author">
                    <div className="kfpl-pub-quote-avatar">
                      {article.author ? article.author.split(' ').map(n => n[0]).join('').toUpperCase() : 'K'}
                    </div>
                    <div className="kfpl-pub-quote-details">
                      <span className="kfpl-pub-quote-name">{article.author || 'KFPL Team'}</span>
                      <span className="kfpl-pub-quote-role">{article.quoteAuthor || 'Chief Executive Officer, KFPL Group'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="kfpl-pub-bottom-actions-bar">
                <button className={`kfpl-pub-bottom-btn ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
                  <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  <span>Like ({likeCount})</span>
                </button>

                <button className={`kfpl-pub-bottom-btn ${isBookmarked ? 'bookmarked' : ''}`} onClick={() => setIsBookmarked(!isBookmarked)}>
                  <svg viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>

                <button className="kfpl-pub-bottom-btn" onClick={handleCopyLink}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span>Copy Link</span>
                </button>

                <button className="kfpl-pub-bottom-btn" onClick={handlePrint}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  <span>Print Report</span>
                </button>

                <button className="kfpl-pub-bottom-btn" onClick={handleShare}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Visual Highlight Note Box */}
            <div className="kfpl-pub-highlight-note-box">
              <div className="kfpl-pub-note-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Investor Relations Advisory Notice</span>
              </div>
              <p>{article.advisory || "The information contained in this report is intended solely for registered partners and qualified investors of Kinetoscope Films Production Pvt Ltd. Performance returns and projections are subject to standard entertainment industry risks. Please contact your dedicated account manager for custom portfolio modifications."}</p>
            </div>

            {/* Tags Row */}
            <div className="kfpl-pub-tags-row">
              <span className="kfpl-pub-tags-title">Filed Under:</span>
              <div className="kfpl-pub-tags-container">
                <span className="kfpl-pub-tag-chip">{article.category}</span>
                <span className="kfpl-pub-tag-chip">Kinetoscope Ventures</span>
                <span className="kfpl-pub-tag-chip">Entertainment Tech</span>
                <span className="kfpl-pub-tag-chip">ROI Statistics</span>
              </div>
            </div>
          </div>

          {/* Bottom Premium Subscription CTA */}
          <div className="kfpl-pub-bottom-subscription">
            <div className="kfpl-pub-sub-text">
              <h3>Stay Updated with Kinetoscope Insights</h3>
              <p>Receive premium investor updates, quarterly fiscal summaries, and entertainment production pipeline announcements directly in your portal feed.</p>
            </div>
            <form className="kfpl-pub-sub-form" onSubmit={handleSubscribeSubmit}>
              <div className="kfpl-pub-sub-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input 
                  type="email" 
                  placeholder="Enter your corporate email address" 
                  required 
                  value={subscribedEmail} 
                  onChange={(e) => setSubscribedEmail(e.target.value)} 
                  disabled={submittingSubscribe}
                />
              </div>
              <button type="submit" className="kfpl-pub-sub-btn" disabled={submittingSubscribe}>
                {submittingSubscribe ? 'Subscribing...' : isSubscribed ? 'Subscribed Successfully' : 'Subscribe to Reports'}
              </button>
            </form>
          </div>

        </div>

        {/* Right Sidebar Column - Sticky Desktop Panel */}
        <aside className="kfpl-investor-sidebar">
          
          {/* Quick Search */}
          <div className="kfpl-sidebar-widget">
            <h4 className="kfpl-widget-title">Portal Search</h4>
            <div className="kfpl-widget-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search investor resources..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>


          {/* Latest Articles */}
          <div className="kfpl-sidebar-widget">
            <h4 className="kfpl-widget-title">Latest Updates</h4>
            <div className="kfpl-widget-articles-list">
              {latestArticles.map(rel => (
                <Link key={rel.id} to={`/media/${rel.id}`} className="kfpl-widget-article-item">
                  {getArticleCover(rel) && (
                    <div className="kfpl-widget-article-img-wrap">
                      <img src={getArticleCover(rel)} alt={rel.title} />
                    </div>
                  )}
                  <div className="kfpl-widget-article-info">
                    <span className="kfpl-widget-article-tag">{rel.category}</span>
                    <span className="kfpl-widget-article-name">{rel.title}</span>
                    <span className="kfpl-widget-article-meta">
                      {new Date(rel.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Categories widget */}
          <div className="kfpl-sidebar-widget">
            <h4 className="kfpl-widget-title">Topics & Focus Areas</h4>
            <div className="kfpl-widget-categories-list">
              {Object.entries(categoriesWithCounts).map(([catName, count]) => (
                <Link key={catName} to="/media" className="kfpl-widget-category-item">
                  <span className="kfpl-widget-cat-name">{catName}</span>
                  <span className="kfpl-widget-cat-count">{count}</span>
                </Link>
              ))}
            </div>
          </div>



        </aside>

      </div>

      {/* Redesigned Related Articles Bottom Grid */}
      {relatedArticles.length > 0 && (
        <div className="kfpl-pub-related-section-premium">
          <div className="kfpl-pub-related-header-row">
            <h3 className="kfpl-pub-related-title-premium">Related Investor Insights</h3>
            <Link to="/media" className="kfpl-pub-related-all-link">
              View All Insights
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
          <div className="kfpl-pub-related-grid-premium">
            {relatedArticles.map(rel => {
              const relDate = new Date(rel.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
              const relClean = rel.content ? rel.content.replace(/<[^>]*>/g, ' ') : '';
              const relWords = relClean.trim().split(/\s+/).filter(Boolean).length;
              const relReadTime = Math.max(1, Math.ceil(relWords / 200));

              return (
                <Link key={rel.id} to={`/media/${rel.id}`} className="kfpl-pub-related-card-premium">
                  {getArticleCover(rel) && (
                    <div className="kfpl-pub-related-img-wrapper-premium">
                      <img src={getArticleCover(rel)} alt={rel.title} className="kfpl-pub-related-img-premium" />
                      <div className="kfpl-pub-related-tag-badge">{rel.category}</div>
                    </div>
                  )}
                  <div className="kfpl-pub-related-card-body-premium">
                    <div className="kfpl-pub-related-card-meta">
                      <span>{relDate}</span>
                      <span className="kfpl-pub-related-dot">•</span>
                      <span>{relReadTime} min read</span>
                    </div>
                    <h4 className="kfpl-pub-related-card-title-premium">{rel.title}</h4>
                    <p className="kfpl-pub-related-card-excerpt">{rel.excerpt || 'Read the full investor update regarding this new development...'}</p>
                    <div className="kfpl-pub-related-author-row">
                      <div className="kfpl-pub-related-author-avatar">
                        {rel.author ? rel.author.split(' ').map(n => n[0]).join('').toUpperCase() : 'K'}
                      </div>
                      <span className="kfpl-pub-related-author-name">{rel.author || 'KFPL Team'}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* ============ END: MediaDetail.jsx ============ */
