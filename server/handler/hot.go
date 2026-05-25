package handler

import (
	"net/http"
	"time"

	"github.com/hinder110/yueduqi-go/server/model"
	"github.com/hinder110/yueduqi-go/server/parser"
)

func (s *Server) HandleHot(w http.ResponseWriter, r *http.Request) {
	cacheOrFetch(s, w, r, "hot", 30*time.Minute, "获取热门推荐失败", func() ([]model.Book, error) {
		return parser.GetHotBooks(r.Context())
	})
}
