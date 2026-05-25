import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSource, errorMessage, cached } from './index';

// Mock cache module
vi.mock('./cache', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import { cacheGet, cacheSet } from './cache';

const cacheGetMock = vi.mocked(cacheGet);
const cacheSetMock = vi.mocked(cacheSet);

// ============================================================
// getSource
// ============================================================
describe('getSource', () => {
  it('返回默认 guangyu 当无 source 参数', () => {
    expect(getSource({})).toBe('guangyu');
  });

  it('返回默认 guangyu 当 source 为未知值', () => {
    expect(getSource({ source: 'unknown' })).toBe('guangyu');
    expect(getSource({ source: 'baidu' })).toBe('guangyu');
  });

  it('返回 biquge900', () => {
    expect(getSource({ source: 'biquge900' })).toBe('biquge900');
  });

  it('返回 qixinge', () => {
    expect(getSource({ source: 'qixinge' })).toBe('qixinge');
  });

  it('处理非字符串 source', () => {
    expect(getSource({ source: 123 })).toBe('guangyu');
  });
});

// ============================================================
// errorMessage
// ============================================================
describe('errorMessage', () => {
  it('Error 对象返回 message', () => {
    expect(errorMessage(new Error('网络错误'), '默认错误')).toBe('网络错误');
  });

  it('非 Error 类型返回 fallback', () => {
    expect(errorMessage('字符串错误', '默认错误')).toBe('默认错误');
  });

  it('null 返回 fallback', () => {
    expect(errorMessage(null, '默认错误')).toBe('默认错误');
  });

  it('undefined 返回 fallback', () => {
    expect(errorMessage(undefined, '默认错误')).toBe('默认错误');
  });

  it('数字返回 fallback', () => {
    expect(errorMessage(42, '默认错误')).toBe('默认错误');
  });

  it('对象的 message 属性不被使用（非 Error 实例）', () => {
    // 普通对象即使有 message 属性也不走 Error 分支
    expect(errorMessage({ message: 'hi' }, 'fallback')).toBe('fallback');
  });
});

// ============================================================
// cached
// ============================================================
describe('cached', () => {
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  it('缓存命中直接返回缓存数据', async () => {
    const cachedData = [{ id: 1, name: 'test' }];
    cacheGetMock.mockResolvedValue(cachedData);

    await cached(res, 'key:test', 3600, async () => [], 'testLabel', '失败');

    expect(cacheGetMock).toHaveBeenCalledWith('key:test');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: cachedData });
    expect(cacheSetMock).not.toHaveBeenCalled();
  });

  it('缓存未命中则调用 fetch 并写入缓存', async () => {
    const freshData = { title: 'fresh' };
    cacheGetMock.mockResolvedValue(null);
    const fetchFn = vi.fn().mockResolvedValue(freshData);

    await cached(res, 'key:test', 1800, fetchFn, 'testLabel', '失败');

    expect(cacheGetMock).toHaveBeenCalledWith('key:test');
    expect(fetchFn).toHaveBeenCalled();
    expect(cacheSetMock).toHaveBeenCalledWith('key:test', freshData, 1800);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: freshData });
  });

  it('fetch 抛出异常返回 500 错误响应', async () => {
    cacheGetMock.mockResolvedValue(null);
    const fetchFn = vi.fn().mockRejectedValue(new Error('网络超时'));

    await cached(res, 'key:test', 1800, fetchFn, 'testLabel', '获取失败');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: '网络超时',
    });
  });

  it('fetch 抛出非 Error 时使用 fallback 信息', async () => {
    cacheGetMock.mockResolvedValue(null);
    const fetchFn = vi.fn().mockRejectedValue('未知异常');

    await cached(res, 'key:test', 1800, fetchFn, 'testLabel', '后备错误信息');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: '后备错误信息',
    });
  });

  it('console.error 在异常时被调用', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    cacheGetMock.mockResolvedValue(null);
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'));

    await cached(res, 'key:test', 1800, fetchFn, 'myLabel', 'fallback');

    expect(consoleSpy).toHaveBeenCalledWith('[myLabel]', 'boom');
    consoleSpy.mockRestore();
  });

  it('缓存返回 null 视为未命中', async () => {
    cacheGetMock.mockResolvedValue(null);
    const fetchFn = vi.fn().mockResolvedValue('data');

    await cached(res, 'key:null', 60, fetchFn, 'label', 'err');

    expect(fetchFn).toHaveBeenCalled();
    expect(cacheSetMock).toHaveBeenCalled();
  });
});
