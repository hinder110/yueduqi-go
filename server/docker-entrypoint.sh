#!/bin/sh
set -e

# 等待数据库就绪
echo "等待数据库连接..."
until node -e "require('./dist/db/index').default.query('SELECT 1')" 2>/dev/null; do
  sleep 1
done

# 运行迁移
echo "初始化数据库表..."
node ./dist/db/migrate.js

# 启动服务
echo "启动服务..."
exec node ./dist/index.js
