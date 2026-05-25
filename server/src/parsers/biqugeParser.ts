import iconv from 'iconv-lite';
import type { Book, Chapter, ChapterContent } from '../types';
import { toAbsUrl, fetchHTML } from '../utils';
import { cleanContent } from '../bookParser';

const BASE = 'http://m.biquge900.com';

function fetchPage(url: string, opts?: { body?: Buffer; method?: 'GET' | 'POST' }) {
  return fetchHTML(url, {
    referer: BASE + '/',
    encoding: 'gbk',
    body: opts?.body,
    method: opts?.method,
  });
}

export async function searchBooks(keyword: string): Promise<Book[]> {
  const prefix = Buffer.from('searchkey=', 'ascii');
  const suffix = Buffer.from('&t=1', 'ascii');
  const keyBuf = iconv.encode(keyword, 'gbk');
  const body = Buffer.concat([prefix, keyBuf, suffix]);

  const $ = await fetchPage(`${BASE}/modules/article/search.php`, {
    method: 'POST',
    body,
  });

  const books: Book[] = [];
  $('.hot_sale').each((_i, el) => {
    const a = $(el).find('a').first();
    const href = a.attr('href');
    if (!href) return;
    const name = a.find('.title').text().trim() || a.find('p').first().text().trim();
    if (!name) return;

    books.push({
      title: name,
      author: a.find('.author').text().trim() || undefined,
      kind: a.find('.review').text().trim() || undefined,
      lastChapter: undefined,
      bookId: toAbsUrl(href, BASE),
      sourceKey: 'biquge900',
      source: 'biquge900',
      tab: '',
    });
  });
  return books;
}

export async function getChapters(bookUrl: string): Promise<Chapter[]> {
  const $ = await fetchPage(bookUrl);

  const chapters: Chapter[] = [];
  $('.directoryArea p').each((_i, el) => {
    const a = $(el).find('a');
    const href = a.attr('href') ?? '';
    const title = a.text().trim();
    if (!href || !title) return;
    chapters.push({
      title,
      itemId: toAbsUrl(href, BASE),
    });
  });
  return chapters;
}

export async function getChapterContent(chapterUrl: string): Promise<ChapterContent> {
  const $ = await fetchPage(chapterUrl);

  const title = $('.title').first().text().trim() || '';

  const chapterDiv = $('#chaptercontent');
  chapterDiv.find('script, style, div, a').remove();
  chapterDiv.find('br').replaceWith('\n');
  const raw = chapterDiv.text();

  const cleaned = raw
    .replace(/笔趣阁最新域名：/g, '')
    .replace(/，请牢记本域名并相互转告！[^\S\n]*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/www\.\S+/g, '')
    .replace(/[ \t]{2,}/g, '')
    .trim();

  return {
    title,
    content: cleanContent(cleaned),
  };
}
