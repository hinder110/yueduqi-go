import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { JWT_SECRET, TOKEN_EXPIRY } from '../config';

const router = Router();

interface AuthBody {
  username: string;
  password: string;
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, password }: AuthBody = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    return;
  }

  if (username.length < 2 || username.length > 50) {
    res.status(400).json({ success: false, error: '用户名长度 2-50 个字符' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ success: false, error: '密码至少 6 位' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash],
    );

    const user = result.rows[0];
    res.status(201).json({
      success: true,
      data: { id: user.id, username: user.username, created_at: user.created_at },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ success: false, error: '用户名已存在' });
      return;
    }
    console.error('[register]', err.message);
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password }: AuthBody = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username],
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    );

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username },
      },
    });
  } catch (err: any) {
    console.error('[login]', err.message);
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

export default router;
