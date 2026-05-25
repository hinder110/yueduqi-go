import { describe, it, expect } from 'vitest';
import { cleanContent, mapBookList, cleanBookName } from './bookParser';

describe('cleanContent — 广告过滤', () => {
  // ========== 广告行过滤 ==========

  it('过滤 VIP 打赏广告', () => {
    const input = '您当前未登录，今日已访问 1/3 次\n\n本书源属于晴天独有公益书源，提供免费阅读服务（如需下载请打赏开通VIP，非VIP用户进行缓存操作会封禁账号，打赏后可关闭该条信息），打赏vip现在限时折扣中！明天将会恢复原价！目前会不定期删除普通账户，减轻服务器压力，释放性能为vip服务器提供服务！如需下载缓存和去净化广告功能，请在用户后台页面打赏，备注邮箱会自动开通！如果未开通请联系作者邮箱（wj1085281124@gmail.com）或加入电报群(https://t.me/qingtain618_novel)';
    const result = cleanContent(input);
    expect(result).toBe('');
  });

  it('过滤含打赏关键词的行', () => {
    const input = '第一章 开始\n打赏后可继续阅读\n第二章 结束';
    const result = cleanContent(input);
    expect(result).toContain('第一章 开始');
    expect(result).toContain('第二章 结束');
    expect(result).not.toContain('打赏');
  });

  it('过滤含广告 VIP 语境的行（开通VIP、非VIP用户等）', () => {
    const input = '第一章\n开通VIP解锁完整版\n非VIP用户无法缓存\n第二章';
    const result = cleanContent(input);
    expect(result).toContain('第一章');
    expect(result).toContain('第二章');
    expect(result).not.toContain('开通VIP');
    expect(result).not.toContain('非VIP');
  });

  it('过滤含电报群/telegram 的行', () => {
    const input = '第一章开始\n加电报群获取更多 https://t.me/xxx\n第二章继续';
    const result = cleanContent(input);
    expect(result).toContain('第一章开始');
    expect(result).toContain('第二章继续');
    expect(result).not.toContain('t.me');
  });

  it('过滤含邮箱的行', () => {
    const input = '正经内容\n请联系xxx@gmail.com\n另一行正文';
    const result = cleanContent(input);
    expect(result).toContain('正经内容');
    expect(result).toContain('另一行正文');
    expect(result).not.toContain('gmail');
  });

  // ========== 正常内容保留 ==========

  it('保留正常章节内容', () => {
    const input =
      '黄昏时分，暮色四合，整座城市笼罩在一片金色的光晕之中。\n\n这座古老的城池，四四方方，横平竖直。';
    const result = cleanContent(input);
    expect(result).toContain('黄昏时分');
    expect(result).toContain('古老');
  });

  it('保留含用户对话的行', () => {
    const input = '他说道："你知道吗，我可是VIP会员。"';
    const result = cleanContent(input);
    expect(result).toContain('VIP会员');
  });

  it('输出为 HTML p 标签包裹', () => {
    const input = '第一行\n第二行';
    const result = cleanContent(input);
    expect(result).toBe('<p>第一行</p>\n<p>第二行</p>');
  });

  // ========== 空文本 ==========

  it('空字符串返回空', () => {
    expect(cleanContent('')).toBe('');
  });

  it('全广告文本返回空', () => {
    const input = '打赏\nVIP限时折扣\n联系作者xxx@gmail.com\n加电报群t.me/xxx';
    const result = cleanContent(input);
    expect(result).toBe('');
  });
});

// ============================================================
// mapBookList — API 返回数据 → Book 类型映射
// ============================================================

describe('mapBookList — 书籍数据映射', () => {
  const sampleItem = {
    book_name: '三体',
    author: '刘慈欣',
    thumb_url: 'https://example.com/cover.jpg',
    abstract: '科幻巨作',
    status: '完结',
    score: '9.5',
    tags: '科幻',
    last_chapter_update_time: '2024-01-01',
    source: '番茄',
    last_chapter_title: '后记',
    word_number: '200000',
    book_id: '12345',
    tab: '小说',
  };

  it('正常映射所有字段', () => {
    const result = mapBookList([sampleItem]);
    expect(result).toHaveLength(1);
    const book = result[0];
    expect(book.title).toBe('三体');
    expect(book.author).toBe('刘慈欣');
    expect(book.cover).toBe('https://example.com/cover.jpg');
    expect(book.intro).toBe('科幻巨作');
    expect(book.bookId).toBe('12345');
    expect(book.sourceKey).toBe('guangyu');
    expect(book.source).toBe('番茄');
    expect(book.tab).toBe('小说');
  });

  it('kind 字段拼接多个信息', () => {
    const result = mapBookList([sampleItem]);
    expect(result[0].kind).toBe('完结 / 9.5 / 科幻 / 2024-01-01');
  });

  it('kind 只拼非空值', () => {
    const result = mapBookList([{ book_name: 'A', status: '连载' }]);
    expect(result[0].kind).toBe('连载');
  });

  it('lastChapter 拼接 source 和章节标题', () => {
    const result = mapBookList([sampleItem]);
    expect(result[0].lastChapter).toBe('番茄 后记');
  });

  it('lastChapter 无 source 时不显示多余空格', () => {
    const result = mapBookList([{ book_name: 'A', last_chapter_title: '后记' }]);
    expect(result[0].lastChapter).toBe('后记');
  });

  it('缺失字段使用默认值', () => {
    const result = mapBookList([{}]);
    const book = result[0];
    expect(book.title).toBe('');
    expect(book.author).toBe('');
    expect(book.cover).toBe('');
    expect(book.intro).toBe('');
    expect(book.kind).toBe('');
    expect(book.lastChapter).toBe('');
    expect(book.bookId).toBe('');
  });

  it('空数组返回空', () => {
    expect(mapBookList([])).toEqual([]);
  });

  it('多本书同时映射', () => {
    const result = mapBookList([
      { book_name: 'A', book_id: '1' },
      { book_name: 'B', book_id: '2' },
      { book_name: 'C', book_id: '3' },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((b) => b.title)).toEqual(['A', 'B', 'C']);
  });

  it('书名为数字时转为字符串', () => {
    const result = mapBookList([{ book_name: 123 }]);
    expect(result[0].title).toBe('123');
  });
});

// ============================================================
// cleanBookName — 书名清洗
// ============================================================

describe('cleanBookName — 书名清洗', () => {
  it('去除中文括号别名（别名：xxx）', () => {
    expect(cleanBookName('三体（别名：地球往事）')).toBe('三体');
  });

  it('去除英文括号别名（别名:xxx）', () => {
    expect(cleanBookName('三体(别名:地球往事)')).toBe('三体');
  });

  it('无括号书名原样返回', () => {
    expect(cleanBookName('三体')).toBe('三体');
  });

  it('空字符串返回空', () => {
    expect(cleanBookName('')).toBe('');
  });

  it('去除后首尾空格被 trim', () => {
    expect(cleanBookName(' 三体 （别名：xxx） ')).toBe('三体');
  });
});
