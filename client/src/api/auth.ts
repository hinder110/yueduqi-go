import { request } from './client';
import type { ApiResponse, LoginData } from '../types';

export function login(username: string, password: string): Promise<ApiResponse<LoginData>> {
  return request<LoginData>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export function register(username: string, password: string): Promise<ApiResponse<{ id: string; username: string; created_at: string }>> {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}
