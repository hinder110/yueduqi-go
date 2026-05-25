import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSources, toggleSource } from '../api';
import type { SourceInfo } from '../types';

export default function SettingsPage() {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const list = await getSources();
      setSources(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(key: string, enabled: boolean) {
    await toggleSource(key, enabled);
    setSources((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled } : s))
    );
  }

  // Group sources by group name
  const groups = new Map<string, SourceInfo[]>();
  for (const s of sources) {
    const g = groups.get(s.group) || [];
    g.push(s);
    groups.set(s.group, g);
  }

  return (
    <div className="page settings-page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 返回
        </button>
        <h1>书源管理</h1>
      </header>

      {loading && <div className="message loading">加载中...</div>}

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#888' }}>
          共 {sources.length} 个书源，已启用 {sources.filter((s) => s.enabled).length} 个
        </span>
      </div>

      {[...groups.entries()].map(([group, groupSources]) => (
        <div key={group} style={{ marginBottom: 20 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>{group || '未分组'}</h2>
          <div className="chapter-list">
            {groupSources.map((s) => (
              <div key={s.key} className="chapter-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="chapter-title">{s.name}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => handleToggle(s.key, e.target.checked)}
                  />
                  {s.enabled ? '已启用' : '已禁用'}
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
