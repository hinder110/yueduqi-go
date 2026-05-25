# 阅读器 (YueDuQi) 开发报告

## 快速开始

### Docker 一键部署

```bash
git clone https://github.com/hinder110/yueduqi.git
cd yueduqi
podman compose up -d
```

访问 `http://localhost:3000`

### 本地开发

需要 Node.js 18+、PostgreSQL 17、Redis 7

```bash
# 数据库
podman run -d --name yueduqi-db -p 5432:5432 \
  -e POSTGRES_USER=yueduqi -e POSTGRES_PASSWORD=yueduqi123 \
  -e POSTGRES_DB=yueduqi docker.io/library/postgres:17-alpine

# 缓存
podman run -d --name yueduqi-redis -p 6379:6379 \
  docker.io/library/redis:7-alpine

# 后端
cd server && npm install && npx tsx src/index.ts

# 前端（新终端）
cd client && npm install && npm run dev
```

后端 `http://localhost:3001`，前端 `http://localhost:3000`（已代理 /api）

### 技术栈

| 层 | Web 版 | Tauri 桌面版 |
|------|----------|-------------|
| 前端 | React 19 + TypeScript + Vite | React 19 + TypeScript + Vite |
| 后端 | Express + PostgreSQL + Redis | Rust (tokio, reqwest, rusqlite) |
| 部署 | Docker / Podman Compose | 单一 .exe 二进制 |

---

## 一、项目概述

