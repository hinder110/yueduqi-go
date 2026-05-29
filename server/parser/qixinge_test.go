package parser

import (
	"testing"
)

func TestParseQixingeSearchHTML(t *testing.T) {
	html := readFixture(t, "qixinge_search.html")
	books, err := ParseQixingeSearchHTML(html)
	if err != nil {
		t.Fatalf("ParseQixingeSearchHTML error: %v", err)
	}
	if len(books) == 0 {
		t.Fatal("expected at least 1 book")
	}
	if books[0].Title != "测试书名" {
		t.Errorf("expected title '测试书名', got %q", books[0].Title)
	}
	if books[0].Author != "作者名" {
		t.Errorf("expected author '作者名', got %q", books[0].Author)
	}
}
