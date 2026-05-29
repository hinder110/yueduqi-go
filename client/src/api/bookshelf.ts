import { authRequest } from './client';
import type { ApiResponse, BookshelfItem } from '../types';

export async function addToBookshelf(book: {
  title: string;
  author?: string;
  cover?: string;
  intro?: string;
  bookId: string;
  sourceKey: string;
}): Promise<ApiResponse<{ message: string }>> {
  return authRequest('/bookshelf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(book),
  });
}

export async function fetchBookshelf(): Promise<ApiResponse<BookshelfItem[]>> {
  return authRequest<BookshelfItem[]>('/bookshelf');
}

export async function removeFromBookshelf(bookId: number): Promise<ApiResponse<{ message: string }>> {
  return authRequest(`/bookshelf/${bookId}`, { method: 'DELETE' });
}

export async function updateProgress(
  bookId: number,
  chapterIndex: number,
  chapterItemId: string,
): Promise<ApiResponse<{ message: string }>> {
  return authRequest(`/bookshelf/${bookId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapterIndex, chapterItemId }),
  });
}
