import { describe, it, expect } from 'vitest';
import { JWT_SECRET, TOKEN_EXPIRY } from './config';

describe('config', () => {
  it('JWT_SECRET 为非空字符串', () => {
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThan(0);
  });

  it('TOKEN_EXPIRY 为 7d', () => {
    expect(TOKEN_EXPIRY).toBe('7d');
  });
});
