import { ApiErrorSchema } from '@osh/contracts';
import { parseContract } from './response-contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field?: string; message: string }>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`/api${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    headers: {
      ...(isForm ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;
  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(payload);
    throw new ApiError(
      response.status,
      parsedError.success ? parsedError.data.code : 'REQUEST_FAILED',
      parsedError.success ? parsedError.data.message : `Request failed (${response.status})`,
      parsedError.success ? parsedError.data.details : undefined,
      parsedError.success ? parsedError.data.requestId : undefined,
    );
  }
  try {
    return parseContract(path, method, payload) as T;
  } catch {
    throw new ApiError(
      502,
      'CONTRACT_MISMATCH',
      'The server response did not match the shared contract. Refresh and try again.',
    );
  }
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`/api${path}`, { method: 'POST', body: form });
  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;
  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(payload);
    throw new ApiError(
      response.status,
      parsedError.success ? parsedError.data.code : 'UPLOAD_FAILED',
      parsedError.success ? parsedError.data.message : 'Upload failed',
    );
  }
  try {
    return parseContract(path, 'POST', payload) as T;
  } catch {
    throw new ApiError(502, 'CONTRACT_MISMATCH', 'The upload response did not match the contract.');
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Try again.';
}
