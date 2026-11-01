// Локальная замена Supabase для демо и проверок: настоящая миграция в PGlite и те же HTTP-адреса.
// Вход без письма: код всегда 000000. Для продакшена этот файл не используется.
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54399);
const DEV_CODE = "000000";
const SECRET = "local-demo-only";
const dataDir = join(root, ".local-supabase");
const filesDir = join(dataDir, "files");
const persistent = process.env.LOCAL_SUPABASE_PERSIST !== "0";
mkdirSync(filesDir, { recursive: true });

const b64 = (value) => Buffer.from(value).toString("base64url");
const sign = (body) => createHmac("sha256", SECRET).update(body).digest("base64url");

function issueJwt(user, ttl = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const body = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(
    JSON.stringify({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp }),
  )}`;
  return { token: `${body}.${sign(body)}`, exp, ttl };
}

function readJwt(header) {
  const token = header?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const [head, payload, signature] = token.split(".");
  if (!signature || sign(`${head}.${payload}`) !== signature) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (claims.exp < Date.now() / 1000) return null;
  return claims;
}

const dbPath = join(dataDir, "db");
const firstRun = !persistent || !existsSync(join(dbPath, "PG_VERSION"));
const db = new PGlite(persistent ? dbPath : undefined);
await db.waitReady;

if (firstRun) {
  await db.exec(readFileSync(join(root, "scripts/supabase-stub.sql"), "utf8"));
  await db.exec(readFileSync(join(root, "supabase/migrations/0001_init.sql"), "utf8"));
  await db.exec(`insert into admins (email, role) values
    ('admin@example.com', 'super_admin'), ('manager@example.com', 'admin')`);
  if (process.env.LOCAL_SUPABASE_SEED !== "0") {
    await db.exec(readFileSync(join(root, "supabase/seed_demo.sql"), "utf8"));
  }
}

const refreshTokens = new Map();

function session(user) {
  const { token, exp, ttl } = issueJwt(user);
  const refresh = randomUUID();
  refreshTokens.set(refresh, user);
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: ttl,
    expires_at: exp,
    refresh_token: refresh,
    user: toAuthUser(user),
  };
}

const toAuthUser = (user) => ({
  id: user.id,
  aud: "authenticated",
  role: "authenticated",
  email: user.email,
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
});

async function userByEmail(email) {
  const clean = email.toLowerCase();
  const { rows } = await db.query(
    `insert into auth.users (email, email_confirmed_at) values ($1, now())
     on conflict (email) do update set email_confirmed_at = coalesce(auth.users.email_confirmed_at, now())
     returning id, email`,
    [clean],
  );
  return rows[0];
}

async function asRole(claims, work) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${claims ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify(claims) : ""]);
    return work(tx);
  });
}

async function callRpc(name, args, claims) {
  const { rows: procs } = await db.query(
    `select unnest(proargnames) as arg, format_type(unnest(proargtypes::oid[]), null) as type
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = $1`,
    [name],
  );
  const provided = procs.filter((p) => p.arg in args);
  const named = provided.map((p, i) => `${p.arg} => $${i + 1}::${p.type}`).join(", ");
  const values = provided.map((p) => {
    const value = args[p.arg];
    return p.type === "jsonb" ? JSON.stringify(value) : value;
  });
  return asRole(claims, async (tx) => {
    const res = await tx.query(`select public.${name}(${named}) as r`, values);
    return res.rows[0]?.r ?? null;
  });
}

const objectPath = (bucket, path) => join(filesDir, bucket, ...path.split("/"));

function storedFile(bucket, path) {
  const file = objectPath(bucket, path);
  if (!existsSync(file)) return null;
  return { body: readFileSync(file), type: readFileSync(`${file}.type`, "utf8") };
}

async function canRead(claims, bucket, path) {
  return asRole(claims, async (tx) => {
    const res = await tx.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, path]);
    return res.rows.length > 0;
  });
}

async function handleStorage(req, res, url, claims, body) {
  const parts = url.pathname.replace("/storage/v1/", "").split("/").map(decodeURIComponent);

  if (parts[0] === "object" && parts[1] === "public" && req.method === "GET") {
    const [, , bucket, ...rest] = parts;
    const { rows } = await db.query(`select public from storage.buckets where id = $1`, [bucket]);
    const file = rows[0]?.public ? storedFile(bucket, rest.join("/")) : null;
    if (!file) return send(res, 404, { message: "not_found" });
    res.writeHead(200, { "content-type": file.type, ...cors });
    return res.end(file.body);
  }

  if (parts[0] === "object" && parts[1] === "sign" && req.method === "POST") {
    const [, , bucket, ...rest] = parts;
    const path = rest.join("/");
    if (!(await canRead(claims, bucket, path))) return send(res, 400, { message: "Object not found", statusCode: "404" });
    const exp = Math.floor(Date.now() / 1000) + Number(JSON.parse(body.toString() || "{}").expiresIn ?? 60);
    const token = `${exp}.${sign(`${bucket}/${path}:${exp}`)}`;
    return send(res, 200, { signedURL: `/object/sign/${encodeURIComponent(bucket)}/${rest.map(encodeURIComponent).join("/")}?token=${token}` });
  }

  if (parts[0] === "object" && parts[1] === "sign" && req.method === "GET") {
    const [, , bucket, ...rest] = parts;
    const path = rest.join("/");
    const [exp, signature] = (url.searchParams.get("token") ?? "").split(".");
    const file = Number(exp) > Date.now() / 1000 && signature === sign(`${bucket}/${path}:${exp}`) ? storedFile(bucket, path) : null;
    if (!file) return send(res, 400, { message: "invalid_signature" });
    res.writeHead(200, { "content-type": file.type, ...cors });
    return res.end(file.body);
  }

  if (parts[0] === "object" && (req.method === "POST" || req.method === "PUT")) {
    const [, bucket, ...rest] = parts;
    const path = rest.join("/");
    let data = body;
    let type = req.headers["content-type"] ?? "application/octet-stream";
    if (type.startsWith("multipart/form-data")) {
      const form = await new Response(body, { headers: { "content-type": type } }).formData();
      const file = [...form.values()].find((v) => typeof v !== "string");
      data = Buffer.from(await file.arrayBuffer());
      type = file.type || "application/octet-stream";
    }
    await asRole(claims, (tx) =>
      tx.query(
        `insert into storage.objects (bucket_id, name, content_type) values ($1, $2, $3)
         on conflict (bucket_id, name) do update set content_type = excluded.content_type`,
        [bucket, path, type],
      ),
    );
    const file = objectPath(bucket, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
    writeFileSync(`${file}.type`, type);
    return send(res, 200, { Id: randomUUID(), Key: `${bucket}/${path}` });
  }

  if (parts[0] === "object" && req.method === "DELETE") {
    const bucket = parts[1];
    const { prefixes = [] } = JSON.parse(body.toString() || "{}");
    await asRole(claims, (tx) =>
      tx.query(`delete from storage.objects where bucket_id = $1 and name = any($2::text[])`, [bucket, prefixes]),
    );
    return send(res, 200, prefixes.map((name) => ({ name })));
  }

  return send(res, 404, { message: "not_found" });
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(payload === undefined ? "" : JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const claims = readJwt(req.headers.authorization);

  try {
    if (req.method === "OPTIONS") return send(res, 204);

    if (url.pathname.startsWith("/rest/v1/rpc/") && req.method === "POST") {
      const name = url.pathname.split("/").pop();
      const args = body.length ? JSON.parse(body.toString()) : {};
      return send(res, 200, await callRpc(name, args, claims));
    }

    if (url.pathname === "/auth/v1/otp" && req.method === "POST") {
      const { email } = JSON.parse(body.toString());
      console.log(`[auth] код для ${email}: ${DEV_CODE}`);
      return send(res, 200, {});
    }
    if (url.pathname === "/auth/v1/verify" && req.method === "POST") {
      const { email, token } = JSON.parse(body.toString());
      if (token !== DEV_CODE) {
        return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      }
      return send(res, 200, session(await userByEmail(email)));
    }
    if (url.pathname === "/auth/v1/token" && req.method === "POST") {
      const { refresh_token: refresh } = JSON.parse(body.toString());
      const user = refreshTokens.get(refresh);
      if (!user) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      refreshTokens.delete(refresh);
      return send(res, 200, session(user));
    }
    if (url.pathname === "/auth/v1/user" && req.method === "GET") {
      if (!claims) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      return send(res, 200, toAuthUser({ id: claims.sub, email: claims.email }));
    }
    if (url.pathname === "/auth/v1/logout" && req.method === "POST") return send(res, 204);

    if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(req, res, url, claims, body);

    return send(res, 404, { message: "not_found" });
  } catch (error) {
    if (error.message !== "wish_unavailable") console.error(`[${req.method} ${url.pathname}]`, error.message);
    return send(res, 400, { code: error.code ?? "P0001", message: error.message, details: null, hint: null });
  }
});

server.listen(PORT, () => console.log(`Локальный бэкенд: http://localhost:${PORT} (код входа ${DEV_CODE})`));