**阅读器 (YueDuQi)** 是一个桌面/Web 双平台小说阅读应用，灵感来源于开源阅读软件 [Legado（阅读）](https://github.com/gedoor/legado)。

项目起源于一个简单的学习目标——"做一个类似 Legado 的简化版项目，用来理解它的核心原理"。随着开发推进，逐渐从一个固定网站的 HTML 解析器，演进为支持多书源、用户认证、书架管理的全栈应用。

### 核心功能

- **多书源搜索**：支持番茄小说（API 代理）、笔趣阁、七星阁三个书源
- **章节目录解析**：获取任意书籍的完整章节目录
- **正文阅读**：展示章节正文，支持日间/夜间模式、三种字号切换
- **用户系统**：注册、登录、JWT 认证
- **书架管理**：收藏书籍、移出书架
- **阅读进度**：记录每本书的阅读位置

---

## 二、项目架构

项目采用**前后端分离**架构，经过两个阶段的演进：

### 阶段一：简单 Web 解析器（v1.0）

按照 `阅读器.md` 设计文档的规划，最初版本仅支持固定网站解析，核心流程为：

```
搜索关键词 → 请求网站搜索页 → 解析搜索结果 → 点击书籍 → 解析章节目录 → 点击章节 → 解析正文 → 阅读展示
```

技术栈为 React + TypeScript + Vite（前端）和 Node.js + Express + Cheerio（后端），只实现了三个 API：

- `GET /api/search?keyword=xxx` → 返回 Book[]
- `GET /api/chapters?bookId=xxx&source=xxx` → 返回 Chapter[]
- `GET /api/content?bookId=xxx&itemId=xxx&source=xxx` → 返回 ChapterContent

### 阶段二：全栈阅读应用（v2.0）

在阶段一基础上，新增了两个维度：

1. **Web 全栈版本**（`client/` + `server/`）：在原有 Express 后端上增加了用户认证、数据库、书架系统，并使用 React Context 管理前端登录状态
2. **Tauri 桌面版本**（根目录 `src/` + `src-tauri/`）：将解析逻辑移植到 Rust，使用 Tauri v2 打包为原生桌面应用，支持用户自定义书源（Legado 格式）

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   Web 前端 (React)    │  │   桌面前端 (Tauri + React)   │ │
│  │   client/src/         │  │   src/                       │ │
│  │   port 3000 (Vite)    │  │   嵌入 WebView               │ │
│  └──────────┬───────────┘  └──────────────┬───────────────┘ │
└─────────────┼──────────────────────────────┼─────────────────┘
              │ HTTP (fetch)                 │ IPC (invoke)
              ▼                              ▼
┌─────────────────────────┐  ┌────────────────────────────────┐
│    Web 后端 (Express)    │  │    桌面后端 (Rust)              │
│    server/src/           │  │     src-tauri/src/              │
│    port 3001             │  │     进程内运行                  │
│                          │  │                                │
│  ┌────────────────────┐  │  │  ┌──────────────────────────┐  │
│  │  路由层             │  │  │  │  IPC 命令处理 (lib.rs)   │  │
│  │  index.ts           │  │  │  └──────────────────────────┘  │
│  │  routes/auth.ts     │  │  │  ┌──────────────────────────┐  │
│  │  routes/bookshelf.ts│  │  │  │  CSS 规则引擎             │  │
│  └────────┬───────────┘  │  │  │  (rule_engine.rs)         │  │
│  ┌────────┴───────────┐  │  │  └──────────────────────────┘  │
│  │  解析层             │  │  │  ┌──────────────────────────┐  │
│  │  parsers/           │  │  │  │  通用解析器               │  │
│  │  - guangyu (API)    │  │  │  │  (generic_parser.rs)     │  │
│  │  - biquge900 (HTML) │  │  │  └──────────────────────────┘  │
│  │  - qixinge (HTML)   │  │  │  ┌──────────────────────────┐  │
│  └────────┬───────────┘  │  │  │  书源管理                 │  │
│  ┌────────┴───────────┐  │  │  │  (source_manager.rs)     │  │
│  │  数据层             │  │  │  └──────────────────────────┘  │
│  │  db/                │  │  │  ┌──────────────────────────┐  │
│  │  - pg Pool          │  │  │  │  本地存储                 │  │
│  │  - migrate.ts       │  │  │  │  (db.rs → SQLite)        │  │
│  └────────────────────┘  │  │  └──────────────────────────┘  │
└──────────┬───────────────┘  └────────────────────────────────┘
           │
           ▼
    ┌─────────────┐
    │  PostgreSQL  │
    │  (Podman)    │
    └─────────────┘
```

---

## 三、技术栈总览

| 层级 | Web 版本 | Tauri 桌面版 |
|------|----------|-------------|
| **桌面框架** | — | Tauri v2 |
| **前端** | React 19 + TypeScript + Vite | React 19 + TypeScript + Vite |
| **后端** | Node.js + Express | Rust (tokio, reqwest, scraper) |
| **HTML 解析** | axios + cheerio + iconv-lite | reqwest + scraper + encoding_rs |
| **数据库** | PostgreSQL 17 (Podman 容器) + pg | SQLite (rusqlite, bundled) |
| **认证** | JWT + bcryptjs | 无（单机应用） |
| **规则引擎** | 硬编码三个书源 | CSS 选择器链 + 正则替换 |
| **部署** | Docker (多阶段构建) | 原生二进制 (.exe) |

---

## 四、目录结构

```
yueduqi/
├── 阅读器.md                      # 项目初始设计文档
├── README.md                       # 项目介绍与编译指南
├── Dockerfile                      # Web 版 Docker 镜像
├── docker-compose.yml              # Web 版容器编排
│
├── client/                         # ── Web 前端（独立 React 应用）──
│   ├── package.json                # 依赖：react, react-router-dom, vite
│   ├── vite.config.ts              # 配置 /api 代理到 localhost:3001
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                # BrowserRouter 入口
│       ├── App.tsx                 # AuthProvider + 路由配置
│       ├── types.ts                # 类型定义
│       ├── api.ts                  # HTTP 请求层
│       ├── index.css               # 全局样式 (~680 行)
│       ├── contexts/
│       │   └── AuthContext.tsx      # 认证状态管理
│       └── pages/
│           ├── SearchPage.tsx      # 搜索 + 热门推荐
│           ├── ChaptersPage.tsx    # 章节目录 + 加入书架
│           ├── ReaderPage.tsx      # 正文阅读
│           ├── BookshelfPage.tsx   # 书架管理
│           └── LoginPage.tsx       # 登录/注册
│
├── server/                         # ── Web 后端（Express API）──
│   ├── package.json                # 依赖：express, axios, cheerio, pg, bcryptjs, jsonwebtoken
│   ├── tsconfig.json               # CommonJS 编译输出到 dist/
│   └── src/
│       ├── index.ts                # Express 入口，路由挂载
│       ├── types.ts                # 数据类型
│       ├── utils.ts                # Axios HTTP 客户端
│       ├── bookParser.ts           # 番茄小说 API 客户端
│       ├── parsers/
│       │   ├── index.ts            # 书源分发器
│       │   ├── biqugeParser.ts     # 笔趣阁 HTML 解析 (GBK)
│       │   └── qixingeParser.ts    # 七星阁 HTML 解析 (UTF-8)
│       ├── routes/
│       │   ├── auth.ts             # 注册/登录
│       │   └── bookshelf.ts        # 书架 CRUD + 阅读进度
│       └── db/
│           ├── index.ts            # PostgreSQL 连接池
│           └── migrate.ts          # 数据库建表
│
├── src/                            # ── Tauri 前端 ──
│   ├── main.tsx                    # HashRouter 入口
│   ├── App.tsx                     # 路由配置
│   ├── api.ts                      # Tauri IPC 调用
│   ├── types.ts
│   ├── index.css
│   └── pages/                      # 6 个页面（比 Web 版多 History、Settings）
│
├── src-tauri/                      # ── Tauri Rust 后端 ──
│   ├── Cargo.toml                  # Rust 依赖
│   ├── tauri.conf.json             # 窗口配置
│   ├── capabilities/default.json   # 权限声明
│   └── src/
│       ├── main.rs                 # 程序入口
│       ├── lib.rs                  # IPC 命令注册 + AppState
│       ├── db.rs                   # SQLite 书架/历史
│       ├── source_manager.rs       # 书源加载解析
│       ├── rule_engine.rs          # CSS 规则引擎
│       ├── generic_parser.rs       # HTTP + HTML 通用解析
│       └── mock_source.rs          # 离线模拟数据
│
└── shuyuan_*.json                  # 书源配置文件
```

---

## 五、数据库设计

### 5.1 PostgreSQL（Web 版本）

Web 版本使用 PostgreSQL 17 运行在 Podman 容器中。容器启动命令：

```bash
podman run -d --name yueduqi-db \
  -e POSTGRES_USER=yueduqi \
  -e POSTGRES_PASSWORD=yueduqi123 \
  -e POSTGRES_DB=yueduqi \
  -p 5432:5432 \
  postgres:17-alpine
```

数据库连接池配置（`server/src/db/index.ts`）：

```typescript
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'yueduqi',
  user: process.env.DB_USER || 'yueduqi',
  password: process.env.DB_PASSWORD || 'yueduqi123',
});
```

#### 表结构（4 张表）

**users** — 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 用户唯一标识 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 哈希后的密码 |
| created_at | TIMESTAMPTZ | DEFAULT now() | 注册时间 |

**books** — 书籍缓存表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK | 内部自增 ID |
| title | VARCHAR(200) | NOT NULL | 书名 |
| author | VARCHAR(100) | DEFAULT '' | 作者 |
| cover | TEXT | DEFAULT '' | 封面图 URL |
| intro | TEXT | DEFAULT '' | 简介 |
| book_id | VARCHAR(100) | NOT NULL | 源站书籍 ID |
| source_key | VARCHAR(50) | NOT NULL | 书源标识 (guangyu/biquge900/qixinge) |

**bookshelf** — 书架表（收藏关系）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK | 自增 ID |
| user_id | UUID | FK → users(id), ON DELETE CASCADE | 用户 |
| book_id | INT | FK → books(id), ON DELETE CASCADE | 书籍 |
| added_at | TIMESTAMPTZ | DEFAULT now() | 加入时间 |
| — | — | UNIQUE(user_id, book_id) | 同一用户不能重复收藏 |

**reading_progress** — 阅读进度表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK | 自增 ID |
| user_id | UUID | FK → users(id), ON DELETE CASCADE | 用户 |
| book_id | INT | FK → books(id), ON DELETE CASCADE | 书籍 |
| chapter_index | INT | DEFAULT 0 | 当前章节序号 |
| chapter_item_id | VARCHAR(100) | DEFAULT '' | 当前章节 ID |
| updated_at | TIMESTAMPTZ | DEFAULT now() | 更新时间 |
| — | — | UNIQUE(user_id, book_id) | 每本书一个进度 |

#### 表关系

```
users (1) ──→ (N) bookshelf (N) ←── (1) books
                     │                       │
                     └── (1:1) reading_progress
