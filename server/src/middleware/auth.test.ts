import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUser, requireAuth } from './auth';

// Mock jwt 以控制验证行为
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';

const jwtVerifyMock = vi.mocked(jwt.verify);

function mockRequest(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
  } as any;
}

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无 Authorization 头返回 null', () => {
    expect(getUser(mockRequest(undefined))).toBeNull();
  });

  it('非 Bearer 头返回 null', () => {
    expect(getUser(mockRequest('Basic abc123'))).toBeNull();
  });

  it('有效 Bearer token 返回用户信息', () => {
    jwtVerifyMock.mockReturnValue({ userId: '1', username: 'test' });
    const user = getUser(mockRequest('Bearer valid.token.here'));
    expect(user).toEqual({ userId: '1', username: 'test' });
    expect(jwtVerifyMock).toHaveBeenCalledWith('valid.token.here', expect.any(String));
  });

  it('无效 token 返回 null', () => {
    jwtVerifyMock.mockImplementation(() => { throw new Error('invalid'); });
    expect(getUser(mockRequest('Bearer bad.token'))).toBeNull();
  });
});

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录返回 401', () => {
    const req = mockRequest(undefined);
    const res = mockResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: '请先登录' });
    expect(next).not.toHaveBeenCalled();
  });

  it('已登录将 user 挂载到 req 并调用 next', () => {
    jwtVerifyMock.mockReturnValue({ userId: '1', username: 'test' });
    const req = mockRequest('Bearer good.token');
    const res = mockResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect((req as any).user).toEqual({ userId: '1', username: 'test' });
    expect(next).toHaveBeenCalled();
  });

  it('无效 token 返回 401', () => {
    jwtVerifyMock.mockImplementation(() => { throw new Error('expired'); });
    const req = mockRequest('Bearer expired.token');
    const res = mockResponse();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
