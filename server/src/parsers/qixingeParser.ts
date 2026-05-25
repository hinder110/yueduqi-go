import type { Book, Chapter, ChapterContent } from '../types';
import { toAbsUrl, fetchHTML } from '../utils';
import { cleanContent } from '../bookParser';

const BASE = 'http://www.qixinge.net';

function fetchPage(url: string) {
  return fetchHTML(url, { referer: BASE + '/' });
}

export async function searchBooks(keyword: string): Promise<Book[]> {
  const $ = await fetchPage(
    `${BASE}/search.php?q=${encodeURIComponent(keyword)}&p=1`
  );

  const books: Book[] = [];
  $('.col-md-6 dl').each((_i, el) => {
    const coverImg = $(el).find('dt img').attr('src');
    const nameLink = $(el).find('h3 a');
    const name = nameLink.text()
      .replace(/^\[.*?\]/, '')
      .replace(/免费阅读小说/g, '')
      .trim();
    const href = nameLink.attr('href') ?? '';
    if (!name || !href) return;

    const bookOthers = $(el).find('.book_other');
    const author = bookOthers.eq(0).find('span').first().text().trim();

    books.push({
      title: name,
      author: author || undefined,
      cover: toAbsUrl(coverImg || '', BASE),
      kind: bookOthers.eq(1).text().replace(/.*：/, '').trim() || undefined,
      lastChapter: bookOthers.eq(3).find('a').text().trim() || undefined,
      bookId: toAbsUrl(href, BASE),
      sourceKey: 'qixinge',
      source: 'qixinge',
      tab: '',
    });
  });
  return books;
}

export async function getChapters(bookUrl: string): Promise<Chapter[]> {
  const $ = await fetchPage(bookUrl);

  const chapters: Chapter[] = [];
  $('.book_list2 li a').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const title = $(el).text().trim();
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

  const rawTitle = $('h1').first().text().trim() || '';
  const title = rawTitle.replace(/-《.*》/, '').trim();

  const article = $('article.font_max');
  article.find('script, style, div, a').remove();
  article.find('br').replaceWith('\n');
  let text = article.text();

  text = text
    .replace(/本章未完.*/g, '')
    .replace(/第\s*\(?\s*\d+\s*\/\s*\d+\s*\)?\s*页/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    title,
    content: cleanContent(text),
  };
}
