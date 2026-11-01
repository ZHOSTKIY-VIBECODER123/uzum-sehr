// Бэкенд статического демо: настоящая миграция в Postgres (PGlite) прямо в браузере и те же адреса, что у Supabase.
// Данные живут только в браузере посетителя. В сборке для Supabase этот код не загружается и не выполняется.
const DB_NAME = "uzum-sehr-demo-v1";
const DEV_CODE = "000000";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Claims = { sub: string; email: string; role: string; aud: string; exp: number };
type User = { id: string; email: string };
type Tx = { query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };
type Db = Tx & {
  waitReady: Promise<void>;
  exec: (sql: string) => Promise<unknown>;
  transaction: <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

const SEEDED_ACTIVE = 36;
const SEEDED_FULFILLED = 6;

async function sql(name: string) {
  const response = await fetch(`${BASE}/demo/sql/${name}`);
  if (!response.ok) throw new Error(`Не удалось загрузить ${name}`);
  return response.text();
}

// Ёлка не должна быть пустой при первом показе, поэтому часть лампочек уже горит.
async function seed(db: Db) {
  await db.exec(await sql("supabase-stub.sql"));
  await db.exec(await sql("0001_init.sql"));
  await db.exec(await sql("seed_demo.sql"));
  await db.exec(`
    create table public.demo_files (bucket text, path text, type text, bytes bytea, primary key (bucket, path));
    revoke all on public.demo_files from anon, authenticated;
    insert into public.admins (email, role) values ('admin@example.com', 'super_admin'), ('manager@example.com', 'admin');
    insert into auth.users (id, email, email_confirmed_at)
      values ('00000000-0000-4000-8000-000000000001', 'volunteer@example.com', now());
  `);
  await db.query(
    `with picked as (
       select id, row_number() over (order by bulb_no) as n
       from public.wishes where bulb_no % 3 = 1 order by bulb_no limit $1
     ), marked as (
       update public.wishes w set status = case when p.n <= $2 then 'fulfilled'::public.wish_status else 'booked'::public.wish_status end
       from picked p where w.id = p.id returning w.id, w.status
     )
     insert into public.bookings (wish_id, user_id, state, expires_at, fulfilled_at)
     select id, '00000000-0000-4000-8000-000000000001',
       case when status = 'fulfilled' then 'fulfilled'::public.booking_state else 'active'::public.booking_state end,
       case when status = 'booked' then now() + interval '14 days' end,
       case when status = 'fulfilled' then now() end
     from marked`,
    [SEEDED_ACTIVE + SEEDED_FULFILLED, SEEDED_FULFILLED],
  );
}

let opening: Promise<Db> | undefined;

const wipe = () =>
  new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(`/pglite/${DB_NAME}`);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });

async function start(): Promise<Db> {
  // Модуль загружается браузером напрямую: сборщику не нужно разбирать wasm-файлы PGlite.
  const { PGlite } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/demo/pglite/index.js`)) as {
    PGlite: new (path: string, options: object) => Db;
  };
  // Без relaxedDurability запись завершается до ответа: страница может перезагрузиться сразу после входа.
  const db = new PGlite(`idb://${DB_NAME}`, {});
  await db.waitReady;
  const { rows } = await db.query<{ ready: boolean }>(`select to_regclass('public.demo_files') is not null as ready`);
  if (!rows[0].ready) await seed(db);
  return db;
}

// База могла остаться неполной, если вкладку закрыли при первом запуске. Тогда создаём её заново.
async function open(): Promise<Db> {
  try {
    return await start();
  } catch {
    await wipe();
    return start();
  }
}

function database() {
  opening ??= Promise.race([
    open(),
    new Promise<Db>((_, reject) => setTimeout(() => reject(new Error("База демо не запустилась. Начните заново.")), 60000)),
  ]);
  return opening;
}

export async function resetDemo() {
  try {
    if (opening) await (await opening).close();
  } catch {
    // База могла не открыться, и именно поэтому её сбрасывают.
  }
  opening = undefined;
  await wipe();
}

const b64 = (value: string) => btoa(unescape(encodeURIComponent(value))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const unb64 = (value: string) => decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/"))));

function issueSession(user: User) {
  const ttl = 60 * 60 * 24 * 30;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const body = `${b64(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64(
    JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp }),
  )}`;
  return {
    access_token: `${body}.demo`,
    token_type: "bearer",
    expires_in: ttl,
    expires_at: exp,
    refresh_token: b64(JSON.stringify(user)),
    user: authUser(user),
  };
}

function authUser(user: User) {
  const now = new Date().toISOString();
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: now,
    app_metadata: { provider: "email" },
    user_metadata: {},
    identities: [],
    created_at: now,
  };
}

function readClaims(header: string | null): Claims | null {
  const token = header?.replace(/^Bearer\s+/i, "");
  const parts = token?.split(".");
  if (!parts || parts.length !== 3 || parts[2] !== "demo") return null;
  const claims = JSON.parse(unb64(parts[1])) as Claims;
  return claims.exp < Date.now() / 1000 ? null : claims;
}

async function asRole<T>(claims: Claims | null, work: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await database();
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${claims ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify(claims) : ""]);
    return work(tx);
  });
}

