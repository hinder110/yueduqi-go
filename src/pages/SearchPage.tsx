import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchBooks, getSources, addToBookshelf, getBookshelf } from '../api';
import type { Book, SourceInfo, SearchResult } from '../types';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [bookshelfIds, setBookshelfIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadSources();
    loadBookshelf();
  }, []);

  async function loadSources() {
    try {
      const list = await getSources();
      setSources(list);
    } catch {
      // Sources loaded from Rust backend
    }
  }

  async function loadBookshelf() {
    try {
      const shelf = await getBookshelf();
      setBookshelfIds(new Set(shelf.map((b) => b.book_id)));
    } catch {
      // ignore
    }
  }

  async function handleSearch() {
    const kw = keyword.trim();
    if (!kw) return;
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);
    try {
      const res = await searchBooks(kw);
      setResults(res);
      const total = res.reduce((sum, r) => sum + r.books.length, 0);
      if (total === 0) setError('未找到相关书籍');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleBackToInit() {
    setSearched(false);
    setResults([]);
    setError('');
    setKeyword('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  async function handleAddShelf(book: Book, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await addToBookshelf(book);
      setBookshelfIds((prev) => new Set([...prev, book.book_id]));
    } catch {
      // ignore
    }
  }

  const allBooks: Book[] = results.flatMap((r) => r.books);

  return (
    <div className="page search-page">
      <header className="header">
        <h1>阅读器</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="source-tag" onClick={() => navigate('/bookshelf')}>
            书架
          </button>
          <button className="source-tag" onClick={() => navigate('/history')}>
            历史
          </button>
          <button className="source-tag" onClick={() => navigate('/settings')}>
            设置
          </button>
        </div>
      </header>

      {sources.length > 0 && (
        <div className="source-selector">
          <span style={{ fontSize: 13, color: '#888', marginRight: 4 }}>
            {sources.filter((s) => s.enabled).length} 个书源可用
          </span>
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入书名搜索..."
          autoFocus
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {loading && <div className="message loading">搜索中...</div>}
      {error && <div className="message error">{error}</div>}

      {/* Source status */}
      {searched && results.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          {results.map((r) => (
            <span
              key={r.source}
              className={`source-status ${r.error ? 'error' : 'success'}`}
            >
              {r.source}: {r.error ? r.error : `${r.books.length} books`}
            </span>
          ))}
        </div>
      )}

      {searched && (
        <>
          <div className="section-header">
            <button className="link-btn" onClick={handleBackToInit}>
              ← 返回
            </button>
            <span className="section-title">搜索结果 ({allBooks.length})</span>
          </div>
          <div className="book-list">
            {allBooks.map((book) => (
              <div
                key={book.book_id}
                className="book-card"
                onClick={() => navigate('/chapters', { state: { book } })}
              >
                {book.cover && (
                  <img src={book.cover} alt={book.title} className="book-cover" />
                )}
                <div className="book-info">
                  <h3 className="book-title">{book.title}</h3>
                  {book.author && <span className="book-author">{book.author}</span>}
                  {book.kind && <span className="book-kind">{book.kind}</span>}
                  {book.last_chapter && (
                    <span className="book-last">最新: {book.last_chapter}</span>
                  )}
                  {book.intro && <p className="book-intro">{book.intro}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{book.source}</span>
                  <button
                    className="source-tag"
                    style={{ fontSize: 12 }}
                    onClick={(e) => handleAddShelf(book, e)}
                    disabled={bookshelfIds.has(book.book_id)}
                  >
                    {bookshelfIds.has(book.book_id) ? '已添加' : '+ 书架'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!loading && !error && allBooks.length === 0 && (
            <div className="message empty">暂无结果</div>
          )}
        </>
      )}

      {!searched && (
        <div className="message" style={{ color: '#aaa' }}>
          输入书名，从 {sources.filter((s) => s.enabled).length} 个书源中搜索
        </div>
      )}
    </div>
  );
}