```

设计要点：
- `books` 表独立存在，作为书籍信息缓存，不在 bookshelf 删除时级联删除（因为多用户可能收藏同一本书）
- `bookshelf` 和 `reading_progress` 都使用 `ON DELETE CASCADE`，用户删除后自动清理
- `bookshelf` 的 UNIQUE(user_id, book_id) 防止重复收藏
- `reading_progress` 使用 `ON CONFLICT ... DO UPDATE` 实现插入或更新（upsert）

### 5.2 SQLite（Tauri 桌面版）

桌面版本使用 SQLite（通过 rusqlite bundled 模式），数据库文件为 `src-tauri/yueduqi.db`，包含 `bookshelf` 和 `history` 两张表，结构较简单，不需要用户系统（单机应用）。

---

## 六、后端 API 设计

### 6.1 阅读相关 API

所有阅读相关 API 为 GET 请求，无需认证。

#### GET /api/search

搜索书籍。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| source | string | 否 | 书源：guangyu（默认）、biquge900、qixinge |

响应格式：
```json
{
  "success": true,
  "data": [{
    "title": "书名",
    "author": "作者",
    "cover": "封面URL",
    "intro": "简介",
    "bookId": "源站ID",
    "sourceKey": "guangyu",
    "source": "番茄",
    "tab": "小说"
  }]
}
```

#### GET /api/hot

获取热门推荐列表（仅光遇书源支持）。无需参数。

#### GET /api/chapters

获取书籍章节目录。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bookId | string | 是 | 书籍 ID |
| source | string | 否 | 书源（默认 guangyu） |
| innerSource | string | 否 | 内部书源名（默认"番茄"） |
| innerTab | string | 否 | 内部分类（默认"小说"） |

#### GET /api/content

获取章节正文。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bookId | string | 是 | 书籍 ID |
| itemId | string | 是 | 章节 ID |
| source | string | 否 | 书源 |
| innerSource | string | 否 | 内部书源名 |
| innerTab | string | 否 | 内部分类 |

### 6.2 认证 API

#### POST /api/auth/register

注册新用户。

请求体：
```json
{ "username": "test", "password": "123456" }
```

验证规则：
- username：2-50 个字符
- password：至少 6 位
- 用户名唯一（数据库 UNIQUE 约束）

处理流程：`bcrypt.hash(password, 10)` → `INSERT INTO users` → 返回用户信息

错误码：
- 400：参数不合法
- 409：用户名已存在（捕获 PostgreSQL 23505 错误码）

#### POST /api/auth/login

用户登录。

请求体：
```json
{ "username": "test", "password": "123456" }
```

处理流程：查询用户 → `bcrypt.compare(password, hash)` → `jwt.sign({ userId, username }, secret, { expiresIn: '7d' })`

响应：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "user": { "id": "uuid", "username": "test" }
  }
}
```