async function callRpc(name: string, args: Record<string, unknown>, claims: Claims | null) {
  const db = await database();
  const { rows: procs } = await db.query<{ arg: string; type: string }>(
    `select unnest(proargnames) as arg, format_type(unnest(proargtypes::oid[]), null) as type
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = $1`,
    [name],
  );
  const provided = procs.filter((p) => p.arg in args);
  const named = provided.map((p, i) => `${p.arg} => $${i + 1}::${p.type}`).join(", ");
  const values = provided.map((p) => (p.type === "jsonb" ? JSON.stringify(args[p.arg]) : args[p.arg]));
  return asRole(claims, async (tx) => {
    const res = await tx.query<{ r: unknown }>(`select public.${name}(${named}) as r`, values);
    return res.rows[0]?.r ?? null;
  });
}

const json = (status: number, payload?: unknown) =>
  new Response(payload === undefined ? null : JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

async function handleStorage(method: string, url: URL, claims: Claims | null, init?: RequestInit) {
  const parts = url.pathname.replace("/storage/v1/", "").split("/").map(decodeURIComponent);
  const db = await database();

  if (parts[0] === "object" && parts[1] === "sign" && method === "POST") {
    const [, , bucket, ...rest] = parts;
    const path = rest.join("/");
    const allowed = await asRole(claims, async (tx) => {
      const res = await tx.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, path]);
      return res.rows.length > 0;
    });
    if (!allowed) return json(400, { message: "Object not found", statusCode: "404" });
    return json(200, { signedURL: `/object/sign/${bucket}/${rest.join("/")}?token=demo` });
  }

  if (parts[0] === "object" && (method === "POST" || method === "PUT")) {
    const [, bucket, ...rest] = parts;
    const path = rest.join("/");
    let file: Blob | null = null;
    if (init?.body instanceof FormData) {
      file = [...init.body.values()].find((v): v is File => typeof v !== "string") ?? null;
    } else if (init?.body instanceof Blob) {
      file = init.body;
    }
    if (!file) return json(400, { message: "Файл не передан" });
    await asRole(claims, (tx) =>
      tx.query(
        `insert into storage.objects (bucket_id, name, content_type) values ($1, $2, $3)
         on conflict (bucket_id, name) do update set content_type = excluded.content_type`,
        [bucket, path, file.type],
      ),
    );
    await db.query(
      `insert into public.demo_files (bucket, path, type, bytes) values ($1, $2, $3, $4)
       on conflict (bucket, path) do update set type = excluded.type, bytes = excluded.bytes`,
      [bucket, path, file.type || "application/octet-stream", new Uint8Array(await file.arrayBuffer())],
    );
    return json(200, { Id: crypto.randomUUID(), Key: `${bucket}/${path}` });
  }

  if (parts[0] === "object" && method === "DELETE") {
    const bucket = parts[1];
    const { prefixes = [] } = JSON.parse(String(init?.body ?? "{}")) as { prefixes?: string[] };
    await asRole(claims, (tx) => tx.query(`delete from storage.objects where bucket_id = $1 and name = any($2::text[])`, [bucket, prefixes]));
    await db.query(`delete from public.demo_files where bucket = $1 and path = any($2::text[])`, [bucket, prefixes]);
    return json(200, prefixes.map((name) => ({ name })));
  }

  return json(404, { message: "not_found" });
}

// Подменяет fetch клиента Supabase. Сеть не используется.
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = (init?.method ?? "GET").toUpperCase();
  const claims = readClaims(new Headers(init?.headers).get("authorization"));
  const body = () => JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;

  try {
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      return json(200, await callRpc(url.pathname.split("/").pop()!, body(), claims));
    }
    if (url.pathname === "/auth/v1/otp") return json(200, {});
    if (url.pathname === "/auth/v1/verify") {
      const { email, token } = body();
      if (token !== DEV_CODE) return json(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      const db = await database();
      const { rows } = await db.query<User>(
        `insert into auth.users (email, email_confirmed_at) values ($1, now())
         on conflict (email) do update set email_confirmed_at = coalesce(auth.users.email_confirmed_at, now())
         returning id, email`,
        [email.toLowerCase()],
      );
      return json(200, issueSession(rows[0]));
    }
    if (url.pathname === "/auth/v1/token") {
      return json(200, issueSession(JSON.parse(unb64(body().refresh_token)) as User));
    }
    if (url.pathname === "/auth/v1/user") {
      if (!claims) return json(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      return json(200, authUser({ id: claims.sub, email: claims.email }));
    }
    if (url.pathname === "/auth/v1/logout") return json(204);
    if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(method, url, claims, init);
    return json(404, { message: "not_found" });
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    return json(400, { code: failure.code ?? "P0001", message: failure.message ?? "demo_error", details: null, hint: null });
  }
}

// Браузер не может запросить файл через подменённый fetch, поэтому отдаём его как blob-ссылку.
export async function demoFileUrl(bucket: string, path: string): Promise<string | null> {
  const db = await database();
  const { rows } = await db.query<{ type: string; bytes: Uint8Array }>(`select type, bytes from public.demo_files where bucket = $1 and path = $2`, [bucket, path]);
  if (!rows[0]) return null;
  return URL.createObjectURL(new Blob([rows[0].bytes as BlobPart], { type: rows[0].type }));
}
