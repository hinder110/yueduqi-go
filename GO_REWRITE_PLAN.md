# Go 重写方案（学习笔记）

## 为什么要用 Go 重写

- 编译成单个二进制文件，部署简单（不用装 Node、不用 npm install）
- 内存占用小，启动快
- 并发性能好（goroutine 比 Promise 更轻量）
- 静态类型，编译时就能发现错误

## 整体思路

现在的 server/ 是一个 Express 应用，我们把它换成 Go。client/（前端）完全不动，API 路径也不变——前端不知道后端换了语言。

核心工作就是把 TypeScript 代码逐块翻译成 Go：

| 现在的文件 | 翻译成 Go 后 | 做什么的 |
|-----------|-------------|---------|
| cache.ts | cache/redis.go | Redis 读写 |
| bookParser.ts | parser/guangyu.go | 调光遇 API 搜书 |
| parsers/biqugeParser.ts | parser/biquge.go | 爬笔趣阁网页 |
| parsers/qixingeParser.ts | parser/qixinge.go | 爬七星阁网页 |
| parsers/index.ts | parser/parser.go | 根据 source 参数选书源 |
| index.ts | handler/*.go + main.go | HTTP 路由和启动 |
| routes/auth.ts | handler/auth.go | 注册登录 |
| routes/bookshelf.ts | handler/bookshelf.go | 书架管理 |
| middleware/auth.ts | middleware/auth.go | JWT 验证 |
| db/migrate.ts | db/migrate.go | 建表 |
| utils.ts | scraper/ | HTTP 请求 + HTML 解析 |

## 关键设计决策

### 1. 用标准库，不引入框架

Go 自带 HTTP server 已经很强了（1.22 版本开始支持路径参数），不需要 express/gin/echo 那一套。

### 2. 书源用策略模式

三个书源（光遇、笔趣阁、七星阁）实现同一个接口，都提供三个方法：搜书、取章节、取正文。路由层只跟接口打交道，不关心具体是哪个书源。

加新书源只需要写一个新文件实现这个接口，不用改其他代码。

### 3. 多镜像并发请求 = goroutine 擅长的活

现在 TypeScript 用 `Promise.any` 同时打 7 个镜像地址。Go 里用 goroutine 实现同样效果，而且代码更直观——同时起 7 个 goroutine 发请求，谁先回来用谁的，其他的取消掉。

这是整个项目里 Go 表达力最强的地方。

### 4. 错误处理方式不同

TypeScript 用 try/catch 抛出异常。Go 里错误就是普通返回值，每个函数返回 `(结果, 错误)` 两个值。虽然 `if err != nil` 到处会出现，但这很正常——不是设计缺陷，是 Go 的哲学。

### 5. JSON 序列化更简单

TypeScript 里对象的字段随便命名，API 返回的是 snake_case（book_id），代码里用 camelCase（bookId），需要手动映射。

Go 里用 struct tag 标注字段对应关系，序列化/反序列化时自动转换：
```
json 里叫 "book_id" → Go 里叫 BookID → 一行注解搞定
```

## 实施顺序

分 3 步走：

**第一步：核心只读接口**（搜书、热门、章节、正文）
- 不需要数据库，只依赖 Redis + 外部 API
- 写完后就能跑，curl 可以直接验证

**第二步：用户系统**（注册、登录、书架）
- 需要 PostgreSQL
- 加上 JWT 中间件

**第三步：部署**（Dockerfile 改造）
- 多阶段构建，最终镜像约 15MB（现在是几百 MB）

## 你会学到的 Go 核心概念

完成这个项目后，你会掌握：

- **goroutine + channel**：Go 的并发模型，Promise.any 的天然替代品
- **interface（隐式实现）**：不需要声明 implements，方法签名对了就是接口
- **error as value**：错误是返回值，不是异常
- **struct tag**：一行注解搞定 JSON 字段映射
- **defer**：资源清理（等价于 try-with-resources 或 finally）
- **多阶段 Docker 构建**：编译阶段 + 运行阶段分离

## 关键原则

- **不引入不必要的库**：能用标准库就用标准库
- **文件小而专注**：每个 handler 一个文件，每个 parser 一个文件
- **先跑通再优化**：第一版目标是把所有接口跑通，不做性能优化
- **保持 API 兼容**：前端一行代码不改