### 6.3 书架 API

所有书架 API 需要 Bearer Token 认证，通过 `requireAuth` 中间件校验。

认证中间件（`server/src/routes/bookshelf.ts:20-28`）：
```typescript
function requireAuth(req, res, next) {
  const user = getUser(req);  // 从 Authorization header 提取并验证 JWT
  if (!user) {
    res.status(401).json({ success: false, error: '请先登录' });
    return;
  }
  (req as any).user = user;
  next();
}
```

#### POST /api/bookshelf — 加入书架

请求体：
```json
{
  "title": "书名",
  "author": "作者",
  "cover": "封面URL",
  "intro": "简介",
  "bookId": "源站书籍ID",
  "sourceKey": "guangyu"
}
```

处理流程：
1. `upsertBook()`：先尝试 INSERT（`ON CONFLICT DO NOTHING`），如果已存在则 SELECT 查出内部 ID
2. `INSERT INTO bookshelf`：建立用户-书籍关联

#### GET /api/bookshelf — 获取书架列表

执行三表 JOIN：
```sql
SELECT b.*, s.added_at, rp.chapter_index, rp.chapter_item_id
FROM bookshelf s
JOIN books b ON b.id = s.book_id
LEFT JOIN reading_progress rp ON rp.user_id = s.user_id AND rp.book_id = s.book_id
WHERE s.user_id = $1
ORDER BY s.added_at DESC
```

