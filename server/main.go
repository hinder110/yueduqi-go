package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/config"
	"github.com/hinder110/yueduqi-go/server/db"
	"github.com/hinder110/yueduqi-go/server/handler"
	"github.com/hinder110/yueduqi-go/server/middleware"
	"github.com/hinder110/yueduqi-go/server/parser"
)

func main() {
	ctx := context.Background()

	if err := db.Connect(ctx); err != nil {
		log.Printf("db connect failed: %v (continuing without db)", err)
	} else {
		db.Migrate(ctx)
	}

	redisAddr := config.RedisHost + ":" + config.RedisPort
	sourceNames := []string{"guangyu", "biquge900", "qixinge"}
	health := handler.NewSourceHealth(sourceNames, parser.Get)
	s := &handler.Server{
		Cache:  cache.New(redisAddr),
		Health: health,
	}

	go health.ProbeLoop(ctx, 15*time.Minute)
	go func() { health.ProbeAll(ctx) }()

	mux := http.NewServeMux()

	// 只读接口
	mux.HandleFunc("GET /api/search", s.HandleSearch)
	mux.HandleFunc("GET /api/hot", s.HandleHot)
	mux.HandleFunc("GET /api/chapters", s.HandleChapters)
	mux.HandleFunc("GET /api/content", s.HandleContent)
	mux.HandleFunc("GET /api/sources/status", s.HandleSourceStatus)

	// 用户系统
	mux.HandleFunc("POST /api/auth/register", handler.HandleRegister)
	mux.HandleFunc("POST /api/auth/login", handler.HandleLogin)

	// 书架（需登录）
	mux.HandleFunc("GET /api/bookshelf", middleware.Auth(handler.HandleBookshelfList))
	mux.HandleFunc("POST /api/bookshelf", middleware.Auth(handler.HandleBookshelfAdd))
	mux.HandleFunc("DELETE /api/bookshelf/{id}", middleware.Auth(handler.HandleBookshelfDelete))
	mux.HandleFunc("PUT /api/bookshelf/{id}/progress", middleware.Auth(handler.HandleProgressUpdate))

	// 静态前端 + SPA fallback（最后注册，优先级低于 api/*）
	clientDist := filepath.Join("..", "client", "dist")
	if _, err := os.Stat(clientDist); err == nil {
		fs := http.FileServer(http.Dir(clientDist))
		mux.HandleFunc("GET /{path...}", func(w http.ResponseWriter, r *http.Request) {
			checkPath := r.URL.Path
			if checkPath == "" || checkPath == "/" {
				checkPath = "/index.html"
			}
			fp := filepath.Join(clientDist, checkPath)
			if _, err := os.Stat(fp); os.IsNotExist(err) {
				http.ServeFile(w, r, filepath.Join(clientDist, "index.html"))
				return
			}
			fs.ServeHTTP(w, r)
		})
		log.Println("static: serving client/dist")
	}

	log.Printf("Server running at http://localhost:%s", config.Port)
	log.Fatal(http.ListenAndServe(":"+config.Port, mux))
}
