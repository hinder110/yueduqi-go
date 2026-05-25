import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getChapters } from '../api';
import type { Book, Chapter } from '../types';

export default function ChaptersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const book = location.state?.book as Book | undefined;

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!book) {
      navigate('/', { replace: true });
      return;
    }
    loadChapters();
  }, []);

  async function loadChapters() {
    if (!book) return;
    setLoading(true);
    setError('');
    try {
      const list = await getChapters(book.book_id, book.source_key);
      setChapters(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!book) return null;

  return (
    <div className="page chapters-page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h1 className="header-title">{book.title}</h1>
        {book.author && <span className="header-sub">{book.author}</span>}
      </header>

      {loading && <div className="message loading">加载中...</div>}
      {error && <div className="message error">{error}</div>}

      <div className="chapter-list">
        {chapters.map((ch, i) => (
          <div
            key={ch.item_id}
            className="chapter-item"
            onClick={() =>
              navigate('/reader', {
                state: {
                  book,
                  chapter: ch,
                  chapters,
                  currentIndex: i,
                },
              })
            }
          >
            <span className="chapter-title">{ch.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
