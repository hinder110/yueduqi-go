import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBookshelf, removeFromBookshelf } from '../api';
import type { Book } from '../types';

export default function BookshelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadBookshelf();
  }, []);

  async function loadBookshelf() {
    setLoading(true);
    try {
      const list = await getBookshelf();
      setBooks(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(bookId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await removeFromBookshelf(bookId);
    setBooks((prev) => prev.filter((b) => b.book_id !== bookId));
  }

  return (
    <div className="page bookshelf-page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 返回
        </button>
        <h1>我的书架</h1>
      </header>

      {loading && <div className="message loading">加载中...</div>}

      {!loading && books.length === 0 && (
        <div className="message empty">书架空空如也，快去搜索添加吧</div>
      )}

      <div className="book-list">
        {books.map((book) => (
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
              {book.last_chapter && (
                <span className="book-last">最新: {book.last_chapter}</span>
              )}
            </div>
            <button
              className="source-tag"
              style={{ color: '#e03030', borderColor: '#e03030' }}
              onClick={(e) => handleRemove(book.book_id, e)}
            >
              移除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
