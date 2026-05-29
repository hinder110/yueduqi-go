# yueduqi-go Architecture Upgrade — Implementation Plan

> **For subagent workers:** Implement exactly what the plan specifies. TDD where tests apply. Verify with `go build` and `tsc --noEmit`.

**Goal:** Parser registry + health system + parser tests + frontend api split + ReaderSettingsContext

**Architecture:** Two independent agents — Agent 1 (server/) and Agent 2 (client/). No shared files.

---

## Agent 1: Backend (Parser Registry + Cache TTL + Health + Tests)

### Step 1: Create cache/ttl.go

`server/cache/ttl.go`:
```go
package cache

import "time"

const (
	SearchTTL   = 30 * time.Minute
	ChaptersTTL = 1 * time.Hour
	ContentTTL  = 24 * time.Hour
	HotTTL      = 30 * time.Minute
)
```

### Step 2: Create parser/registry.go

`server/parser/registry.go`:
```go
package parser

var registry = map[string]Parser{}

func Register(name string, p Parser) { registry[name] = p }
func Get(name string) Parser          { return registry[name] }
```

### Step 3: Clean parser.go (delete ForSource)

Keep only the `Parser` interface. Remove `ForSource` function (lines 15-24).

### Step 4: Add init() to biquge.go, guangyu.go, qixinge.go

In each parser file, add at top:
```go
func init() { Register("sourcekey", &ParserStruct{}) }
```

- biquge: `Register("biquge900", &BiqugeParser{})`
- guangyu: `Register("guangyu", &GuangyuParser{})`
- qixinge: `Register("qixinge", &QixingeParser{})`

### Step 5: Fix handler.go — delete duplicate Parser interface

Change `handler/handler.go`:
- Delete `type Parser interface { ... }` (lines 19-23)
- Change `Parser Parser` to `Parser parser.Parser`
- Add `parser` import, remove unused `context` import

### Step 6: Fix handler/source.go

```go
func ParserForSource(source string) parser.Parser {
    return parser.Get(source)
}
```

### Step 7: Update handler TTLs to use cache constants

In `search.go`: `30*time.Minute` → `cache.SearchTTL`
In `chapters.go`: `time.Hour` → `cache.ChaptersTTL`
In `content.go`: `24*time.Hour` → `cache.ContentTTL`
In `hot.go`: `30*time.Minute` → `cache.HotTTL`

Add `"github.com/hinder110/yueduqi-go/server/cache"` import where missing. Remove unused `"time"` import where no longer needed.

### Step 8: Create handler/health.go

```go
package handler

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/hinder110/yueduqi-go/server/parser"
)

type SourceStatus string

const (
	StatusHealthy  SourceStatus = "healthy"
	StatusDegraded SourceStatus = "degraded"
	StatusDown     SourceStatus = "down"
)

type SourceEntry struct {
	Status        SourceStatus `json:"status"`
	LastSuccessAt time.Time    `json:"lastSuccessAt"`
	LastError     string       `json:"lastError,omitempty"`
	FailCount     int          `json:"failCount"`
	AvgLatency    int64        `json:"avgLatencyMs"`
}

type SourceHealth struct {
	mu       sync.RWMutex
	entries  map[string]*SourceEntry
	sources  []string
	parserFn func(string) parser.Parser
}

func NewSourceHealth(sources []string, parserFn func(string) parser.Parser) *SourceHealth {
	h := &SourceHealth{
		entries:  make(map[string]*SourceEntry),
		sources:  sources,
		parserFn: parserFn,
	}
	for _, s := range sources {
		h.entries[s] = &SourceEntry{Status: StatusHealthy}
	}
	return h
}

func (h *SourceHealth) Record(name string, success bool, latency time.Duration, err string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	e := h.entries[name]
	if e == nil { return }
	if success {
		e.Status = StatusHealthy
		e.LastSuccessAt = time.Now()
		e.LastError = ""
		e.FailCount = 0
	} else {
		e.FailCount++
		e.LastError = err
		if e.FailCount >= 3 { e.Status = StatusDown } else { e.Status = StatusDegraded }
	}
	e.AvgLatency = latency.Milliseconds()
}

func (h *SourceHealth) Get(name string) *SourceEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()
	e := h.entries[name]
	if e == nil { return &SourceEntry{Status: StatusDown} }
	cp := *e
	return &cp
}

func (h *SourceHealth) ProbeOnce(ctx context.Context, name string) {
	start := time.Now()
	p := h.parserFn(name)
	if p == nil { h.Record(name, false, time.Since(start), "parser not found"); return }
	_, err := p.SearchBooks(ctx, "测试")
	if err != nil { h.Record(name, false, time.Since(start), err.Error()) } else { h.Record(name, true, time.Since(start), "") }
}

func (h *SourceHealth) ProbeAll(ctx context.Context) {
	for _, name := range h.sources { h.ProbeOnce(ctx, name) }
}

func (h *SourceHealth) ProbeLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done(): return
		case <-ticker.C: h.ProbeAll(ctx)
		}
	}
}

func (s *Server) HandleSourceStatus(w http.ResponseWriter, r *http.Request) {
	statuses := make(map[string]*SourceEntry)
	for _, name := range s.Health.sources { statuses[name] = s.Health.Get(name) }
	writeOK(w, statuses)
}
```

