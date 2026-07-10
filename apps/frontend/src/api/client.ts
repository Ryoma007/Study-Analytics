/**
 * API 客户端 —— fetch 封装
 * 基址 /api，所有请求 JSON，错误统一抛出 ApiError
 */
import { toast } from 'sonner';

/** API 基础路径 */
const API_BASE = '/api';

/** API 请求错误 */
export class ApiError extends Error {
  /** HTTP 状态码 */
  status: number;
  /** 服务端错误信息 */
  serverError: string;

  constructor(status: number, serverError: string) {
    super(`API 请求失败 (${status}): ${serverError}`);
    this.name = 'ApiError';
    this.status = status;
    this.serverError = serverError;
  }
}

/**
 * 通用 JSON 请求封装
 * @param path API 路径（不含 /api 前缀）
 * @param options fetch 额外选项
 * @returns 解析后的 JSON 响应体
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // 解析响应体（可能是 JSON 也可能是空）
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const msg = typeof body?.error === 'string' ? body.error : `请求失败 (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return body as T;
}

/** API 方法集合（GET/POST/PATCH/DELETE） */
export const api = {
  /** GET 请求 */
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },

  /** POST 请求 */
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /** PATCH 请求 */
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  /** DELETE 请求 */
  delete<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
};

/**
 * 调用 API 并 toast 错误（用于 mutation 中）
 * 注意：不吞异常，调用方仍需处理
 */
export async function apiWithToast<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof ApiError) {
      toast.error(e.serverError);
    } else {
      toast.error('网络请求失败，请检查网络连接');
    }
    throw e;
  }
}
