export interface Book {
  title: string;
  author: string;
  cover: string;
  intro: string;
  kind: string;
  last_chapter: string;
  word_count: string;
  book_id: string;
  source_key: string;
  source: string;
  tab: string;
}

export interface Chapter {
  title: string;
  item_id: string;
}

export interface ChapterContent {
  title: string;
  content: string;
}

export interface SearchResult {
  books: Book[];
  source: string;
  error: string;
}

export interface SourceInfo {
  key: string;
  name: string;
  group: string;
  enabled: boolean;
}

export interface HistoryEntry {
  book_id: string;
  book_title: string;
  chapter_title: string;
  updated_at: string;
}
