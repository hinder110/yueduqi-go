package handler

import (
	"net/http"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/model"
)

func (s *Server) HandleSearch(w http.ResponseWriter, r *http.Request) {
	keyword := query(r, "keyword", "")
	if keyword == "" {
		writeErr(w, 400, "请输入搜索关键词")
		return
	}
	source := query(r, "source", "guangyu")
	p := ParserForSource(source)

	cacheKey := "search:" + source + ":" + keyword
	cacheOrFetch(s, w, r, cacheKey, cache.SearchTTL, "搜索失败", func() ([]model.Book, error) {
		return p.SearchBooks(r.Context(), keyword)
	})
}
