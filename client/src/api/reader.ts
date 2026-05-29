import { request } from './client';
import type { ApiResponse, Chapter, ChapterContent } from '../types';

const DEFAULT_SOURCE = 'guangyu';

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
