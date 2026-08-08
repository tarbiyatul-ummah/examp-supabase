// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

type Role = "student" | "admin" | "super_admin";

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

function namedKey(name: string): string {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return "";
  try {
    const keys = JSON.parse(raw) as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch {
    return raw;
  }
}

const publishableKey =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
  namedKey("SUPABASE_PUBLISHABLE_KEYS") ||
  Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
  "";
const secretKey =
  Deno.env.get("SUPABASE_SECRET_KEY")?.trim() ||
  namedKey("SUPABASE_SECRET_KEYS") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
  "";

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error(
    "SUPABASE_URL, publishable key, dan secret/service-role key wajib tersedia.",
  );
}

const service = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = () =>
  createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((value: string) => value.trim())
  .filter(Boolean);

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowOrigin = allowedOrigins.includes("*")
    ? "*"
    : allowedOrigins.includes(origin)
      ? origin
      : (allowedOrigins[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, idempotency-key, x-controller-session-id, x-client-seq",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, data: unknown, status = 200, meta?: unknown) {
  return new Response(
    JSON.stringify(meta === undefined ? { data } : { data, meta }),
    {
      status,
      headers: { ...corsHeaders(request), "Content-Type": "application/json" },
    },
  );
}

function noContent(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function errorResponse(request: Request, cause: unknown) {
  const error =
    cause instanceof HttpError
      ? cause
      : new HttpError(500, "internal_error", "Terjadi kesalahan pada server.");
  if (!(cause instanceof HttpError)) console.error(cause);
  return new Response(
    JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    }),
    {
      status: error.status,
      headers: { ...corsHeaders(request), "Content-Type": "application/json" },
    },
  );
}

function failFromDb(error: any): never {
  const code = error?.code ?? "database_error";
  const status =
    code === "42501"
      ? 403
      : code === "P0002"
        ? 404
        : code === "40001" || code === "23505" || code === "55000"
          ? 409
          : String(code).startsWith("22") || String(code).startsWith("23")
            ? 400
            : 500;
  throw new HttpError(
    status,
    code,
    error?.message ?? "Operasi database gagal.",
    {
      hint: error?.hint,
      details: error?.details,
    },
  );
}

function dataOrThrow<T>(result: { data: T | null; error: any }): T {
  if (result.error) failFromDb(result.error);
  return result.data as T;
}

async function body(request: Request): Promise<Record<string, any>> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Body JSON tidak valid.");
  }
}

function bearer(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].startsWith("sb_")) {
    throw new HttpError(401, "unauthorized", "Sesi login diperlukan.");
  }
  return match[1];
}

async function actor(request: Request, roles?: Role[]) {
  const token = bearer(request);
  const { data: authData, error: authError } =
    await service.auth.getUser(token);
  if (authError || !authData.user) {
    throw new HttpError(
      401,
      "invalid_token",
      "Sesi tidak valid atau sudah kedaluwarsa.",
    );
  }
  const profile = dataOrThrow<any>(
    await service
      .from("profiles")
      .select("id,role,status,username,display_name")
      .eq("id", authData.user.id)
      .maybeSingle(),
  );
  if (!profile || profile.status !== "active") {
    throw new HttpError(403, "account_inactive", "Akun tidak aktif.");
  }
  if (roles && !roles.includes(profile.role as Role)) {
    throw new HttpError(403, "forbidden", "Akses ditolak.");
  }
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { token, user: authData.user, profile, client };
}

async function studentForUser(userId: string) {
  const student = dataOrThrow<any>(
    await service
      .from("students")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle(),
  );
  if (!student)
    throw new HttpError(
      403,
      "student_not_found",
      "Profil peserta tidak ditemukan.",
    );
  return student;
}

function tokenPair(session: any) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new HttpError(401, "session_unavailable", "Sesi tidak dapat dibuat.");
  }
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
  };
}

