import { Router, type Request, type Response } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// 缓存或查找书籍：先查 books 表，没有就插入
async function upsertBook(book: {
  title: string;
  author?: string;
  cover?: string;
  intro?: string;
  bookId: string;
  sourceKey: string;
}) {
  const result = await pool.query(
    `INSERT INTO books (title, author, cover, intro, book_id, source_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [book.title, book.author ?? '', book.cover ?? '', book.intro ?? '', book.bookId, book.sourceKey],
  );
  if (result.rows.length > 0) return result.rows[0].id;

  const existing = await pool.query(
    'SELECT id FROM books WHERE book_id = $1 AND source_key = $2',
    [book.bookId, book.sourceKey],
  );
  return existing.rows[0]?.id ?? null;
}

// POST /api/bookshelf — 加入书架
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const { title, author, cover, intro, bookId, sourceKey } = req.body;

  if (!title || !bookId || !sourceKey) {
    res.status(400).json({ success: false, error: '缺少必要字段: title, bookId, sourceKey' });
    return;
  }

  try {
    const bookRowId = await upsertBook({ title, author, cover, intro, bookId, sourceKey });
    if (!bookRowId) {
      res.status(500).json({ success: false, error: '书籍缓存失败' });
      return;
    }

    await pool.query(
      'INSERT INTO bookshelf (user_id, book_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, bookRowId],
    );

    res.json({ success: true, message: '已加入书架' });
  } catch (err: any) {
    console.error('[bookshelf add]', err.message);
    res.status(500).json({ success: false, error: '加入书架失败' });
  }
});

// GET /api/bookshelf — 获取书架列表
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as any).user;

  try {
    const result = await pool.query(
      `SELECT b.id, b.title, b.author, b.cover, b.intro, b.book_id AS "bookId",
              b.source_key AS "sourceKey", s.added_at AS "addedAt",
              COALESCE(rp.chapter_index, 0) AS "chapterIndex",
              rp.chapter_item_id AS "chapterItemId"
       FROM bookshelf s
       JOIN books b ON b.id = s.book_id
       LEFT JOIN reading_progress rp ON rp.user_id = s.user_id AND rp.book_id = s.book_id
       WHERE s.user_id = $1
       ORDER BY s.added_at DESC`,
      [userId],
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error('[bookshelf list]', err.message);
    res.status(500).json({ success: false, error: '获取书架失败' });
  }
});

// DELETE /api/bookshelf/:bookId — 移出书架
router.delete('/:bookId', requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const bookId = parseInt(String(req.params.bookId));

  try {
    await pool.query(
      'DELETE FROM bookshelf WHERE user_id = $1 AND book_id = $2',
      [userId, bookId],
    );
    res.json({ success: true, message: '已移出书架' });
  } catch (err: any) {
    console.error('[bookshelf delete]', err.message);
    res.status(500).json({ success: false, error: '移出书架失败' });
  }
});

// PUT /api/bookshelf/:bookId/progress — 更新阅读进度
router.put('/:bookId/progress', requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as any).user;
  const bookId = parseInt(String(req.params.bookId));
  const { chapterIndex, chapterItemId } = req.body;

  try {
    await pool.query(
      `INSERT INTO reading_progress (user_id, book_id, chapter_index, chapter_item_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, book_id)
       DO UPDATE SET chapter_index = $3, chapter_item_id = $4, updated_at = now()`,
      [userId, bookId, chapterIndex ?? 0, chapterItemId ?? ''],
    );
    res.json({ success: true, message: '进度已更新' });
  } catch (err: any) {
    console.error('[progress update]', err.message);
    res.status(500).json({ success: false, error: '更新进度失败' });
  }
});

export default router;
