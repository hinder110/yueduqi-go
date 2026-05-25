package main

import (
	"context"
	"log"
	"net/http"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/config"
	"github.com/hinder110/yueduqi-go/server/db"
	"github.com/hinder110/yueduqi-go/server/handler"
	"github.com/hinder110/yueduqi-go/server/middleware"
)

func main() {
	ctx := context.Background()

	if err := db.Connect(ctx); err != nil {
		log.Printf("db connect failed: %v (continuing without db)", err)
	} else {
		db.Migrate(ctx)
	}

	redisAddr := config.RedisHost + ":" + config.RedisPort
	s := &handler.Server{
		Cache: cache.New(redisAddr),
	}

	mux := http.NewServeMux()

	// 只读接口
	mux.HandleFunc("GET /api/search", s.HandleSearch)
	mux.HandleFunc("GET /api/hot", s.HandleHot)
	mux.HandleFunc("GET /api/chapters", s.HandleChapters)
	mux.HandleFunc("GET /api/content", s.HandleContent)

	// 用户系统
	mux.HandleFunc("POST /api/auth/register", handler.HandleRegister)
	mux.HandleFunc("POST /api/auth/login", handler.HandleLogin)

	// 书架（需登录）
	mux.HandleFunc("GET /api/bookshelf", middleware.Auth(handler.HandleBookshelfList))
	mux.HandleFunc("POST /api/bookshelf", middleware.Auth(handler.HandleBookshelfAdd))
	mux.HandleFunc("DELETE /api/bookshelf/{id}", middleware.Auth(handler.HandleBookshelfDelete))
	mux.HandleFunc("PUT /api/bookshelf/{id}/progress", middleware.Auth(handler.HandleProgressUpdate))

	log.Printf("Server running at http://localhost:%s", config.Port)
	log.Fatal(http.ListenAndServe(":"+config.Port, mux))
}