### Step 9: Add Health to Server struct

In `handler/handler.go` Server struct, add:
```go
Health *SourceHealth
```

### Step 10: Update main.go

- Add imports: `"time"`, `"github.com/hinder110/yueduqi-go/server/parser"`
- Before `s := &handler.Server{`:
```go
sourceNames := []string{"guangyu", "biquge900", "qixinge"}
health := handler.NewSourceHealth(sourceNames, parser.Get)
```
- Add `Health: health,` to Server literal
- After Server creation:
```go
go health.ProbeLoop(ctx, 15*time.Minute)
go func() { health.ProbeAll(ctx) }()
```
- Add route: `mux.HandleFunc("GET /api/sources/status", s.HandleSourceStatus)`

### Step 11: Extract parser HTML parsing functions (biquge.go)

Add `ParseSearchHTML(html string) ([]model.Book, error)` and `ParseBiqugeChapters(html string) ([]model.Chapter, error)` by extracting the goquery logic from SearchBooks/GetChapters.

Refactor SearchBooks to:
1. Make HTTP request
2. Read body: `html, _ := io.ReadAll(utf8Reader(resp.Body))`
3. Return `ParseSearchHTML(string(html))`

Similarly for GetChapters, delegate to `ParseBiqugeChapters`.

### Step 12: Extract parser HTML parsing functions (qixinge.go)

Same pattern: extract `ParseQixingeSearchHTML` and `ParseQixingeChaptersHTML`, add `"io"` import, refactor methods to delegate.

### Step 13: Create test fixtures

`parser/testdata/biquge_search.html`:
```html
<div class="hot_sale"><a href="/book/123/"><span class="title">测试书名</span><span class="author">测试作者</span><span class="review">玄幻</span></a></div>
```

`parser/testdata/biquge_chapter.html`:
```html
<div class="directoryArea"><p><a href="/chapter/123/1.html">第一章 开始</a></p><p><a href="/chapter/123/2.html">第二章 发展</a></p></div>
```

`parser/testdata/qixinge_search.html`:
```html
<div class="col-md-6"><dl><dt><img src="/cover/1.jpg"></dt><h3><a href="/book/1/">测试书名免费阅读小说</a></h3><div class="book_other"><span>作者名</span></div><div class="book_other">玄幻</div><div class="book_other"><a>第100章 结局</a></div></dl></div>
```

### Step 14: Write parser tests

`parser/biquge_test.go`: test ParseSearchHTML and ParseBiqugeChapters with fixtures.
`parser/qixinge_test.go`: test ParseQixingeSearchHTML with fixture. Share `readFixture` helper.

### Step 15: Verify

```bash
cd server && go build ./... && go test ./parser/... -v
```

