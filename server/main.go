package main

import (
	"log"
	"net/http"
	"os"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/handler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	redisAddr := os.Getenv("REDIS_HOST") + ":" + os.Getenv("REDIS_PORT")
	if redisAddr == ":" {
		redisAddr = "localhost:6379"
	}

	s := &handler.Server{
		Cache: cache.New(redisAddr),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/search", s.HandleSearch)
	mux.HandleFunc("GET /api/hot", s.HandleHot)
	mux.HandleFunc("GET /api/chapters", s.HandleChapters)
	mux.HandleFunc("GET /api/content", s.HandleContent)

	log.Printf("Server running at http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
