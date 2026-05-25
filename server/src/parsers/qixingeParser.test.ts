import { describe, it, expect } from 'vitest';
import { toAbsUrl } from '../utils';

describe('toAbsUrl — URL 拼接', () => {
  const BASE = 'http://www.qixinge.net';

  it('完整 URL 直接返回', () => {
    expect(toAbsUrl('https://example.com/book/123', BASE)).toBe('https://example.com/book/123');
  });

  it('绝对路径补全 BASE', () => {
    expect(toAbsUrl('/book/123.html', BASE)).toBe('http://www.qixinge.net/book/123.html');
  });

  it('相对路径补全 BASE', () => {
    expect(toAbsUrl('book/456.html', BASE)).toBe('http://www.qixinge.net/book/456.html');
  });

  it('空字符串返回空', () => {
    expect(toAbsUrl('', BASE)).toBe('');
  });
});
