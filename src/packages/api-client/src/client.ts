import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorBody } from '@unihub/types';

export interface TokenStore {
  getAccessToken(): string | null | Promise<string | null>;
  getRefreshToken?(): string | null | Promise<string | null>;
  setTokens?(tokens: { accessToken: string; refreshToken?: string }): void | Promise<void>;
  clear?(): void | Promise<void>;
}

export interface CreateApiClientOptions {
  baseURL: string;
  tokenStore?: TokenStore;
  onUnauthorized?: () => void;
  defaultHeaders?: Record<string, string>;
  /**
   * If provided, will be called on 401 to attempt refresh. Returning a new
   * access token retries the original request once.
   */
  refreshAccessToken?: () => Promise<string | null>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export function createApiClient(options: CreateApiClientOptions): AxiosInstance {
  const { baseURL, tokenStore, onUnauthorized, defaultHeaders, refreshAccessToken } = options;

  const instance = axios.create({
    baseURL,
    timeout: 15_000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...defaultHeaders,
    },
  });

  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (tokenStore) {
      const token = await tokenStore.getAccessToken();
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError<ApiErrorBody>) => {
      const original = error.config as (AxiosRequestConfig & { __retried?: boolean }) | undefined;

      if (error.response?.status === 401 && original && !original.__retried) {
        if (refreshAccessToken) {
          try {
            const newToken = await refreshAccessToken();
            if (newToken) {
              original.__retried = true;
              original.headers = {
                ...(original.headers ?? {}),
                Authorization: `Bearer ${newToken}`,
              };
              return instance.request(original);
            }
          } catch {
            // fall through to unauthorized handler
          }
        }
        await tokenStore?.clear?.();
        onUnauthorized?.();
      }

      if (error.response?.data) {
        const body = error.response.data;
        const apiError = new ApiError(error.response.status, {
          code: body.code ?? 'unknown_error',
          message: body.message ?? error.message,
          details: body.details,
        });
        return Promise.reject(apiError);
      }
      return Promise.reject(error);
    },
  );

  return instance;
}
