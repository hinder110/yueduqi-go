import type { ApiResponse, Book, Chapter, ChapterContent, LoginData, BookshelfItem } from './types';

const BASE = '/api';
const DEFAULT_SOURCE = 'guangyu';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { success: false, error: err.error ?? `请求失败 (${res.status})` };
    }
    return res.json();
  } catch {
    return { success: false, error: '网络连接失败，请确认后端服务已启动' };
  }
}

async function authRequest<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  return request<T>(path, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// --- 搜索/阅读 ---

export async function fetchSearch(keyword: string, sourceKey: string = DEFAULT_SOURCE): Promise<ApiResponse<Book[]>> {
  return request<Book[]>(`/search?keyword=${encodeURIComponent(keyword)}&source=${sourceKey}`);
}

export async function fetchHotBooks(): Promise<ApiResponse<Book[]>> {
  return request<Book[]>('/hot');
}

export async function fetchChapters(
  bookId: string,
  sourceKey: string = DEFAULT_SOURCE,
  innerSource: string = '番茄',
  innerTab: string = '小说'
): Promise<ApiResponse<Chapter[]>> {
  const params = new URLSearchParams({ bookId, source: sourceKey, innerSource, innerTab });
  return request<Chapter[]>(`/chapters?${params}`);
}

export async function fetchContent(
  bookId: string,
  itemId: string,
  sourceKey: string = DEFAULT_SOURCE,
  innerSource: string = '番茄',
  innerTab: string = '小说'
): Promise<ApiResponse<ChapterContent>> {
  const params = new URLSearchParams({ bookId, itemId, source: sourceKey, innerSource, innerTab });
  return request<ChapterContent>(`/content?${params}`);
}

// --- 认证 ---

export async function login(username: string, password: string): Promise<ApiResponse<LoginData>> {
  return request<LoginData>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function register(username: string, password: string): Promise<ApiResponse<{ id: string; username: string; created_at: string }>> {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

// --- 书架 ---

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
