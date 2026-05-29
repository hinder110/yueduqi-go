import { request } from './client';
import type { ApiResponse, Book } from '../types';

const DEFAULT_SOURCE = 'guangyu';

export async function fetchSearch(keyword: string, sourceKey: string = DEFAULT_SOURCE): Promise<ApiResponse<Book[]>> {
  return request<Book[]>(`/search?keyword=${encodeURIComponent(keyword)}&source=${sourceKey}`);
}

export async function fetchHotBooks(): Promise<ApiResponse<Book[]>> {
  return request<Book[]>('/hot');
}
