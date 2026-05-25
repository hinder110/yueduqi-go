import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getContent, addHistory } from '../api';
import type { Book, Chapter, ChapterContent } from '../types';

type Theme = 'light' | 'dark';
type FontSize = 'sm' | 'md' | 'lg';

const FONT_LABELS: Record<FontSize, string> = { sm: 'A⁻', md: 'A', lg: 'A⁺' };
const FONT_NEXT: Record<FontSize, FontSize> = { sm: 'md', md: 'lg', lg: 'sm' };

export default function ReaderPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const book = location.state?.book as Book | undefined;
  const initialChapter = location.state?.chapter as Chapter | undefined;
  const chapters = location.state?.chapters as Chapter[] | undefined;
  const initialIndex = (location.state?.currentIndex as number) ?? 0;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<Theme>('light');
  const [fontSize, setFontSize] = useState<FontSize>('md');

  const currentChapter = chapters ? chapters[currentIndex] : initialChapter;

  const loadContent = useCallback(
    async (ch: Chapter) => {
      if (!book) return;
      setLoading(true);
      setError('');
      try {
        const data = await getContent(book.book_id, ch.item_id, book.source_key);
        setContent(data);
        addHistory(book.book_id, ch.title).catch(() => {});
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [book]
  );

  useEffect(() => {
    if (!book || !currentChapter) {
      navigate('/', { replace: true });
      return;
    }
    loadContent(currentChapter);
  }, [currentChapter]);

  function goToChapter(index: number) {
    if (!chapters || index < 0 || index >= chapters.length) return;
    setCurrentIndex(index);
    setContent(null);
    window.scrollTo(0, 0);
  }

  if (!book || !currentChapter) return null;

  const hasPrev = chapters ? currentIndex > 0 : false;
  const hasNext = chapters ? currentIndex < chapters.length - 1 : false;

  return (
    <div className={`reader-page theme-${theme} font-${fontSize}`}>
      <div className="reader-topbar">
        <button className="topbar-btn" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <span className="topbar-title">{book.title}</span>
        <div className="topbar-actions">
          <button
            className="topbar-btn"
            onClick={() => setFontSize(FONT_NEXT[fontSize])}
            title="切换字号"
          >
            {FONT_LABELS[fontSize]}
          </button>
          <button
            className="topbar-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? '切换夜间模式' : '切换日间模式'}
          >
            {theme === 'light' ? '暗' : '亮'}
          </button>
        </div>
      </div>

      <h2 className="chapter-heading">{currentChapter.title}</h2>

      {loading && <div className="reader-status">加载中...</div>}
      {error && <div className="reader-status error">{error}</div>}
      {content && (
        <div className="content-body" dangerouslySetInnerHTML={{ __html: content.content }} />
      )}

      <div className="reader-nav">
        <button disabled={!hasPrev} onClick={() => goToChapter(currentIndex - 1)}>
          上一章
        </button>
        <span className="chapter-indicator">
          {currentIndex + 1} / {chapters?.length ?? 1}
        </span>
        <button disabled={!hasNext} onClick={() => goToChapter(currentIndex + 1)}>
          下一章
        </button>
      </div>
    </div>
  );
}
