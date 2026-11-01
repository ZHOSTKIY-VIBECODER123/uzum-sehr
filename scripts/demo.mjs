// Запускает полный локальный стенд: бэкенд и Next.js. Настоящий Supabase не нужен.
import { spawn } from "node:child_process";

const BACKEND = "http://localhost:54399";
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: BACKEND,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-demo-anon-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_DEMO_MODE: "1",
};

const backend = spawn(process.execPath, ["scripts/local-supabase.mjs"], { stdio: "inherit", env });

// Next.js запускаем после бэкенда, иначе первые запросы страниц упадут.
for (let attempt = 0; attempt < 120; attempt += 1) {
  try {
    await fetch(`${BACKEND}/rest/v1/rpc/get_public_content`, { method: "POST", body: "{}" });
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], { stdio: "inherit", env });

const stop = () => {
  backend.kill();
  next.kill();
  process.exit();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
backend.on("exit", stop);
next.on("exit", stop);
