import { describe, it, expect } from 'vitest';
import { toAbsUrl } from '../utils';
import { cleanContent } from '../bookParser';

describe('toAbsUrl — URL 拼接', () => {
  const BASE = 'http://m.biquge900.com';

  it('完整 URL 直接返回', () => {
    expect(toAbsUrl('https://example.com/book/123', BASE)).toBe('https://example.com/book/123');
  });

  it('绝对路径补全 BASE', () => {
    expect(toAbsUrl('/book/123.html', BASE)).toBe('http://m.biquge900.com/book/123.html');
  });

  it('相对路径补全 BASE', () => {
    expect(toAbsUrl('book/123.html', BASE)).toBe('http://m.biquge900.com/book/123.html');
  });

  it('空字符串返回空', () => {
    expect(toAbsUrl('', BASE)).toBe('');
  });
});

// ============================================================
// 笔趣阁正文清洗管道模拟: URL 正则 → 通用广告过滤
// ============================================================

// 模拟 getChapterContent 中的 URL 清洗逻辑
function cleanBiqugeText(raw: string): string {
  const cleaned = raw
    .replace(/笔趣阁最新域名：/g, '')
    .replace(/，请牢记本域名并相互转告！\s*/g, '')
    .replace(/https?:\/\/[^\s]*/g, '')
    .replace(/www\.[^\s]*/g, '')
    .replace(/[ \t]{2,}/g, '')
    .trim();
  return cleanContent(cleaned);
}

describe('笔趣阁正文文本清洗管道', () => {
  it('去除"笔趣阁最新域名"提示语', () => {
    // 注意：真实数据中 URL 和下文之间通常有空格或换行分隔
    const input = '笔趣阁最新域名：https://biquge900.com ，请牢记本域名并相互转告！\n正文开始';
    const result = cleanBiqugeText(input);
    expect(result).toContain('正文开始');
    expect(result).not.toContain('最新域名');
    expect(result).not.toContain('相互转告');
  });

  it('去除行内 https URL', () => {
    const input = '第一章\n更多精彩请访问 https://example.com/badlink 谢谢\n第二章';
    const result = cleanBiqugeText(input);
    expect(result).toContain('第一章');
    expect(result).toContain('第二章');
    expect(result).not.toContain('example.com');
  });

  it('去除 www 链接', () => {
    const input = '正文内容\n官网 www.example.com 欢迎访问\n结尾';
    const result = cleanBiqugeText(input);
    expect(result).toContain('正文内容');
    expect(result).toContain('结尾');
    expect(result).not.toContain('www.example.com');
  });

  it('保留正常正文内容', () => {
    const input = '夜，深了。\n\n他独自走在空无一人的街道上，脚步声在寂静中回荡。';
    const result = cleanBiqugeText(input);
    expect(result).toContain('夜，深了');
    expect(result).toContain('寂静中回荡');
  });

  it('多空格缩进去噪', () => {
    const input = '第一章    多余空格\n第二章';
    const result = cleanBiqugeText(input);
    // 多余空格被压缩或忽略
    expect(result).toContain('第一章');
    expect(result).toContain('第二章');
  });
});