function mapStudent(row: any, codeHint?: string) {
  return {
    id: row.id,
    name: row.name,
    birthPlace: row.birth_place ?? undefined,
    birthDate: row.birth_date ?? undefined,
    level: row.level,
    grade: Number(row.grade),
    phase: row.phase,
    notes: row.notes ?? undefined,
    status: row.status,
    codeHint: codeHint ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExam(row: any, questionCount = 0) {
  return {
    id: row.id,
    name: row.name,
    descriptionDoc: row.description_doc,
    durationSeconds: row.duration_seconds,
    targetLevel: row.target_level ?? undefined,
    targetGrades: row.target_grades ?? [],
    gradingMode: row.grading_mode,
    shuffleOptions: row.shuffle_questions,
    status: row.status,
    currentVersion: row.current_version,
    questionCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOption(row: any, correctOptionId?: string) {
  return {
    id: row.id,
    contentDoc: row.content_doc,
    position: row.position,
    ...(correctOptionId === undefined
      ? {}
      : { isCorrect: row.id === correctOptionId }),
  };
}

function mapQuestion(
  row: any,
  examId: string,
  options: any[] = [],
  correct?: string,
) {
  return {
    id: row.id,
    examId,
    type: row.type,
    contentDoc: row.content_doc,
    weight: Number(row.weight),
    position: row.position,
    shuffleOptions: row.shuffle_options,
    options: options.map((option) => mapOption(option, correct)),
  };
}

function mapAnswer(
  row: any,
  result?: any,
  fallback?: { attemptId: string; questionId: string },
) {
  return {
    id: row?.id ?? `${fallback?.attemptId}:${fallback?.questionId}`,
    attemptId: row?.attempt_id ?? fallback?.attemptId,
    questionId: row?.question_id ?? fallback?.questionId,
    selectedOptionId: row?.selected_option_id ?? undefined,
    textRaw: row?.text_raw ?? undefined,
    version: row?.version ?? 0,
    verdict: result?.final_verdict ?? undefined,
    reviewRevision: result?.review_revision ?? undefined,
    updatedAt:
      row?.updated_at ?? result?.updated_at ?? new Date().toISOString(),
  };
}

async function examsWithCounts(rows: any[]) {
  if (!rows.length) return [];
  const versions = dataOrThrow<any[]>(
    await service
      .from("exam_versions")
      .select("id,exam_id,status,version")
      .in(
        "exam_id",
        rows.map((row) => row.id),
      ),
  );
  const chosen = new Map<string, any>();
  for (const exam of rows) {
    const candidates = versions.filter(
      (version) => version.exam_id === exam.id,
    );
    const preferred =
      candidates.find(
        (version) =>
          version.status ===
          (exam.status === "published" ? "published" : "draft"),
      ) ?? candidates.sort((a, b) => b.version - a.version)[0];
    if (preferred) chosen.set(exam.id, preferred);
  }
  const versionIds = [...chosen.values()].map((version) => version.id);
  const questions = versionIds.length
    ? dataOrThrow<any[]>(
        await service
          .from("questions")
          .select("id,exam_version_id")
          .in("exam_version_id", versionIds),
      )
    : [];
  return rows.map((exam) => {
    const versionId = chosen.get(exam.id)?.id;
    return mapExam(
      exam,
      questions.filter((question) => question.exam_version_id === versionId)
        .length,
    );
  });
}

async function assertAttemptAccess(
  attemptId: string,
  auth: any,
  admin = false,
) {
  const attempt = dataOrThrow<any>(
    await service
      .from("attempts")
      .select("*")
      .eq("id", attemptId)
      .maybeSingle(),
  );
  if (!attempt)
    throw new HttpError(404, "attempt_not_found", "Attempt tidak ditemukan.");
  const assignment = dataOrThrow<any>(
    await service
      .from("exam_assignments")
      .select("*")
      .eq("id", attempt.assignment_id)
      .single(),
  );
  if (!admin) {
    const student = await studentForUser(auth.user.id);
    if (assignment.student_id !== student.id) {
      throw new HttpError(403, "forbidden", "Akses attempt ditolak.");
    }
  }
  return { attempt, assignment };
}

async function attemptSnapshot(
  attemptId: string,
  includeKeys = false,
  includeUnanswered = false,
) {
  const attempt = dataOrThrow<any>(
    await service.from("attempts").select("*").eq("id", attemptId).single(),
  );
  const assignment = dataOrThrow<any>(
    await service
      .from("exam_assignments")
      .select("exam_id,student_id")
      .eq("id", attempt.assignment_id)
      .single(),
  );
  const attemptQuestions = dataOrThrow<any[]>(
    await service
      .from("attempt_questions")
      .select("attempt_id,question_id,display_order,option_order")
      .eq("attempt_id", attemptId)
      .order("display_order"),
  );
  const questionIds = attemptQuestions.map((item) => item.question_id);
  const questions = questionIds.length
    ? dataOrThrow<any[]>(
        await service.from("questions").select("*").in("id", questionIds),
      )
    : [];
  const options = questionIds.length
    ? dataOrThrow<any[]>(
        await service
          .from("question_options")
          .select("*")
          .in("question_id", questionIds),
      )
    : [];
  const keys =
    includeKeys && questionIds.length
      ? dataOrThrow<any[]>(
          await service
            .from("question_option_keys")
            .select("question_id,correct_option_id")
            .in("question_id", questionIds),
        )
      : [];
  const answers = dataOrThrow<any[]>(
    await service.from("answers").select("*").eq("attempt_id", attemptId),
  );
  const results = dataOrThrow<any[]>(
    await service
      .from("attempt_question_results")
      .select("*")
      .eq("attempt_id", attemptId),
  );
  const mappedQuestions = attemptQuestions.map((item) => {
    const question = questions.find(
      (candidate) => candidate.id === item.question_id,
    );
    const optionOrder = item.option_order ?? [];
    const questionOptions = options
      .filter((option) => option.question_id === item.question_id)
      .sort((a, b) => {
        const ai = optionOrder.indexOf(a.id);
        const bi = optionOrder.indexOf(b.id);
        return (ai < 0 ? a.position : ai) - (bi < 0 ? b.position : bi);
      });
    const key = keys.find(
      (candidate) => candidate.question_id === item.question_id,
    );
    return {
      questionId: item.question_id,
      displayOrder: item.display_order,
      optionOrder,
      question: mapQuestion(
        question,
        assignment.exam_id,
        questionOptions,
        key?.correct_option_id,
      ),
    };
  });
  const mappedAnswers = includeUnanswered
    ? attemptQuestions.map((item) =>
        mapAnswer(
          answers.find((answer) => answer.question_id === item.question_id),
          results.find((result) => result.question_id === item.question_id),
          { attemptId, questionId: item.question_id },
        ),
      )
    : answers.map((answer) =>
        mapAnswer(
          answer,
          results.find((result) => result.question_id === answer.question_id),
        ),
      );
  return {
    id: attempt.id,
    examId: assignment.exam_id,
    examVersionId: attempt.exam_version_id,
    studentId: assignment.student_id,
    status: attempt.status,
    gradingStatus: attempt.grading_status ?? undefined,
    activeElapsedSeconds: attempt.active_elapsed_seconds,
    durationSeconds: attempt.duration_seconds,
    remainingSeconds: Math.max(
      0,
      attempt.duration_seconds - attempt.active_elapsed_seconds,
    ),
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at ?? undefined,
    score: attempt.score === null ? undefined : Number(attempt.score),
    disqualificationReason: attempt.disqualification_reason ?? undefined,
    questions: mappedQuestions,
    answers: mappedAnswers,
  };
}

async function adminLogin(request: Request) {
  const input = await body(request);
  const login = String(input.login ?? "").trim();
  const password = String(input.password ?? "");
  if (!login || !password)
    throw new HttpError(
      400,
      "validation_error",
      "Login dan password wajib diisi.",
    );

  let email = login;
  if (!login.includes("@")) {
    const profile = dataOrThrow<any>(
      await service
        .from("profiles")
        .select("id")
        .eq("username", login)
        .maybeSingle(),
    );
    if (!profile)
      throw new HttpError(
        401,
        "invalid_credentials",
        "Login atau password salah.",
      );
    const { data, error } = await service.auth.admin.getUserById(profile.id);
    if (error || !data.user?.email) {
      throw new HttpError(
        401,
        "invalid_credentials",
        "Login atau password salah.",
      );
    }
    email = data.user.email;
  }
  const { data, error } = await publicClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user || !data.session) {
    throw new HttpError(
      401,
      "invalid_credentials",
      "Login atau password salah.",
    );
  }
  const profile = dataOrThrow<any>(
    await service
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single(),
  );
  if (
    !["admin", "super_admin"].includes(profile.role) ||
    profile.status !== "active"
  ) {
    await service.auth.admin.signOut(data.session.access_token, "global");
    throw new HttpError(403, "forbidden", "Akun bukan admin aktif.");
  }
  await service
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);
  return json(request, tokenPair(data.session));
}

async function studentLogin(request: Request) {
  const input = await body(request);
  const code = String(input.code ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
    throw new HttpError(401, "invalid_credentials", "Kode login tidak valid.");
  }
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown")
    .split(",")[0]
    .trim();
  const digest = async (value: string) => {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return `\\x${[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  };
  const ipHash = await digest(ip);
  const codeLookup = await digest(code);
  const limited = dataOrThrow<boolean>(
    await service.rpc("student_login_is_rate_limited", {
      p_code: code,
      p_ip_hash: ipHash,
    }),
  );
  if (limited)
    throw new HttpError(
      429,
      "rate_limited",
      "Terlalu banyak percobaan login. Coba lagi nanti.",
    );

  const verified = dataOrThrow<any[]>(
    await service.rpc("verify_student_code", { p_code: code }),
  );
  const match = verified[0];
  if (!match) {
    await service.from("student_login_attempts").insert({
      code_lookup: codeLookup,
      ip_hash: ipHash,
      succeeded: false,
      failure_reason: "invalid_code",
    });
    throw new HttpError(401, "invalid_credentials", "Kode login tidak valid.");
  }

  const { data: authUser, error: userError } =
    await service.auth.admin.getUserById(match.auth_user_id);
  if (userError || !authUser.user?.email) {
    throw new HttpError(401, "invalid_credentials", "Kode login tidak valid.");
  }
  const update = await service.auth.admin.updateUserById(match.auth_user_id, {
    password: code,
  });
  if (update.error) failFromDb(update.error);
  const { data: signedIn, error: signInError } =
    await publicClient().auth.signInWithPassword({
      email: authUser.user.email,
      password: code,
    });
  if (signInError || !signedIn.session) {
    throw new HttpError(
      401,
      "session_unavailable",
      "Sesi peserta tidak dapat dibuat.",
    );
  }
  await service.from("student_login_attempts").insert({
    code_lookup: codeLookup,
    ip_hash: ipHash,
    succeeded: true,
  });
  await service
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", match.auth_user_id);
  const student = dataOrThrow<any>(
    await service
      .from("students")
      .select("*")
      .eq("id", match.student_id)
      .single(),
  );
  return json(request, {
    student: mapStudent(student),
    tokens: tokenPair(signedIn.session),
  });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const v1Index = url.pathname.indexOf("/v1/");
  const path = v1Index >= 0 ? url.pathname.slice(v1Index) : url.pathname;
  const method = request.method.toUpperCase();

  if (method === "POST" && path === "/v1/admin/auth/login")
    return adminLogin(request);
  if (method === "POST" && path === "/v1/student/auth/login")
    return studentLogin(request);
  if (method === "POST" && path === "/v1/auth/refresh") {
    const input = await body(request);
    const { data, error } = await publicClient().auth.refreshSession({
      refresh_token: String(input.refreshToken ?? ""),
    });
    if (error || !data.session)
      throw new HttpError(
        401,
        "invalid_refresh_token",
        "Refresh token tidak valid.",
      );
    return json(request, tokenPair(data.session));
  }
  if (method === "POST" && path === "/v1/auth/logout") {
    const auth = await actor(request);
    const { error } = await service.auth.admin.signOut(auth.token, "global");
    if (error) throw new HttpError(400, "logout_failed", error.message);
    return noContent(request);
  }

  if (path === "/v1/admin/students" && method === "GET") {
    await actor(request, ["admin", "super_admin"]);
    let query = service.from("students").select("*", { count: "exact" });
    const search = url.searchParams.get("search")?.trim();
    const level = url.searchParams.get("level");
    const phase = url.searchParams.get("phase");
    const grade = url.searchParams.get("grade");
    const status = url.searchParams.get("status");
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit") ?? 100)),
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    if (search) query = query.ilike("name", `%${search.replace(/[%,]/g, "")}%`);
    if (level) query = query.eq("level", level);
    if (phase) query = query.eq("phase", phase);
    if (grade) query = query.eq("grade", Number(grade));
    if (status) query = query.eq("status", status);
    const result = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (result.error) failFromDb(result.error);
    const rows: any[] = result.data ?? [];
    const credentials = rows.length
      ? dataOrThrow<any[]>(
          await service
            .from("student_credentials")
            .select("student_id,code_hint")
            .in(
              "student_id",
              rows.map((row: any) => row.id),
            )
            .is("revoked_at", null),
        )
      : [];
    return json(
      request,
      rows.map((row: any) =>
        mapStudent(
          row,
          credentials.find((item) => item.student_id === row.id)?.code_hint,
        ),
      ),
      200,
      { total: result.count ?? rows.length, limit, offset },
    );
  }

  if (path === "/v1/admin/students" && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const name = String(input.name ?? "").trim();
    const level = String(input.level ?? "");
    const grade = Number(input.grade);
    if (
      !name ||
      !["SD", "SMP", "SMA"].includes(level) ||
      !Number.isInteger(grade)
    ) {
      throw new HttpError(
        400,
        "validation_error",
        "Nama, jenjang, dan kelas wajib valid.",
      );
    }
    const email = `student-${crypto.randomUUID()}@students.ruanguji.invalid`;
    const password = `${crypto.randomUUID()}Aa9!`;
    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (created.error || !created.data.user) {
      throw new HttpError(
        400,
        "student_auth_create_failed",
        created.error?.message ?? "Akun peserta gagal dibuat.",
      );
    }
    const authId = created.data.user.id;
    try {
      const student = dataOrThrow<any>(
        await service
          .from("students")
          .insert({
            auth_user_id: authId,
            name,
            level,
            grade,
            notes: input.notes ? String(input.notes) : null,
            birth_place: input.birthPlace ? String(input.birthPlace) : null,
            birth_date: input.birthDate || null,
            created_by: auth.user.id,
          })
          .select("*")
          .single(),
      );
      const loginCode = dataOrThrow<string>(
        await service.rpc("rotate_student_code", {
          p_student_id: student.id,
          p_actor_id: auth.user.id,
        }),
      );
      return json(
        request,
        { student: mapStudent(student, loginCode.slice(-2)), loginCode },
        201,
      );
    } catch (cause) {
      await service.from("students").delete().eq("auth_user_id", authId);
      await service.auth.admin.deleteUser(authId);
      throw cause;
    }
  }

  let match = path.match(/^\/v1\/admin\/students\/([^/]+)$/);
  if (match && method === "PATCH") {
    await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const patch: Record<string, unknown> = {};
    const fields: Record<string, string> = {
      name: "name",
      birthPlace: "birth_place",
      birthDate: "birth_date",
      level: "level",
      grade: "grade",
      notes: "notes",
      status: "status",
    };
    for (const [source, target] of Object.entries(fields)) {
      if (source in input)
        patch[target] = input[source] === "" ? null : input[source];
    }
    const student = dataOrThrow<any>(
      await service
        .from("students")
        .update(patch)
        .eq("id", match[1])
        .select("*")
        .single(),
    );
    return json(request, mapStudent(student));
  }

  match = path.match(/^\/v1\/admin\/students\/([^/]+)\/regenerate-code$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const loginCode = dataOrThrow<string>(
      await service.rpc("rotate_student_code", {
        p_student_id: match[1],
        p_actor_id: auth.user.id,
      }),
    );
    return json(request, { loginCode });
  }

  if (path === "/v1/admin/exams" && method === "GET") {
    await actor(request, ["admin", "super_admin"]);
    let query = service
      .from("exams")
      .select("*")
      .order("updated_at", { ascending: false });
    const status = url.searchParams.get("status");
    if (status) query = query.eq("status", status);
    const rows = dataOrThrow<any[]>(await query);
    return json(request, await examsWithCounts(rows));
  }

  if (path === "/v1/admin/exams" && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const examValues = {
      name: String(input.name ?? "").trim(),
      description_doc: input.descriptionDoc ?? { type: "doc", content: [] },
      duration_seconds: Number(input.durationSeconds),
      target_level: input.targetLevel || null,
      target_grades: input.targetGrades ?? [],
      grading_mode: input.gradingMode,
      shuffle_questions: input.shuffleQuestions ?? input.shuffleOptions ?? true,
      created_by: auth.user.id,
    };
    const exam = dataOrThrow<any>(
      await auth.client.from("exams").insert(examValues).select("*").single(),
    );
    // Migration memasang trigger exams_create_initial_draft, sehingga insert exam
    // otomatis membuat exam_versions versi 1.
    return json(request, mapExam(exam), 201);
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)$/);
  if (match && method === "PATCH") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const fields: Record<string, string> = {
      name: "name",
      descriptionDoc: "description_doc",
      durationSeconds: "duration_seconds",
      targetLevel: "target_level",
      targetGrades: "target_grades",
      gradingMode: "grading_mode",
      shuffleQuestions: "shuffle_questions",
      shuffleOptions: "shuffle_questions",
    };
    const patch: Record<string, unknown> = {};
    for (const [source, target] of Object.entries(fields))
      if (source in input) patch[target] = input[source];
    const currentExam = dataOrThrow<any>(
      await auth.client
        .from("exams")
        .select("status")
        .eq("id", match[1])
        .single(),
    );
    const existingDraft = dataOrThrow<any>(
      await auth.client
        .from("exam_versions")
        .select("id")
        .eq("exam_id", match[1])
        .eq("status", "draft")
        .maybeSingle(),
    );
    if (!existingDraft && currentExam.status === "published") {
      dataOrThrow<string>(
        await auth.client.rpc("create_exam_draft", { p_exam_id: match[1] }),
      );
    }
    const exam = dataOrThrow<any>(
      await auth.client
        .from("exams")
        .update(patch)
        .eq("id", match[1])
        .select("*")
        .single(),
    );
    return json(request, (await examsWithCounts([exam]))[0]);
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/questions$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const draft = dataOrThrow<any>(
      await auth.client
        .from("exam_versions")
        .select("id")
        .eq("exam_id", match[1])
        .eq("status", "draft")
        .single(),
    );
    const question = dataOrThrow<any>(
      await auth.client
        .from("questions")
        .insert({
          exam_version_id: draft.id,
          type: input.type,
          content_doc: input.contentDoc,
          weight: input.weight ?? 1,
          position: input.position,
          shuffle_options: input.shuffleOptions ?? false,
        })
        .select("*")
        .single(),
    );
    const options = Array.isArray(input.options) ? input.options : [];
    let savedOptions: any[] = [];
    if (options.length) {
      savedOptions = dataOrThrow<any[]>(
        await auth.client
          .from("question_options")
          .insert(
            options.map((option: any, index: number) => ({
              question_id: question.id,
              content_doc: option.contentDoc,
              position: option.position ?? index + 1,
            })),
          )
          .select("*"),
      );
      const correctIndex = options.findIndex((option: any) => option.isCorrect);
      if (correctIndex >= 0) {
        await dataOrThrow<any>(
          await auth.client.from("question_option_keys").insert({
            question_id: question.id,
            correct_option_id: savedOptions[correctIndex].id,
          }),
        );
      }
    }
    const accepted = Array.isArray(input.acceptedAnswers)
      ? input.acceptedAnswers
      : [];
    for (const acceptedAnswer of accepted) {
      const raw = String(acceptedAnswer.raw ?? "").trim();
      if (!raw) continue;
      const answerType = input.type === "numeric" ? "numeric" : "short_text";
      const rpcName =
        answerType === "numeric"
          ? "normalize_numeric_answer"
          : "normalize_short_answer";
      const normalized = dataOrThrow<string>(
        await auth.client.rpc(rpcName, { p_value: raw }),
      );
      await dataOrThrow<any>(
        await auth.client.from("accepted_answers").insert({
          question_id: question.id,
          answer_type: answerType,
          raw_answer: raw,
          normalized_answer: normalized,
        }),
      );
    }
    const correct = options.findIndex((option: any) => option.isCorrect);
    return json(
      request,
      mapQuestion(
        question,
        match[1],
        savedOptions,
        correct >= 0 ? savedOptions[correct]?.id : undefined,
      ),
      201,
    );
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/publish$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    dataOrThrow<any>(
      await auth.client.rpc("publish_exam", { p_exam_id: match[1] }),
    );
    const exam = dataOrThrow<any>(
      await service.from("exams").select("*").eq("id", match[1]).single(),
    );
    return json(request, (await examsWithCounts([exam]))[0]);
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/assignments$/);
  if (match && method === "POST") {
    const examId = match[1];
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const ids = [
      ...new Set(
        (Array.isArray(input.studentIds) ? input.studentIds : []).map(String),
      ),
    ];
    if (!ids.length) return json(request, { assigned: 0 });
    const existing = dataOrThrow<any[]>(
      await service
        .from("exam_assignments")
        .select("student_id")
        .eq("exam_id", examId)
        .in("student_id", ids)
        .is("revoked_at", null),
    );
    const existingIds = new Set(existing.map((row) => row.student_id));
    const inserts = ids
      .filter((id) => !existingIds.has(id))
      .map((studentId) => ({
        exam_id: examId,
        student_id: studentId,
        assigned_by: auth.user.id,
      }));
    if (inserts.length)
      dataOrThrow<any>(
        await auth.client.from("exam_assignments").insert(inserts),
      );
    return json(request, { assigned: inserts.length });
  }

  if (path === "/v1/student/exams" && method === "GET") {
    const auth = await actor(request, ["student"]);
    const student = await studentForUser(auth.user.id);
    const assignments = dataOrThrow<any[]>(
      await service
        .from("exam_assignments")
        .select("exam_id")
        .eq("student_id", student.id)
        .is("revoked_at", null),
    );
    if (!assignments.length) return json(request, []);
    const exams = dataOrThrow<any[]>(
      await service
        .from("exams")
        .select("*")
        .in(
          "id",
          assignments.map((row) => row.exam_id),
        )
        .eq("status", "published"),
    );
    return json(request, await examsWithCounts(exams));
  }

  match = path.match(/^\/v1\/student\/exams\/([^/]+)\/attempts$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["student"]);
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
    const controllerId =
      request.headers.get("X-Controller-Session-Id") ?? crypto.randomUUID();
    const attemptId = dataOrThrow<string>(
      await auth.client.rpc("start_exam_attempt", {
        p_exam_id: match[1],
        p_idempotency_key: idempotencyKey,
        p_controller_session_id: controllerId,
      }),
    );
    return json(request, await attemptSnapshot(attemptId), 201);
  }

  match = path.match(/^\/v1\/student\/attempts\/([^/]+)$/);
  if (match && method === "GET") {
    const auth = await actor(request, ["student"]);
    await assertAttemptAccess(match[1], auth);
    return json(request, await attemptSnapshot(match[1]));
  }

  match = path.match(/^\/v1\/student\/attempts\/([^/]+)\/answers\/([^/]+)$/);
  if (match && method === "PUT") {
    const auth = await actor(request, ["student"]);
    const access = await assertAttemptAccess(match[1], auth);
    const input = await body(request);
    const controllerId =
      request.headers.get("X-Controller-Session-Id") ??
      access.attempt.controller_session_id;
    const answer = dataOrThrow<any>(
      await auth.client.rpc("save_attempt_answer", {
        p_attempt_id: match[1],
        p_question_id: match[2],
        p_selected_option_id: input.selectedOptionId ?? null,
        p_text_raw: input.textRaw ?? null,
        p_expected_version: Number(input.version ?? 0),
        p_controller_session_id: controllerId,
      }),
    );
    if (!answer)
      throw new HttpError(409, "attempt_expired", "Waktu ujian telah habis.");
    return json(request, mapAnswer(answer));
  }

  match = path.match(/^\/v1\/student\/attempts\/([^/]+)\/heartbeat$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["student"]);
    const access = await assertAttemptAccess(match[1], auth);
    const controllerId =
      request.headers.get("X-Controller-Session-Id") ??
      access.attempt.controller_session_id;
    const clientSeq = Number(request.headers.get("X-Client-Seq") ?? Date.now());
    const state = dataOrThrow<any[]>(
      await auth.client.rpc("heartbeat_attempt", {
        p_attempt_id: match[1],
        p_controller_session_id: controllerId,
        p_client_seq: clientSeq,
        p_visibility: "visible",
      }),
    );
    const row = state[0];
    return json(request, {
      status: row.status,
      remainingSeconds: row.remaining_seconds,
      serverTime: row.server_time,
    });
  }

  match = path.match(/^\/v1\/student\/attempts\/([^/]+)\/submit$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["student"]);
    await assertAttemptAccess(match[1], auth);
    dataOrThrow<any>(
      await auth.client.rpc("submit_attempt", { p_attempt_id: match[1] }),
    );
    return json(request, await attemptSnapshot(match[1]));
  }

  match = path.match(/^\/v1\/student\/attempts\/([^/]+)\/result$/);
  if (match && method === "GET") {
    const auth = await actor(request, ["student"]);
    const access = await assertAttemptAccess(match[1], auth);
    if (!["submitted", "time_expired"].includes(access.attempt.status)) {
      throw new HttpError(409, "result_unavailable", "Ujian belum selesai.");
    }
    const snapshot = await attemptSnapshot(match[1]);
    if (!["auto_scored", "released"].includes(access.attempt.grading_status))
      delete snapshot.score;
    return json(request, snapshot);
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/monitoring$/);
  if (match && method === "GET") {
    await actor(request, ["admin", "super_admin"]);
    const assignments = dataOrThrow<any[]>(
      await service
        .from("exam_assignments")
        .select("id,student_id")
        .eq("exam_id", match[1]),
    );
    if (!assignments.length) return json(request, []);
    const attempts = dataOrThrow<any[]>(
      await service
        .from("attempts")
        .select("*")
        .in(
          "assignment_id",
          assignments.map((row) => row.id),
        )
        .eq("is_current", true),
    );
    const students = dataOrThrow<any[]>(
      await service
        .from("students")
        .select("*")
        .in(
          "id",
          assignments.map((row) => row.student_id),
        ),
    );
    const result = [];
    for (const attempt of attempts) {
      const assignment = assignments.find(
        (item) => item.id === attempt.assignment_id,
      );
      const answered = dataOrThrow<any[]>(
        await service.from("answers").select("id").eq("attempt_id", attempt.id),
      );
      const questions = dataOrThrow<any[]>(
        await service
          .from("attempt_questions")
          .select("question_id")
          .eq("attempt_id", attempt.id),
      );
      result.push({
        attempt: {
          ...(await attemptSnapshot(attempt.id)),
          questions: undefined,
          answers: undefined,
        },
        student: mapStudent(
          students.find((item) => item.id === assignment.student_id),
        ),
        answeredCount: answered.length,
        questionCount: questions.length,
        lastActivity: attempt.last_heartbeat_at ?? attempt.updated_at,
      });
    }
    return json(request, result);
  }

  match = path.match(/^\/v1\/admin\/attempts\/([^/]+)\/disqualify$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    dataOrThrow<any>(
      await auth.client.rpc("disqualify_attempt", {
        p_attempt_id: match[1],
        p_reason: String(input.reason ?? ""),
      }),
    );
    return json(request, await attemptSnapshot(match[1]));
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/reviews$/);
  if (match && method === "GET") {
    await actor(request, ["admin", "super_admin"]);
    const assignments = dataOrThrow<any[]>(
      await service
        .from("exam_assignments")
        .select("id,student_id")
        .eq("exam_id", match[1]),
    );
    if (!assignments.length) return json(request, []);
    const attempts = dataOrThrow<any[]>(
      await service
        .from("attempts")
        .select("*")
        .in(
          "assignment_id",
          assignments.map((row) => row.id),
        )
        .in("grading_status", [
          "pending_review",
          "in_review",
          "reviewed",
          "released",
        ])
        .order("submitted_at"),
    );
    const students = dataOrThrow<any[]>(
      await service
        .from("students")
        .select("*")
        .in(
          "id",
          assignments.map((row) => row.student_id),
        ),
    );
    const rows = [];
    for (const attempt of attempts) {
      const assignment = assignments.find(
        (item) => item.id === attempt.assignment_id,
      );
      const results = dataOrThrow<any[]>(
        await service
          .from("attempt_question_results")
          .select("final_verdict")
          .eq("attempt_id", attempt.id),
      );
      rows.push({
        attempt: {
          ...(await attemptSnapshot(attempt.id)),
          questions: undefined,
          answers: undefined,
        },
        student: mapStudent(
          students.find((item) => item.id === assignment.student_id),
        ),
        reviewedCount: results.filter((item) => item.final_verdict).length,
        questionCount: results.length,
      });
    }
    return json(request, rows);
  }

  match = path.match(/^\/v1\/admin\/attempts\/([^/]+)\/review$/);
  if (match && method === "GET") {
    const auth = await actor(request, ["admin", "super_admin"]);
    await assertAttemptAccess(match[1], auth, true);
    return json(request, await attemptSnapshot(match[1], true, true));
  }

  match = path.match(/^\/v1\/admin\/answers\/([^/]+)\/review$/);
  if (match && method === "PUT") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    let answer = dataOrThrow<any>(
      await service
        .from("answers")
        .select("*")
        .eq("id", match[1])
        .maybeSingle(),
    );
    let attemptId: string;
    let questionId: string;
    if (answer) {
      attemptId = answer.attempt_id;
      questionId = answer.question_id;
    } else {
      const separator = match[1].indexOf(":");
      if (separator < 0)
        throw new HttpError(
          404,
          "answer_not_found",
          "Jawaban tidak ditemukan.",
        );
      attemptId = match[1].slice(0, separator);
      questionId = match[1].slice(separator + 1);
    }
    const result = dataOrThrow<any>(
      await auth.client.rpc("review_attempt_question", {
        p_attempt_id: attemptId,
        p_question_id: questionId,
        p_verdict: input.verdict,
        p_expected_revision: Number(input.revision ?? 0),
        p_note: input.note ?? null,
      }),
    );
    if (!answer) answer = null;
    return json(request, mapAnswer(answer, result, { attemptId, questionId }));
  }

  match = path.match(/^\/v1\/admin\/attempts\/([^/]+)\/release-result$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    dataOrThrow<any>(
      await auth.client.rpc("release_attempt_result", {
        p_attempt_id: match[1],
      }),
    );
    return json(request, await attemptSnapshot(match[1], true, true));
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/release-results$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const ids = dataOrThrow<string[]>(
      await auth.client.rpc("release_exam_results", { p_exam_id: match[1] }),
    );
    return json(
      request,
      await Promise.all(ids.map((id) => attemptSnapshot(id, true, true))),
    );
  }

  match = path.match(/^\/v1\/admin\/exams\/([^/]+)\/leaderboards$/);
  if (match && method === "POST") {
    const auth = await actor(request, ["admin", "super_admin"]);
    const input = await body(request);
    const segmentType = String(input.segmentType ?? "all");
    const rawValue =
      input.segmentValue == null ? null : String(input.segmentValue);
    const segmentValue = segmentType === "all" ? null : rawValue;
    const leaderboardId = dataOrThrow<string>(
      await auth.client.rpc("generate_leaderboard", {
        p_exam_id: match[1],
        p_segment_type: segmentType,
        p_segment_value: segmentValue,
      }),
    );
    const entries = dataOrThrow<any[]>(
      await service
        .from("leaderboard_entries")
        .select("*")
        .eq("leaderboard_id", leaderboardId)
        .order("rank"),
    );
    return json(request, {
      id: leaderboardId,
      entries: entries.map((entry) => ({
        rank: entry.rank,
        studentId: entry.student_id,
        studentName: entry.student_name_snapshot,
        score: Number(entry.score),
        durationSeconds: entry.active_duration_seconds,
      })),
    });
  }

  throw new HttpError(
    404,
    "route_not_found",
    `Route ${method} ${path} tidak ditemukan.`,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  try {
    return await handle(request);
  } catch (cause) {
    return errorResponse(request, cause);
  }
});
