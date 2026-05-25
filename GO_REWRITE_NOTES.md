# Go 重写注意事项

> 目的：写代码时照着检查，避免常见错误。也是对代码实现思路的说明。

---

## JSON 字段兼容（最高优先级）

前端期望的 JSON 格式不能变：

```json
// 所有接口统一这个格式
{ "success": true, "data": ... }
{ "success": false, "error": "错误信息" }
```

**Go 里容易犯的错：**

1. **struct 没加 json tag** → 字段导出为大写，前端解析不了。写法：
   ```
   BookID string `json:"book_id"`
   Title  string `json:"title"`
   ```

2. **omitempty 用错** → `omitempty` 在值是零值（空字符串/0/nil）时会跳过字段。不要给一定会返回的字段加 omitempty。

3. **error 字段** — Go struct 里叫 `Error`，json tag 写成 `json:"error,omitempty"`。

4. **API 字段全查一遍** — 前端代码 `src/api.ts` 和 `src/types.ts` 里有哪些字段，Go 版必须有。一个都不能差：
   - Book: `title`, `author`, `cover`, `intro`, `kind`, `lastChapter`, `wordCount`, `bookId`, `sourceKey`, `source`, `tab`
   - Chapter: `title`, `itemId`
   - ChapterContent: `title`, `content`

---

## 错误处理模式

Go 不用 try/catch，用 error 返回值。每个 handler 里会出现多次 `if err != nil`：

```go
func handleSearch(w http.ResponseWriter, r *http.Request) {
    keyword := r.URL.Query().Get("keyword")
    if keyword == "" {
        writeError(w, 400, "请输入搜索关键词")
        return
    }
    
    // 查缓存
    cached, err := cache.Get(ctx, key)
    if err == nil && cached != nil {
        writeJSON(w, ApiResponse{Success: true, Data: cached})
        return
    }
    
    // 调 parser
    books, err := parser.Search(ctx, keyword)
    if err != nil {
        writeError(w, 500, "搜索失败")
        return
    }
    
    // 写缓存
    cache.Set(ctx, key, books, 30*time.Minute)  // 写缓存失败不返回 error，降级
    writeJSON(w, ApiResponse{Success: true, Data: books})
}
```

**注意：缓存写入失败不报错** — 和 TS 版行为一致，缓存挂了不影响业务。

---

## 并发请求取消

光遇 API 有 7 个镜像，同时发请求，拿到第一个成功结果后停掉其他的：

```go
ctx, cancel := context.WithCancel(ctx)
defer cancel()  // 函数返回时保证清理

// 每个 goroutine 里：
select {
case resultCh <- result:
    cancel()  // 我成功了，其他都停
case <-ctx.Done():
    return  // 其他 goroutine 成功了，我停
}
```

**漏掉 cancel 不会出 bug**（HTTP 有 timeout），但会浪费连接。

---

## 标准库 HTTP Server

Go 1.22+ 原生路由语法：

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /api/search", handleSearch)
mux.HandleFunc("GET /api/chapters", handleChapters)
mux.HandleFunc("PUT /api/bookshelf/{bookId}/progress", handleProgress)
```

**不要引入 gin/echo/chi**。10 个路由，标准库完全够。

---

## 接口设计（书源）

三个 parser 实现同一个接口。接口只管需要什么方法，不关心具体来源：

- `SearchBooks(ctx, keyword) → []Book, error`
- `GetChapters(ctx, bookID, source, tab) → []Chapter, error`  
- `GetChapterContent(ctx, bookID, itemID, source, tab) → ChapterContent, error`

扩展新书源 = 新建一个 struct 实现这三个方法，其他代码一行不改。

**Go 接口是隐式的**：struct 不需要声明 implements，方法签名对了就自动满足。这是和 TS 最大的区别。

---

## 中间件

不用库，自己写两个包装函数：

1. **JWT 验证**：从 Authorization header 取 token → 解析 → 把用户信息放进 context → 下一个 handler 从 context 取
2. **错误处理**：每个 handler 返回 error，中间件统一 catch，按 error 类型设状态码

**Go 的中间件就是 `func(http.Handler) http.Handler`**，函数包函数，简单。

---

## 依赖库（只这 5 个）

| 库 | 用在哪 | 为什么必须用库 |
|----|-------|--------------|
| pgx | PostgreSQL | SQL 驱动很复杂，自己写不可能 |
| go-redis | Redis | 连接池、重连逻辑已有成熟实现 |
| golang-jwt | JWT | 安全相关，不能自己写 |
| goquery | HTML 解析 | CSS 选择器引擎自己写太痛苦 |
| x/crypto/bcrypt | 密码哈希 | 同上，安全相关 |

**其余全部标准库。**

---

## 配置读取

不用 dotenv 包。Go 标准库的 `os.Getenv` 就够了：

```go
port := os.Getenv("PORT")
if port == "" {
    port = "3001"
}
```

TS 是异步读环境变量，Go 是同步，直接用。

---

## 编码问题（爬虫用）

笔趣阁/七星阁可能是 GBK 编码。TS 里用`iconv-lite`解码。Go 用 `golang.org/x/net/html/charset`，是官方扩展库。

---

## 错误格式统一

TS 版不同接口返回的中文错误信息，Go 版保持一致：

- `"请输入搜索关键词"`
- `"缺少 bookId 参数"`
- `"缺少 bookId 或 itemId 参数"`
- `"用户名或密码错误"`
- `"用户名长度 2-50 个字符"`
- `"密码至少 6 位"`
- `"请先登录"`
- `"今日免费阅读次数已用完（每日3次），请明天再试"`

---

## 代码风格

- **每个文件短**，约 50-100 行
- **handler 一个接口一个文件**（search.go, hot.go, chapters.go, content.go, auth.go, bookshelf.go）
- **不抽象出 service 层** — 600 行的项目不需要三层架构
- **不用泛型炫技** — 只在 `tryAllHosts` 一个地方用泛型，其他地方正常写
- **变量命名短** — 局部变量用 `ctx` 不是 `context`，`w` 不是 `writer`，`r` 不是 `request`（Go 惯例）
- **注释只写"为什么"不写"做什么"** — 代码本身就是"做什么"

---

## 和 TS 版的差异（故意的）

| 点 | TS 版 | Go 版 | 原因 |
|----|-------|-------|------|
| cached() 抽象 | 高阶函数套娃 | 每个 handler 直接写缓存逻辑 | Go 直接写更清晰，不用套娃 |
| tryAllHosts | Promise.any | goroutine + channel | Go 原生的并发方式 |
| 错误处理 | throw/catch | error 返回值 | Go 的哲学 |
| 接口实现 | class implements | 隐式实现 | Go 的接口是隐式的 |
| ORM | 裸 SQL (pg) | 裸 SQL (pgx) | 保持一致 |

---

## 最终检查清单

写完代码后逐条检查：

- [ ] `curl localhost:3001/api/search?keyword=斗罗` 返回格式和 TS 版一致
- [ ] 所有 json tag 正确（snake_case）
- [ ] `{ success: true, data: ... }` 和 `{ success: false, error: ... }` 格式统一
- [ ] 缓存未命中不影响业务
- [ ] 编码（GBK → UTF-8）正确
- [ ] 广告过滤规则和 TS 版一致
- [ ] JWT 过期时间 7 天
- [ ] 注册验证规则一致（用户名 2-50 字符，密码 6 位以上）
- [ ] 多镜像并发请求，成功后取消其他
- [ ] 无未使用的 import
- [ ] `go build` 零 warning
