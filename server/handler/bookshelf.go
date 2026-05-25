package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/hinder110/yueduqi-go/server/db"
	"github.com/hinder110/yueduqi-go/server/middleware"
)

type bookBody struct {
	Title     string `json:"title"`
	Author    string `json:"author"`
	Cover     string `json:"cover"`
	Intro     string `json:"intro"`
	BookID    string `json:"bookId"`
	SourceKey string `json:"sourceKey"`
}

type progressBody struct {
	ChapterIndex   int    `json:"chapterIndex"`
	ChapterItemID  string `json:"chapterItemId"`
}

func HandleBookshelfAdd(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var b bookBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Title == "" || b.BookID == "" || b.SourceKey == "" {
		writeErr(w, 400, "缺少必要字段: title, bookId, sourceKey")
		return
	}

	rowID, err := upsertBook(r, b)
	if err != nil || rowID == 0 {
		writeErr(w, 500, "书籍缓存失败")
		return
	}

	_, err = db.Pool.Exec(r.Context(),
		`INSERT INTO bookshelf (user_id, book_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, rowID,
	)
	if err != nil {
		writeErr(w, 500, "加入书架失败")
		return
	}
	writeOK(w, map[string]string{"message": "已加入书架"})
}

func HandleBookshelfList(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	rows, err := db.Pool.Query(r.Context(),
		`SELECT b.id, b.title, b.author, b.cover, b.intro, b.book_id AS "bookId",
		        b.source_key AS "sourceKey", s.added_at AS "addedAt",
		        COALESCE(rp.chapter_index, 0) AS "chapterIndex",
		        rp.chapter_item_id AS "chapterItemId"
		 FROM bookshelf s
		 JOIN books b ON b.id = s.book_id
		 LEFT JOIN reading_progress rp ON rp.user_id = s.user_id AND rp.book_id = s.book_id
		 WHERE s.user_id = $1
		 ORDER BY s.added_at DESC`, userID,
	)
	if err != nil {
		writeErr(w, 500, "获取书架失败")
		return
	}
	defer rows.Close()

	var items []map[string]any
	for rows.Next() {
		item := make(map[string]any)
		var id int
		var title, author, cover, intro, bookID, sourceKey, addedAt, chapterItemID string
		var chapterIndex int
		rows.Scan(&id, &title, &author, &cover, &intro, &bookID, &sourceKey, &addedAt, &chapterIndex, &chapterItemID)
		item["id"] = id
		item["title"] = title
		item["author"] = author
		item["cover"] = cover
		item["intro"] = intro
		item["bookId"] = bookID
		item["sourceKey"] = sourceKey
		item["addedAt"] = addedAt
		item["chapterIndex"] = chapterIndex
		item["chapterItemId"] = chapterItemID
		items = append(items, item)
	}
	if items == nil {
		items = []map[string]any{}
	}
	writeOK(w, items)
}

func HandleBookshelfDelete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	bookID := pathLast(r.URL.Path)

	id, _ := strconv.Atoi(bookID)
	db.Pool.Exec(r.Context(), `DELETE FROM bookshelf WHERE user_id = $1 AND book_id = $2`, userID, id)
	writeOK(w, map[string]string{"message": "已移出书架"})
}

func HandleProgressUpdate(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	bookID := pathPart(r.URL.Path)

	id, _ := strconv.Atoi(bookID)
	var p progressBody
	json.NewDecoder(r.Body).Decode(&p)

	db.Pool.Exec(r.Context(),
		`INSERT INTO reading_progress (user_id, book_id, chapter_index, chapter_item_id)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, book_id)
		 DO UPDATE SET chapter_index = $3, chapter_item_id = $4, updated_at = now()`,
		userID, id, p.ChapterIndex, p.ChapterItemID,
	)
	writeOK(w, map[string]string{"message": "进度已更新"})
}

func upsertBook(r *http.Request, b bookBody) (int, error) {
	var id int
	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO books (title, author, cover, intro, book_id, source_key)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT DO NOTHING
		 RETURNING id`,
		b.Title, b.Author, b.Cover, b.Intro, b.BookID, b.SourceKey,
	).Scan(&id)
	if err == nil {
		return id, nil
	}

	err = db.Pool.QueryRow(r.Context(),
		`SELECT id FROM books WHERE book_id = $1 AND source_key = $2`, b.BookID, b.SourceKey,
	).Scan(&id)
	return id, err
}

func pathLast(p string) string {
	parts := strings.Split(strings.TrimRight(p, "/"), "/")
	return parts[len(parts)-1]
}

func pathPart(p string) string {
	// "/api/bookshelf/123/progress" → "123"
	trimmed := strings.TrimRight(p, "/")
	trimmed = strings.TrimPrefix(trimmed, "/api/bookshelf/")
	trimmed = strings.TrimSuffix(trimmed, "/progress")
	return trimmed
}
