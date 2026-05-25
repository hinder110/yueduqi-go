import { httpClient } from './utils';
import { Book, Chapter, ChapterContent } from './types';

const API_HOSTS = [
  'https://v1.gyks.cf',
  'https://v2.gyks.cf',
  'https://v3.gyks.cf',
  'https://v4.gyks.cf',
  'https://v5.gyks.cf',
  'https://v6.gyks.cf',
  'https://v7.gyks.cf',
];

/**
 * 在所有 host 上尝试请求，返回第一个成功的结果。
 * 所有 host 都失败时抛出最后一个错误。
 */
async function tryAllHosts<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const errors: unknown[] = [];
  const promises = API_HOSTS.map((host) =>
    fn(host).catch((err) => {
      errors.push(err);
      throw err;
    }),
  );
  try {
    return await Promise.any(promises);
  } catch {
    throw errors[errors.length - 1] ?? new Error('所有 API 镜像请求失败');
  }
}

export async function searchBooks(keyword: string): Promise<Book[]> {
  return tryAllHosts(async (baseUrl) => {
    const response = await httpClient.get(`${baseUrl}/search`, {
      params: {
        title: keyword,
        tab: '小说',
        source: '番茄',
        page: 1,
        disabled_sources: '0',
      },
    });

    const data = response.data;
    if (!data || !Array.isArray(data.data)) return [];
    return mapBookList(data.data);
  });
}

/** 热门推荐（热搜榜），/get_discover 接口 */
export async function getHotBooks(): Promise<Book[]> {
  return tryAllHosts(async (baseUrl) => {
    const response = await httpClient.get(`${baseUrl}/get_discover`, {
      params: {
        source: '番茄',
        tab: '小说',
        bdtype: '热搜榜',
        gender: 1,
        is_ranking: 1,
        page: 1,
      },
    });

    const data = response.data;
    if (!data || !Array.isArray(data.data)) return [];
    // 取前12本，2行 × 6列
    return mapBookList(data.data.slice(0, 12));
  });
}

/** 将光遇 API 返回的书籍 JSON 数组映射为 Book[] */
export function mapBookList(items: Record<string, unknown>[]): Book[] {
  return items.map((item) => ({
    title: cleanBookName(String(item.book_name ?? '')),
    author: String(item.author ?? ''),
    cover: String(item.thumb_url ?? ''),
    intro: String(item.abstract ?? ''),
    kind: [item.status, item.score, item.tags, item.last_chapter_update_time]
      .filter(Boolean)
      .join(' / '),
    lastChapter: `${item.source ?? ''} ${item.last_chapter_title ?? ''}`.trim(),
    wordCount: String(item.word_number ?? ''),
    bookId: String(item.book_id ?? ''),
    sourceKey: 'guangyu',
    source: String(item.source ?? '番茄'),
    tab: String(item.tab ?? '小说'),
  })) satisfies Book[];
}

export async function getChapters(
  bookId: string,
  source: string,
  tab: string
): Promise<Chapter[]> {
  return tryAllHosts(async (baseUrl) => {
    const response = await httpClient.get(`${baseUrl}/catalog`, {
      params: { book_id: bookId, source, tab },
    });

    const data = response.data;
    if (!data || !Array.isArray(data.data)) return [];

    return data.data.map((item: Record<string, unknown>) => ({
      title: String(item.title ?? ''),
      itemId: String(item.item_id ?? ''),
    })) satisfies Chapter[];
  });
}

export async function getChapterContent(
  bookId: string,
  itemId: string,
  source: string,
  tab: string
): Promise<ChapterContent> {
  return tryAllHosts(async (baseUrl) => {
    const response = await httpClient.post(`${baseUrl}/content`, {
      html: '',
      item_id: itemId,
      source,
      tab,
      tone_id: '4',
      variable: '',
      version: '4.11.5.1',
    });

    const raw = String(response.data?.content ?? '');

    if (raw.includes('免登录访问次数已达上限')) {
      throw new Error('今日免费阅读次数已用完（每日3次），请明天再试');
    }

    return {
      title: String(response.data?.title ?? ''),
      content: cleanContent(raw),
    };
  });
}

export function cleanBookName(name: string): string {
  return name.replace(/[（(]别名[：:].*?[）)]/, '').trim();
}

// 书源广告关键词，整行匹配则整行丢弃
const AD_PATTERNS = [
  /打赏/,
  /非\s*[Vv][Ii][Pp]\s*用户/,
  /[Vv][Ii][Pp]\s*服务器/,
  /开通\s*[Vv][Ii][Pp]/,
  /封禁/,
  /电报群|t\.me/i,
  /telegram/i,
  /联系作者/,
  /后台页面/,
  /gmai?l\.com/,
  /限时折扣/,
  /恢复原价/,
  /删除普通账户/,
  /服务器压力/,
  /纯净/,
  /未登录.*访问/,
  /已访问.*次/,
  /缓存操作/,
];

export function cleanContent(content: string): string {
  return content
    .replace(/\s*ident="[^"]*"/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      // 过滤广告行：整行匹配任一广告模式则丢弃
      return !AD_PATTERNS.some((p) => p.test(line));
    })
    .map((line) => `<p>${line}</p>`)
    .join('\n');
}
