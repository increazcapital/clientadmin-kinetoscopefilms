/* ============================================================
   Page: MediaFeed.jsx
   Description: Blog/News feed grid with category filter
   ============================================================ */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../config/apiHelper';
import { getArticleCover } from './MediaDetail';

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

export default function MediaFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const data = await apiRequest('/api/client/articles');
        console.log('Client Articles API Raw Response:', data);
        const raw = extractArticles(data);
        const mapped = raw.map(a => {
          const rawContent = a.content || '';
          const cleanContent = rawContent.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
          const rawExcerpt = a.excerpt || '';
          const cleanExcerpt = rawExcerpt.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');
          return {
            id: a._id || a.id,
            title: a.title || '',
            excerpt: cleanExcerpt,
            content: cleanContent,
            category: a.category || 'Company News',
            author: a.author || 'KFPL Communications',
            date: a.publishDate || a.date || a.createdAt || new Date().toISOString(),
            status: a.status || 'Published',
            imageUrl: a.imageUrl || a.featuredImage || '',
            quote: a.specialQuote || a.quote || '',
            quoteAuthor: a.quoteAuthorRole || a.quoteAuthor || '',
            advisory: a.advisoryNotice || a.advisory || '',
          };
        });
        setArticles(mapped);
      } catch (err) {
        console.error('Failed to load client feed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Only display published articles (case-insensitive)
  const publishedArticles = articles.filter(a => {
    const s = (a.status || '').toLowerCase();
    return s === 'published' || !a.status;
  });

  const categories = ['All', ...new Set(publishedArticles.map(m => m.category))];
  const filtered = activeCategory === 'All' ? publishedArticles : publishedArticles.filter(m => m.category === activeCategory);

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h1 className="kfpl-page-title">Media & News</h1>
          <p className="kfpl-page-subtitle">Latest updates from YieldIQ and the investment industry</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="kfpl-filter-chips" style={{ marginBottom: '24px' }}>
        {categories.map(cat => (
          <div key={cat} className={`kfpl-filter-chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</div>
        ))}
      </div>

      {/* Media Grid */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
          <span className="kfpl-spinner" style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', margin: 0 }}>Loading media updates...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-text-muted)', border: '1.5px dashed var(--color-border)', borderRadius: '12px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36, marginBottom: 8, opacity: 0.5 }}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <p style={{ fontWeight: 600, margin: '4px 0', fontSize: '0.95rem' }}>No articles available</p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>Check back later for news and media releases.</p>
        </div>
      ) : (
        <div className="kfpl-media-grid">
          {filtered.map(article => (
            <Link key={article.id} to={`/media/${article.id}`} className="kfpl-media-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              {getArticleCover(article) && (
                <div className="kfpl-media-card-img">
                  <img src={getArticleCover(article)} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div className="kfpl-media-card-body">
                <div className="kfpl-media-card-tag">{article.category}</div>
                <h4 className="kfpl-media-card-title">{article.title}</h4>
                <p className="kfpl-media-card-excerpt">{article.excerpt}</p>
                <p className="kfpl-media-card-date">{new Date(article.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ END: MediaFeed.jsx ============ */
