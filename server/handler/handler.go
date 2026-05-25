package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/model"
)

type Server struct {
	Cache  *cache.Cache
	Parser Parser
}

type Parser interface {
	SearchBooks(ctx context.Context, keyword string) ([]model.Book, error)
	GetChapters(ctx context.Context, bookID, innerSource, innerTab string) ([]model.Chapter, error)
	GetChapterContent(ctx context.Context, bookID, itemID, innerSource, innerTab string) (model.ChapterContent, error)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeOK(w http.ResponseWriter, data any) {
	writeJSON(w, 200, model.APIResponse{Success: true, Data: data})
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, model.APIResponse{Success: false, Error: msg})
}

func query(r *http.Request, key, fallback string) string {
	v := r.URL.Query().Get(key)
	if v == "" {
		return fallback
	}
	return v
}

func cacheOrFetch[T any](s *Server, w http.ResponseWriter, r *http.Request, key string, ttl time.Duration, errMsg string, fetch func() (T, error)) {
	ctx := r.Context()

	var cached T
	if s.Cache.Get(ctx, key, &cached) {
		writeOK(w, cached)
		return
	}

	data, err := fetch()
	if err != nil {
		log.Printf("[%s] %v", key, err)
		writeErr(w, 500, errMsg)
		return
	}

	s.Cache.Set(ctx, key, data, ttl)
	writeOK(w, data)
}
