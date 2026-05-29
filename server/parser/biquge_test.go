package parser

import (
	"os"
	"path/filepath"
	"testing"
)

func readFixture(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return string(data)
}

func TestParseBiqugeSearchHTML(t *testing.T) {
	html := readFixture(t, "biquge_search.html")
	books, err := ParseSearchHTML(html)
	if err != nil {
		t.Fatalf("ParseSearchHTML error: %v", err)
	}
	if len(books) == 0 {
		t.Fatal("expected at least 1 book")
	}
	if books[0].Title != "测试书名" {
		t.Errorf("expected title '测试书名', got %q", books[0].Title)
	}
	if books[0].Author != "测试作者" {
		t.Errorf("expected author '测试作者', got %q", books[0].Author)
	}
}

func TestParseBiqugeChapters(t *testing.T) {
	html := readFixture(t, "biquge_chapter.html")
	chapters, err := ParseBiqugeChapters(html)
	if err != nil {
		t.Fatalf("ParseBiqugeChapters error: %v", err)
	}
	if len(chapters) < 2 {
		t.Fatal("expected at least 2 chapters")
	}
	if chapters[0].Title != "第一章 开始" {
		t.Errorf("expected '第一章 开始', got %q", chapters[0].Title)
	}
}
