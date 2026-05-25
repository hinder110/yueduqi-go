import { describe, it, expect } from 'vitest';
import { USER_AGENT, fetchHTML } from './utils';

// ============================================================
// USER_AGENT
// ============================================================
describe('USER_AGENT', () => {
  it('是非空字符串', () => {
    expect(typeof USER_AGENT).toBe('string');
    expect(USER_AGENT.length).toBeGreaterThan(0);
  });

  it('包含 Mozilla 标识', () => {
    expect(USER_AGENT).toContain('Mozilla');
    expect(USER_AGENT).toContain('Chrome');
  });
});

// ============================================================
// fetchHTML
// ============================================================
describe('fetchHTML', () => {
  it('是一个函数', () => {
    expect(typeof fetchHTML).toBe('function');
  });

  it('返回 Promise', () => {
    // 不做真实请求，只验证签名
    const result = fetchHTML('http://example.com', { referer: 'http://r.com' });
    expect(result).toBeInstanceOf(Promise);
  });
});
