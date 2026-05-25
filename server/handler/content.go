package handler

import (
	"net/http"
	"time"

	"github.com/hinder110/yueduqi-go/server/model"
)

func (s *Server) HandleContent(w http.ResponseWriter, r *http.Request) {
	bookID := query(r, "bookId", "")
	itemID := query(r, "itemId", "")
	if bookID == "" || itemID == "" {
		writeErr(w, 400, "缺少 bookId 或 itemId 参数")
		return
	}
	source := query(r, "source", "guangyu")
	innerSource := query(r, "innerSource", "番茄")
	innerTab := query(r, "innerTab", "小说")
	p := ParserForSource(source)

	cacheKey := "content:" + source + ":" + bookID + ":" + itemID + ":" + innerSource + ":" + innerTab
	cacheOrFetch(s, w, r, cacheKey, 24*time.Hour, "获取正文失败", func() (model.ChapterContent, error) {
		return p.GetChapterContent(r.Context(), bookID, itemID, innerSource, innerTab)
	})
}
