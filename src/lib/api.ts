import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  TokenPair,
} from "../domain/api";
import { clearSession, getSession, updateTokens } from "./session";
import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_FUNCTION_NAME,
  SUPABASE_URL,
} from "./supabase";

export const API_BASE_URL = `${SUPABASE_URL}/functions/v1/${SUPABASE_FUNCTION_NAME}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "request_failed",
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let refreshRequest: Promise<boolean> | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorEnvelope
    | null;
  if (!response.ok) {
    const apiError = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new ApiError(
      apiError?.message || `Permintaan gagal (${response.status})`,
      response.status,
      apiError?.code,
      apiError?.details,
    );
  }
  return body as T;
}

async function refreshSession(): Promise<boolean> {
  const session = getSession();
  if (!session?.tokens.refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    });
    const result = await parseResponse<ApiEnvelope<TokenPair>>(response);
    updateTokens(result.data);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new ApiError(
      "Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.",
      0,
      "supabase_not_configured",
    );
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_ANON_KEY);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const accessToken = getSession()?.tokens.accessToken;
  headers.set(
    "Authorization",
    `Bearer ${authenticated && accessToken ? accessToken : SUPABASE_ANON_KEY}`,
  );
  let response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (authenticated && response.status === 401 && accessToken) {
    refreshRequest ??= refreshSession().finally(() => {
      refreshRequest = null;
    });
    if (await refreshRequest) {
      const nextToken = getSession()?.tokens.accessToken;
      if (nextToken) headers.set("Authorization", `Bearer ${nextToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    }
  }
  return parseResponse<T>(response);
}

export function envelope<T, M = unknown>(
  path: string,
  init?: RequestInit,
  authenticated = true,
) {
  return apiRequest<ApiEnvelope<T, M>>(path, init, authenticated);
}
