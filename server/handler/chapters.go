package handler

import (
	"net/http"

	"github.com/hinder110/yueduqi-go/server/cache"
	"github.com/hinder110/yueduqi-go/server/model"
)

func (s *Server) HandleChapters(w http.ResponseWriter, r *http.Request) {
	bookID := query(r, "bookId", "")
	if bookID == "" {
		writeErr(w, 400, "缺少 bookId 参数")
		return
	}
	source := query(r, "source", "guangyu")
	innerSource := query(r, "innerSource", "番茄")
	innerTab := query(r, "innerTab", "小说")
	p := ParserForSource(source)

	cacheKey := "chapters:" + source + ":" + bookID + ":" + innerSource + ":" + innerTab
	cacheOrFetch(s, w, r, cacheKey, cache.ChaptersTTL, "获取章节失败", func() ([]model.Chapter, error) {
		return p.GetChapters(r.Context(), bookID, innerSource, innerTab)
	})
}
