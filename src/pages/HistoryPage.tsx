import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory } from '../api';
import type { HistoryEntry } from '../types';

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const list = await getHistory();
      setEntries(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page history-page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 返回
        </button>
        <h1>阅读历史</h1>
      </header>

      {loading && <div className="message loading">加载中...</div>}

      {!loading && entries.length === 0 && (
        <div className="message empty">暂无阅读记录</div>
      )}

      <div className="chapter-list">
        {entries.map((entry, i) => (
          <div key={`${entry.book_id}-${i}`} className="chapter-item">
            <div>
              <span className="chapter-title">{entry.book_title || '未知书籍'}</span>
              <br />
              <span style={{ fontSize: 13, color: '#888' }}>
                上次阅读: {entry.chapter_title}
              </span>
              <br />
              <span style={{ fontSize: 11, color: '#aaa' }}>{entry.updated_at}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