#### DELETE /api/bookshelf/:bookId — 移出书架

删除 `bookshelf` 表中的对应行。注意 `:bookId` 是 `books` 表的内部自增 ID，而非源站 book_id。

#### PUT /api/bookshelf/:bookId/progress — 更新阅读进度

请求体：
```json
{ "chapterIndex": 42, "chapterItemId": "abc123" }
```

使用 `INSERT ... ON CONFLICT (user_id, book_id) DO UPDATE` 实现 upsert。

---

## 七、书源解析层

Web 版本支持三个书源，通过 `parsers/index.ts` 中的 `getSource()` 函数分发：

```typescript
type SourceKey = 'guangyu' | 'biquge900' | 'qixinge';

function getSource(query): SourceKey {
  const s = String(query.source ?? 'guangyu');
  if (s === 'biquge900' || s === 'qixinge') return s;
  return 'guangyu';
}
```

### 7.1 光遇（guangyu）

- 类型：第三方 API 代理
- 实现：`server/src/bookParser.ts`
- 原理：请求 `v1-v7.gyks.cf` 的搜索接口，自动尝试多个 host 做容错
- 特点：数据为 JSON 格式，解析最可靠；支持热门推荐；需要 innerSource 和 innerTab 参数定位具体书源

### 7.2 笔趣阁（biquge900）

- 类型：HTML 网页解析
- 实现：`server/src/parsers/biqugeParser.ts`
- 编码：GBK（使用 iconv-lite 解码）
- 解析方式：cheerio CSS 选择器从 HTML 中提取搜索结果、章节列表、正文

### 7.3 七星阁（qixinge）

- 类型：HTML 网页解析
- 实现：`server/src/parsers/qixingeParser.ts`
- 编码：UTF-8
- 特殊处理：封面图和简介从光遇 API 补充

### 7.4 HTTP 客户端

统一使用 `server/src/utils.ts` 中的 Axios 实例：

```typescript
const httpClient = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 ... Mobile ...',
  },
});
```

模拟移动端 User-Agent，避免被目标网站拦截。

---

## 八、前端设计

### 8.1 路由设计

Web 版本使用 BrowserRouter，共 5 个路由：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | SearchPage | 搜索 + 热门推荐 |
| `/chapters` | ChaptersPage | 章节目录（接收 location.state.book） |
| `/reader` | ReaderPage | 正文阅读（接收 location.state.book/chapter/chapters） |
| `/login` | LoginPage | 登录/注册 |
| `/bookshelf` | BookshelfPage | 书架管理（需登录） |

