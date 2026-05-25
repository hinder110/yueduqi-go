import { invoke } from '@tauri-apps/api/core';
import type { Book, Chapter, ChapterContent, SourceInfo, HistoryEntry, SearchResult } from './types';

export async function searchBooks(keyword: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('search_books', { keyword });
}

export async function getChapters(bookId: string, sourceKey: string): Promise<Chapter[]> {
  return invoke<Chapter[]>('get_chapters', { bookId, sourceKey });
}

export async function getContent(
  bookId: string,
  itemId: string,
  sourceKey: string
): Promise<ChapterContent> {
  return invoke<ChapterContent>('get_content', { bookId, itemId, sourceKey });
}

export async function getSources(): Promise<SourceInfo[]> {
  return invoke<SourceInfo[]>('get_sources');
}

export async function toggleSource(key: string, enabled: boolean): Promise<void> {
  return invoke('toggle_source', { key, enabled });
}

export async function addToBookshelf(book: Book): Promise<void> {
  return invoke('add_to_bookshelf', { book });
}

export async function removeFromBookshelf(bookId: string): Promise<void> {
  return invoke('remove_from_bookshelf', { bookId });
}

export async function getBookshelf(): Promise<Book[]> {
  return invoke<Book[]>('get_bookshelf');
}

export async function addHistory(bookId: string, chapterTitle: string): Promise<void> {
  return invoke('add_history', { bookId, chapterTitle });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>('get_history');
}
