import type { Book, Chapter, ChapterContent } from '../types';

// 光遇 API 解析器
import { searchBooks as guangyuSearch, getChapters as guangyuChapters, getChapterContent as guangyuContent } from '../bookParser';
// 笔趣阁 HTML 解析器
import { searchBooks as biqugeSearch, getChapters as biqugeChapters, getChapterContent as biqugeContent } from './biqugeParser';
// 七星阁 HTML 解析器
import { searchBooks as qixingeSearch, getChapters as qixingeChapters, getChapterContent as qixingeContent } from './qixingeParser';

export const SOURCES = [
  { key: 'guangyu', name: '番茄小说 (光遇API)' },
  { key: 'biquge900', name: '笔趣阁900' },
  { key: 'qixinge', name: '七星阁小说网' },
] as const;

export type SourceKey = (typeof SOURCES)[number]['key'];

interface SearchOptions {
  source: SourceKey;
  keyword: string;
  /** 光遇用：source + tab */
  innerSource?: string;
  innerTab?: string;
}

interface ChaptersOptions {
  source: SourceKey;
  /** 光遇: bookId; 笔趣阁: bookUrl */
  bookId: string;
  innerSource?: string;
  innerTab?: string;
}

interface ContentOptions {
  source: SourceKey;
  /** 光遇: bookId; 笔趣阁: chapterUrl */
  bookId: string;
  /** 光遇: itemId; 笔趣阁: chapterUrl */
  itemId: string;
  innerSource?: string;
  innerTab?: string;
}

export async function searchBooks(opts: SearchOptions): Promise<Book[]> {
  if (opts.source === 'biquge900') {
    const [biqugeBooks, guangyuBooks] = await Promise.all([
      biqugeSearch(opts.keyword),
      guangyuSearch(opts.keyword).catch(() => [] as Book[]),
    ]);
    return mergeCovers(biqugeBooks, guangyuBooks);
  }
  if (opts.source === 'qixinge') {
    return qixingeSearch(opts.keyword);
  }
  return guangyuSearch(opts.keyword);
}

/** 把光遇搜索结果的封面和简介按书名模糊匹配，合并到笔趣阁结果中 */
export function mergeCovers(target: Book[], supplement: Book[]): Book[] {
  if (supplement.length === 0) return target;
  return target.map((book) => {
    const match = supplement.find((s) => fuzzyMatch(book.title, s.title));
    if (match) {
      return { ...book, cover: book.cover || match.cover, intro: book.intro || match.intro };
    }
    return book;
  });
}

export function fuzzyMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function normalizeName(s: string): string {
  return s
    .replace(/[（(].*?[）)]/g, '')  // 去掉括号内容
    .replace(/[^一-龥a-zA-Z0-9]/g, '')  // 只保留中英文字母数字
    .toLowerCase();
}

export async function getChapters(opts: ChaptersOptions): Promise<Chapter[]> {
  if (opts.source === 'biquge900') return biqugeChapters(opts.bookId);
  if (opts.source === 'qixinge') return qixingeChapters(opts.bookId);
  return guangyuChapters(opts.bookId, opts.innerSource ?? '番茄', opts.innerTab ?? '小说');
}

export async function getChapterContent(opts: ContentOptions): Promise<ChapterContent> {
  if (opts.source === 'biquge900') return biqugeContent(opts.itemId);
  if (opts.source === 'qixinge') return qixingeContent(opts.itemId);
  return guangyuContent(opts.bookId, opts.itemId, opts.innerSource ?? '番茄', opts.innerTab ?? '小说');
}
