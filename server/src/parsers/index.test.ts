import { describe, it, expect } from 'vitest';
import { normalizeName, fuzzyMatch, mergeCovers } from './index';
import type { Book } from '../types';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    title: '三体',
    author: '刘慈欣',
    cover: '',
    intro: '',
    kind: '科幻',
    lastChapter: '',
    bookId: '123',
    sourceKey: 'test',
    source: '番茄',
    tab: '小说',
    ...overrides,
  };
}

// ============================================================
// normalizeName — 书名标准化
// ============================================================

describe('normalizeName — 书名标准化', () => {
  it('去除中文括号及内容', () => {
    expect(normalizeName('三体（别名：地球往事）')).toBe('三体');
  });

  it('去除英文括号及内容', () => {
    expect(normalizeName('三体(地球往事)')).toBe('三体');
  });

  it('去除特殊符号只保留中英文数字', () => {
    expect(normalizeName('你好，世界！Hello, World!')).toBe('你好世界helloworld');
  });

  it('转为小写', () => {
    expect(normalizeName('Hello World')).toBe('helloworld');
  });

  it('空字符串返回空', () => {
    expect(normalizeName('')).toBe('');
  });

  it('纯符号返回空', () => {
    expect(normalizeName('《》！？')).toBe('');
  });
});

// ============================================================
// fuzzyMatch — 书名模糊匹配
// ============================================================

describe('fuzzyMatch — 书名模糊匹配', () => {
  it('相同书名匹配', () => {
    expect(fuzzyMatch('三体', '三体')).toBe(true);
  });

  it('一方是另一方的子串匹配', () => {
    expect(fuzzyMatch('三体', '三体123')).toBe(true);
    expect(fuzzyMatch('三体123', '三体')).toBe(true);
  });

  it('标准化后相同则匹配（括号差异）', () => {
    expect(fuzzyMatch('三体（地球往事）', '三体')).toBe(true);
  });

  it('不同书名不匹配', () => {
    expect(fuzzyMatch('三体', '流浪地球')).toBe(false);
  });

  it('两空字符串不匹配', () => {
    expect(fuzzyMatch('', '')).toBe(false);
  });

  it('标准化为空时不匹配', () => {
    expect(fuzzyMatch('《》', '三体')).toBe(false);
  });
});

// ============================================================
// mergeCovers — 封面和简介合并
// ============================================================

describe('mergeCovers — 封面简介合并', () => {
  it('书名匹配时补充封面和简介', () => {
    const target = [makeBook({ title: '三体', cover: '', intro: '' })];
    const supplement = [makeBook({ title: '三体', cover: 'cover.jpg', intro: '科幻巨作' })];
    const result = mergeCovers(target, supplement);
    expect(result[0].cover).toBe('cover.jpg');
    expect(result[0].intro).toBe('科幻巨作');
  });

  it('已有封面和简介的不覆盖', () => {
    const target = [makeBook({ title: '三体', cover: 'old.jpg', intro: '老简介' })];
    const supplement = [makeBook({ title: '三体', cover: 'new.jpg', intro: '新简介' })];
    const result = mergeCovers(target, supplement);
    expect(result[0].cover).toBe('old.jpg');
    expect(result[0].intro).toBe('老简介');
  });

  it('补充列表为空时原样返回', () => {
    const target = [makeBook({ title: '三体', cover: '', intro: '' })];
    const result = mergeCovers(target, []);
    expect(result).toEqual(target);
  });

  it('书名不匹配时不修改', () => {
    const target = [makeBook({ title: '三体', cover: '', intro: '' })];
    const supplement = [makeBook({ title: '流浪地球', cover: 'cover.jpg', intro: '好' })];
    const result = mergeCovers(target, supplement);
    expect(result[0].cover).toBe('');
    expect(result[0].intro).toBe('');
  });

  it('多本书批量合并', () => {
    const targets = [
      makeBook({ title: '三体', cover: '', intro: '', bookId: '1' }),
      makeBook({ title: '流浪地球', cover: '', intro: '', bookId: '2' }),
    ];
    const supps = [
      makeBook({ title: '三体（地球往事）', cover: 'a.jpg', intro: 'A', bookId: '3' }),
      makeBook({ title: '流浪地球', cover: 'b.jpg', intro: 'B', bookId: '4' }),
    ];
    const result = mergeCovers(targets, supps);
    expect(result[0].cover).toBe('a.jpg');
    expect(result[1].cover).toBe('b.jpg');
  });

  it('补充列表包含不匹配的书也没问题', () => {
    const target = [makeBook({ title: '三体', cover: '', intro: '' })];
    const supplement = [
      makeBook({ title: '其他书', cover: 'other.jpg', intro: '无关' }),
      makeBook({ title: '三体', cover: 'good.jpg', intro: '好' }),
    ];
    const result = mergeCovers(target, supplement);
    expect(result[0].cover).toBe('good.jpg');
  });
});
