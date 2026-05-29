# yueduqi-go 架构升级设计

## 1. 目标

将 yueduqi-go 从功能性雏形升级为可维护、可扩展的阅读器后端。

## 2. 现状

| 功能 | 状态 |
|------|------|
| Parser 接口 + 三书源实现 | ✅ 有接口，但用 switch 选书源 |
| 统一 API 响应格式 | ✅ writeJSON/writeOK/writeErr |
| Redis 缓存 | ✅ cache/redis.go，TTL 硬编码 |
| 用户认证（JWT） | ✅ |
| 书架 CRUD | ✅ |
| 阅读进度 | ✅ reading_progress 表 + 同步 |
| 前端 api.ts | ⚠️ 单文件 118 行 |
| 阅读器设置 | ⚠️ 组件内 useState，不持久化 |
| Parser 测试 | ❌ 无 |
| 书源健康状态 | ❌ 无 |

## 3. 设计

### 3.1 Agent 1：后端（Parser 注册表 + 缓存 TTL + 书源健康 + 探活 + 测试）

**Parser 注册表：**
- `parser/registry.go`：`Register(name, Parser)` + `Get(name) Parser`
- 三个 parser 的 `init()` 自注册
- `parser/parser.go` 只保留 interface，删除 `ForSource`
- handler 层改用 `parser.Get(source)`，删除重复的 Parser interface

**缓存 TTL：**
- `cache/ttl.go`：`SearchTTL=30m`、`ChaptersTTL=1h`、`ContentTTL=24h`、`HotTTL=30m`
- handler 引用常量替代硬编码

**书源健康：**
- `handler/health.go`：`SourceHealth` 结构体，内存存储 + RWMutex
- 三种状态：healthy / degraded / down（连续 3 次失败变 down）
- `GET /api/sources/status` 接口
- `main.go` 启动 goroutine 每 15 分钟探活

**Parser 测试：**
- 提取纯解析函数：`ParseSearchHTML(html) ([]Book, error)`
- HTML fixture 放在 `parser/testdata/`
- 测试文件：`biquge_test.go`、`qixinge_test.go`

### 3.2 Agent 2：前端（api 拆分 + hooks + ReaderSettingsContext）

**api 模块化：**
```
client/src/api/
  client.ts    — request/authRequest
  auth.ts      — login, register
  bookshelf.ts — add, list, remove, updateProgress
  search.ts    — fetchSearch, fetchHotBooks
  reader.ts    — fetchChapters, fetchContent
```
删除 `client/src/api.ts`，更新所有 import。

**ReaderSettingsContext：**
- localStorage 持久化 fontSize / theme / pageMode
- 导出 `useReaderSettings()` hook
- App.tsx 包裹 `<ReaderSettingsProvider>`
- ReaderPage 移除内联 useState

### 3.3 文件清单

**Agent 1 涉及文件：**
```
新建: parser/registry.go, cache/ttl.go, handler/health.go
新建: parser/testdata/biquge_search.html, biquge_chapter.html, qixinge_search.html
新建: parser/biquge_test.go, parser/qixinge_test.go
修改: parser/parser.go, parser/biquge.go, parser/qixinge.go, parser/guangyu.go
修改: handler/handler.go, handler/source.go
修改: handler/search.go, chapters.go, content.go, hot.go
修改: main.go
```

**Agent 2 涉及文件：**
```
新建: api/client.ts, auth.ts, bookshelf.ts, search.ts, reader.ts
新建: contexts/ReaderSettingsContext.tsx
删除: api.ts
修改: App.tsx, ReaderPage.tsx, SearchPage.tsx, ChaptersPage.tsx, BookshelfPage.tsx
修改: AuthContext.tsx (import)
```

## 4. 测试策略

- Agent 1：`go test ./parser/...` — 5 个 fixture 测试
- Agent 1：`go build ./...` — 编译验证
- Agent 2：`npx tsc --noEmit` — 类型检查

## 5. 不包含

- 不加新书源
- 不改数据库 schema
- 不改 Dockerfile / docker-compose
- 不改 CSS