页面间通过 `react-router-dom` 的 `useNavigate` + `location.state` 传递数据，避免 URL 中暴露长参数。

### 8.2 认证状态管理

认证状态使用 React Context 实现（`client/src/contexts/AuthContext.tsx`），结构如下：

```typescript
interface AuthState {
  user: User | null;       // 当前用户信息
  token: string | null;    // JWT token
  loading: boolean;        // 初始化加载中
  login(username, password): Promise<string | null>;
  register(username, password): Promise<string | null>;
  logout(): void;
}
```

状态持久化流程：

```
登录成功
  → localStorage.setItem('token', token)
  → localStorage.setItem('user', JSON.stringify(user))
  → setState({ user, token })

页面刷新
  → AuthProvider useEffect
  → localStorage.getItem('token')
  → localStorage.getItem('user')
  → setState 恢复登录状态
```

### 8.3 API 请求层

`client/src/api.ts` 提供两层请求函数：

- `request<T>(path, options?)` — 基础请求，返回 `ApiResponse<T>`
- `authRequest<T>(path, options?)` — 认证请求，自动从 localStorage 获取 token 并附加 `Authorization: Bearer xxx` 头

这种设计让调用方无需关心 token 的存储和传递：

```typescript
// 无需认证的接口
const result = await fetchSearch('三体');

// 需要认证的接口
const result = await addToBookshelf({ title, bookId, sourceKey });
// token 自动从 localStorage 读取并附带
```

所有请求统一返回 `ApiResponse<T>` 格式：

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 8.4 页面组件设计

**SearchPage** — 首页，包含：
- 书源选择器（三个按钮切换 guangyu/biquge900/qixinge）
- 搜索栏（支持回车搜索）
- 搜索结果列表（每本书显示封面、书名、作者、分类、最新章节、简介）
- 热门推荐网格（6 列响应式，移动端缩为 3 列）
- 头部导航：未登录显示"登录"按钮，已登录显示用户名 + "书架" + "退出"

**ChaptersPage** — 章节目录页：
- 接收上一页传来的 Book 对象
- 展示完整章节列表
- 已登录用户可点击"加入书架"按钮

**ReaderPage** — 阅读页，功能最丰富：
- 日间/夜间模式切换（CSS 变量实现两套配色）
- 三种字号档位（sm/md/lg，16px/18px/21px）
- 上一章/下一章翻页
- 章节目录显示（当前第 X / 共 N 章）
- 标题居中显示，正文使用衬线字体渲染
- `dangerouslySetInnerHTML` 渲染解析后的 HTML 正文

**LoginPage** — 认证页：
- 登录/注册 tab 切换
- 注册成功后自动登录并跳转首页
- 表单验证 + 错误提示

**BookshelfPage** — 书架页：
- 列表展示收藏书籍（封面、书名、作者、阅读进度）
- 点击进入阅读
- 每本书右侧"移除"按钮
- 空书架提示

### 8.5 样式设计

全局 CSS（`client/src/index.css`，约 680 行）使用 CSS 变量管理主题色：

```css
:root {
  --bg: #f5f5f5;
  --surface: #ffffff;
  --text: #333333;
  --text-secondary: #888888;
  --primary: #e85d04;      /* 橙色主色调 */
  --primary-hover: #d45500;
  --border: #e0e0e0;
  --radius: 8px;
  --max-width: 800px;
}
```

阅读器页面额外定义了两套主题变量（theme-light/theme-dark）和三档字号变量（font-sm/md/lg），实现主题切换无需 JavaScript 操作具体样式。

---

## 九、Tauri 桌面版本

桌面版本与 Web 版本共享 React 前端代码风格，但有本质差异：

### 9.1 架构差异

