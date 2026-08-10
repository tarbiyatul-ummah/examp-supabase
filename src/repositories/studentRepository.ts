import type { ApiStudent } from "../domain/api";
import { cachedEnvelope, envelope } from "../lib/api";
import {
  invalidateCachedRequests,
  REQUEST_CACHE_TAGS,
} from "../lib/requestCache";
import { getSession } from "../lib/session";
import { mapStudent } from "./mappers";

const STUDENT_LIST_CACHE_TTL_MS = 15_000;
const STUDENT_LISTS = REQUEST_CACHE_TAGS.studentLists;

export type StudentFilters = {
  search?: string;
  level?: string;
  phase?: string;
  grade?: number;
  status?: string;
  limit?: number;
  offset?: number;
};

function queryString(filters: StudentFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export const studentRepository = {
  getCurrentProfile: () => getSession()?.profile || null,
  async list(filters: StudentFilters = {}) {
    const path = `/v1/admin/students${queryString({ limit: 100, ...filters })}`;
    const response = await cachedEnvelope<
      ApiStudent[],
      { total: number; limit: number; offset: number }
    >(path, { ttlMs: STUDENT_LIST_CACHE_TTL_MS, tags: [STUDENT_LISTS] });
    return { students: response.data.map(mapStudent), page: response.meta };
  },
  async create(input: {
    name: string;
    level: "SD" | "SMP" | "SMA";
    grade: number;
    notes?: string;
  }) {
    const { data } = await envelope<{ student: ApiStudent; loginCode: string }>(
      "/v1/admin/students",
      { method: "POST", body: JSON.stringify(input) },
    );
    invalidateCachedRequests(STUDENT_LISTS);
    return {
      student: { ...mapStudent(data.student), code: data.loginCode },
      loginCode: data.loginCode,
    };
  },
  async update(id: string, input: Record<string, unknown>) {
    const { data } = await envelope<ApiStudent>(`/v1/admin/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    invalidateCachedRequests(STUDENT_LISTS);
    return mapStudent(data);
  },
  async regenerateCode(id: string) {
    const { data } = await envelope<{ loginCode: string }>(
      `/v1/admin/students/${id}/regenerate-code`,
      { method: "POST" },
    );
    invalidateCachedRequests(STUDENT_LISTS);
    return data.loginCode;
  },
};

export type StudentRepository = typeof studentRepository;
