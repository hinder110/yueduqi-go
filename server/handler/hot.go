package handler

import (
	"net/http"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/model"
	"github.com/hinder110/yueduqi-go/server/parser"
)

func (s *Server) HandleHot(w http.ResponseWriter, r *http.Request) {
	cacheOrFetch(s, w, r, "hot", cache.HotTTL, "获取热门推荐失败", func() ([]model.Book, error) {
		return parser.GetHotBooks(r.Context())
	})
}