| 特性 | Web 版 | Tauri 版 |
|------|--------|----------|
| 后端通信 | HTTP fetch → Express | IPC invoke → Rust |
| 路由模式 | BrowserRouter | HashRouter |
| 数据库 | PostgreSQL（需独立容器） | SQLite（嵌入式，bundled） |
| 书源 | 3 个硬编码解析器 | CSS 规则引擎，支持自定义书源 |
| 认证 | JWT + 用户系统 | 无（单机应用） |
| 打包 | Docker 镜像 | 单一 .exe 文件 |

### 9.2 规则引擎

Tauri 版的核心创新是 **CSS 规则引擎**（`src-tauri/src/rule_engine.rs`），支持 Legado 格式的书源配置：

```
规则格式: CSS选择器@text|href|html|src
示例: .result-item a@text  → 选择 .result-item a 元素的文本内容
```

引擎实现了：
- 元素属性提取（text, href, html, src）
- 列表提取（extract_all 用于搜索结果、章节列表）
- URL 规范化（相对路径转绝对路径）
- 正则替换支持
- 字符编码自动检测（GBK/UTF-8 via encoding_rs）

### 9.3 离线模拟书源

`mock_source.rs` 提供了一个内置的 `__mock__` 书源，不依赖网络即可返回模拟数据。搜索任意关键词返回 3 本修仙小说，每本书最多 200 章，内容为动态生成的中文章节。这确保了应用在无网络或书源全部失效时仍可演示基本功能。

### 9.4 IPC 命令

Rust 后端通过 10 个 IPC 命令与前端交互（`src-tauri/src/lib.rs`）：

| 命令 | 说明 |
|------|------|
| `search_books` | 多书源并发搜索 |
| `get_chapters` | 解析章节目录 |
| `get_content` | 解析正文 |
| `get_sources` | 获取书源列表（用于设置页） |
| `toggle_source` | 启用/禁用书源 |
| `add_to_bookshelf` | 加入书架（SQLite） |
| `remove_from_bookshelf` | 移出书架 |
| `get_bookshelf` | 获取书架列表 |
| `add_history` | 记录阅读历史 |
| `get_history` | 获取阅读历史 |

---

## 十、部署方案

### 10.1 Web 版 Docker 部署

使用多阶段构建（`Dockerfile`）：

1. **client-build 阶段**：`npm ci` → `npm run build`（Vite 输出到 dist/）
2. **server-build 阶段**：`npm ci` → `tsc`（TypeScript 编译到 dist/）
3. **生产镜像**：`node:24-alpine`，仅复制编译产物

```yaml
# docker-compose.yml
services:
  yueduqi:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
```

生产模式下，Express 同时托管前端静态文件和 API 服务：

```typescript
// server/src/index.ts
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}
```

### 10.2 桌面版编译

```bash
npm run tauri build
```

产物为 `src-tauri/target/release/yueduqi.exe`（约 10-20MB），无需安装运行时依赖，双击即可运行。

### 10.3 当前开发环境

| 服务 | 技术 | 端口 | 启动方式 |
|------|------|------|----------|
| 前端 | Vite dev server | 3000 | `cd client && npm run dev` |
| 后端 | tsx watch | 3001 | `cd server && npm run dev` |
| 数据库 | PostgreSQL 17 (Podman) | 5432 | `podman start yueduqi-db` |

Vite 配置了 `/api` 代理，前端请求自动转发到后端，开发时无需额外配置。

---

## 十一、开发过程总结

### 从设计文档到实际实现

项目严格遵循 `阅读器.md` 的设计规划，但自然地超出了最初的范围：

**原定不做但实际实现了的功能：**
- 多书源搜索（原计划只支持一个固定网站）
- 用户系统（原计划明确排除账号系统）
- 书架同步（原计划排除书架同步）
- Tauri 桌面版（原计划只需 Web 版）

**原定不做且确实没做的：**
- JS 执行（动态加密书源）
- 听书、EPUB/TXT 导出
- 复杂翻页动画

### 技术决策理由