---

## Agent 2: Frontend (api split + hooks + ReaderSettingsContext)

### Step 1: Run `npm install`

```bash
cd /home/hinder/git_code/yueduqi-go/client && npm install
```

### Step 2: Create api/client.ts

```ts
import type { ApiResponse } from '../types';
const BASE = '/api';

function getToken(): string | null { return localStorage.getItem('token'); }

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { success: false, error: err.error ?? `请求失败 (${res.status})` };
    }
    return res.json();
  } catch { return { success: false, error: '网络连接失败，请确认后端服务已启动' }; }
}

async function authRequest<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  return request<T>(path, { ...options, headers: { ...options?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

export { request, authRequest };
```

### Step 3: Create api/auth.ts, bookshelf.ts, search.ts, reader.ts

Exact same function signatures and exports as current `api.ts` (don't change API behavior), just split into modules. Each file imports `{request, authRequest}` from `./client`.

### Step 4: Delete api.ts

### Step 5: Update all imports in pages and contexts

- `AuthContext.tsx` → `'../api/auth'`
- `SearchPage.tsx` → `'../api/search'`
- `ChaptersPage.tsx` → `'../api/reader'` + `'../api/bookshelf'`
- `ReaderPage.tsx` → `'../api/reader'` + `'../api/bookshelf'`
- `BookshelfPage.tsx` → `'../api/bookshelf'`
- `AuthContext.test.tsx` → update mock import
- `LoginPage.tsx` → check if needs update

### Step 6: Create contexts/ReaderSettingsContext.tsx

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
type FontSize = 'sm' | 'md' | 'lg';
type PageMode = 'scroll' | 'pagination';

interface ReaderSettings {
  fontSize: FontSize;
  theme: Theme;
  pageMode: PageMode;
}

interface ReaderSettingsState extends ReaderSettings {
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  cycleFontSize: () => void;
}

const FONT_NEXT: Record<FontSize, FontSize> = { sm: 'md', md: 'lg', lg: 'sm' };
const defaults: ReaderSettings = { fontSize: 'md', theme: 'light', pageMode: 'scroll' };

function loadSettings(): ReaderSettings {
  try { const raw = localStorage.getItem('readerSettings'); if (raw) return { ...defaults, ...JSON.parse(raw) }; } catch {}
  return defaults;
}

function saveSettings(s: ReaderSettings) { localStorage.setItem('readerSettings', JSON.stringify(s)); }

const ReaderSettingsContext = createContext<ReaderSettingsState | null>(null);

export function ReaderSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  useEffect(() => { saveSettings(settings); }, [settings]);
  const setFontSize = useCallback((fontSize: FontSize) => setSettings(prev => ({ ...prev, fontSize })), []);
  const setTheme = useCallback((theme: Theme) => setSettings(prev => ({ ...prev, theme })), []);
  const toggleTheme = useCallback(() => setSettings(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' })), []);
  const cycleFontSize = useCallback(() => setSettings(prev => ({ ...prev, fontSize: FONT_NEXT[prev.fontSize] })), []);

  return (
    <ReaderSettingsContext.Provider value={{ ...settings, setFontSize, setTheme, toggleTheme, cycleFontSize }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  const ctx = useContext(ReaderSettingsContext);
  if (!ctx) throw new Error('useReaderSettings must be inside ReaderSettingsProvider');
  return ctx;
}
```

### Step 7: Update App.tsx

- Import `ReaderSettingsProvider`
- Wrap `<Routes>` in `<ReaderSettingsProvider>`

### Step 8: Update ReaderPage.tsx

- Import `useReaderSettings` from `'../contexts/ReaderSettingsContext'`
- Remove local `theme`/`fontSize` useState and type decls
- Use: `const { fontSize, theme, cycleFontSize, toggleTheme } = useReaderSettings()`
- Replace button onClick handlers

### Step 9: Verify

```bash
cd /home/hinder/git_code/yueduqi-go/client && npx tsc --noEmit
```
