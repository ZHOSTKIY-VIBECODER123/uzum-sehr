// Собирает статическое демо для GitHub Pages в папку dist-pages.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const repo = process.env.PAGES_BASE_PATH ?? "/uzum-sehr";

rmSync("public/demo", { recursive: true, force: true });
rmSync("dist-pages", { recursive: true, force: true });
mkdirSync("public/demo/sql", { recursive: true });

for (const file of ["scripts/supabase-stub.sql", "supabase/migrations/0001_init.sql", "supabase/seed_demo.sql"]) {
  cpSync(file, `public/demo/sql/${file.split("/").pop()}`);
}

// Браузеру нужны только сам Postgres и его модули, без расширений и исходных карт.
cpSync("node_modules/@electric-sql/pglite/dist", "public/demo/pglite", {
  recursive: true,
  filter: (source) => !/(\.map|\.tar\.gz|\.cjs|\.d\.ts|\.d\.cts)$|[\\/]contrib([\\/]|$)/.test(source),
});

const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_DEMO: "1",
  NEXT_PUBLIC_DEMO_MODE: "1",
  NEXT_PUBLIC_BASE_PATH: repo,
  NEXT_PUBLIC_SUPABASE_URL: "https://demo.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "demo",
  NEXT_PUBLIC_SITE_URL: "https://demo.invalid",
};
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit", env });
if (result.status !== 0) process.exit(result.status ?? 1);

// Без этого файла GitHub Pages не отдаёт папку _next.
writeFileSync("dist-pages/.nojekyll", "");
console.log("Готово: dist-pages");