1. **PostgreSQL over SQLite（Web 版）**：多用户场景需要真正的并发支持，SQLite 不适合服务端多连接
2. **JWT over Session**：无状态 token 更适合 API 服务，不需要服务端存储会话
3. **React Context over Redux**：认证状态简单，不需要额外的状态管理库
4. **硬编码解析器 over 规则引擎（Web 版）**：Web 版目标是快速验证全栈流程，硬编码三个书源足够；规则引擎的复杂度更适合 Tauri 版
5. **Podman over Docker**：无 root 权限运行，更安全

### 关键数据流

```
用户在搜索框输入"三体" → 回车
  → SearchPage.handleSearch()
  → api.fetchSearch("三体", "guangyu")
  → HTTP GET /api/search?keyword=三体&source=guangyu
  → Express: getSource() → guangyu
  → bookParser.searchBooks("三体")
  → axios.get("https://v1.gyks.cf/...")
  → 解析 JSON → Book[]
  → 返回 { success: true, data: Book[] }
  → SearchPage setBooks(data)
  → React 重新渲染，显示搜索结果卡片

用户点击一本书 → navigate('/chapters', { state: { book } })
  → ChaptersPage.loadChapters()
  → api.fetchChapters(bookId, sourceKey, source, tab)
  → GET /api/chapters?bookId=X&source=Y
  → 解析器获取章节列表
  → 返回 Chapter[]
  → 渲染章节列表

用户点击一个章节 → navigate('/reader', { state: { book, chapter, chapters, currentIndex } })
  → ReaderPage.loadContent(chapter)
  → api.fetchContent(bookId, itemId, ...)
  → GET /api/content?bookId=X&itemId=Y
  → 返回 { title, content: "<p>段落一</p><p>段落二</p>" }
  → dangerouslySetInnerHTML 渲染正文
```

### 版本演进

| 版本 | 内容 | 状态 |
|------|------|------|
| v1.0 | 单一书源搜索 + 章节 + 阅读 | 完成 |
| v1.1 | 多书源支持（笔趣阁、七星阁） | 完成 |
| v2.0 | Tauri 桌面应用 + 规则引擎 | 完成 |
| v2.1 | Web 全栈：用户系统 + 书架 + 阅读进度 | 完成 |
| v2.2 | 前后端对接（本次开发） | 完成 |

---

## 十二、技术要点记录

### HTML 编码处理

笔趣阁使用 GBK 编码，Node.js 原生不支持。解决方案是使用 `iconv-lite` 在 axios 响应拦截器中解码：

```typescript
// parsers/biqugeParser.ts
const response = await axios.get(url, {
  responseType: 'arraybuffer',
  responseEncoding: 'binary',
});
const html = iconv.decode(Buffer.from(response.data), 'gbk');
```

### 书籍缓存策略

书架功能中，`upsertBook()` 使用 `INSERT ... ON CONFLICT DO NOTHING` 实现书籍去重。如果两本书在同一书源下有相同的 `book_id`，它们共享同一条 `books` 记录，不同用户收藏同一本书也指向同一条记录。这避免了书籍信息冗余存储。

### 前端 Vite 代理

开发环境下，Vite 将 `/api/*` 请求代理到 `localhost:3001`，避免了跨域问题：

```typescript
// client/vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

### JWT 密钥管理

开发环境使用硬编码的 fallback 值 `'yueduqi-dev-secret'`，生产环境通过 `JWT_SECRET` 环境变量传入。这是安全最佳实践——密钥永远不应硬编码在源码中。

### 认证中间件的守卫模式

```typescript
function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) {
    res.status(401).json(...);
    return;  // 不调用 next()，拦截请求
  }
  (req as any).user = user;
  next();  // 通过守卫，继续处理
}
```

这种模式让每个受保护的路由只需添加 `requireAuth` 中间件即可，无需在每个处理函数中重复认证逻辑。

---
