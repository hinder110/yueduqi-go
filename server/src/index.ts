import express from 'express';
import cors from 'cors';
import path from 'path';
import { searchBooks, getChapters, getChapterContent } from './parsers/index';
import type { SourceKey } from './parsers/index';
import { getHotBooks } from './bookParser';
import type { ApiResponse, Book, Chapter, ChapterContent } from './types';
import { cacheGet, cacheSet } from './cache';
import authRouter from './routes/auth';
import bookshelfRouter from './routes/bookshelf';
import migrate from './db/migrate';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
}

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/bookshelf', bookshelfRouter);

export function getSource(query: Record<string, unknown>): SourceKey {
  const s = String(query.source ?? 'guangyu');
  if (s === 'biquge900' || s === 'qixinge') return s;
  return 'guangyu';
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * 带缓存的 API 响应处理：
 *   cacheKey → 命中直接返回 → 未命中 fetch → 写缓存 → 返回
 */
export async function cached<T>(
  res: express.Response,
  cacheKey: string,
  ttl: number,
  fetch: () => Promise<T>,
  logLabel: string,
  fallbackError: string,
) {
  try {
    const cached = await cacheGet<T>(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }
    const data = await fetch();
    await cacheSet(cacheKey, data, ttl);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = errorMessage(err, fallbackError);
    console.error(`[${logLabel}]`, msg);
    res.status(500).json({ success: false, error: msg });
  }
}

/** GET /api/search?keyword=xxx&source=xxx */
app.get('/api/search', async (req, res) => {
  const keyword = String(req.query.keyword ?? '').trim();
  if (!keyword) {
    res.status(400).json({ success: false, error: '请输入搜索关键词' });
    return;
  }
  const source = getSource(req.query);
  await cached<Book[]>(
    res,
    `search:${source}:${keyword}`,
    1800,
    () => searchBooks({ source, keyword }),
    'searchBooks',
    '搜索失败',
  );
});

/** GET /api/hot */
app.get('/api/hot', (_req, res) =>
  cached<Book[]>(res, 'hot', 1800, getHotBooks, 'getHotBooks', '获取热门推荐失败'),
);

/** GET /api/chapters?bookId=xxx&source=xxx */
app.get('/api/chapters', async (req, res) => {
  const bookId = String(req.query.bookId ?? '');
  if (!bookId) {
    res.status(400).json({ success: false, error: '缺少 bookId 参数' });
    return;
  }
  const source = getSource(req.query);
  const is = String(req.query.innerSource ?? '番茄');
  const it = String(req.query.innerTab ?? '小说');
  await cached<Chapter[]>(
    res,
    `chapters:${source}:${bookId}:${is}:${it}`,
    3600,
    () => getChapters({ source, bookId, innerSource: is, innerTab: it }),
    'getChapters',
    '获取章节失败',
  );
});

/** GET /api/content?bookId=xxx&itemId=xxx&source=xxx */
app.get('/api/content', async (req, res) => {
  const bookId = String(req.query.bookId ?? '');
  const itemId = String(req.query.itemId ?? '');
  if (!bookId || !itemId) {
    res.status(400).json({ success: false, error: '缺少 bookId 或 itemId 参数' });
    return;
  }
  const source = getSource(req.query);
  const is = String(req.query.innerSource ?? '番茄');
  const it = String(req.query.innerTab ?? '小说');
  await cached<ChapterContent>(
    res,
    `content:${source}:${bookId}:${itemId}:${is}:${it}`,
    86400,
    () => getChapterContent({ source, bookId, itemId, innerSource: is, innerTab: it }),
    'getChapterContent',
    '获取正文失败',
  );
});

// 生产模式：SPA 兜底，非 /api 请求返回 index.html
if (isProduction) {
  const clientIndex = path.join(__dirname, '../client/dist/index.html');
  app.get('*', (_req, res) => {
    res.sendFile(clientIndex);
  });
}

if (!process.env.VITEST) {
  migrate().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('迁移失败，仍尝试启动:', err.message);
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  });
}
