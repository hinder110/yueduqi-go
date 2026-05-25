import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'yueduqi',
  user: process.env.DB_USER || 'yueduqi',
  password: process.env.DB_PASSWORD || 'yueduqi123',
});

pool.on('error', (err) => {
  console.error('数据库连接异常:', err.message);
});

export default pool;
