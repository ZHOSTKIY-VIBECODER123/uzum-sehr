// Публикует собранное демо из dist-pages в ветку gh-pages. Сначала выполните npm run build:pages.
// В этой ветке лежит только результат сборки, поэтому её можно перезаписывать.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

if (!existsSync("dist-pages/.nojekyll")) {
  console.error("Нет сборки: сначала выполните npm run build:pages");
  process.exit(1);
}

const origin = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
const git = (...args) => execFileSync("git", args, { cwd: "dist-pages", stdio: ["ignore", "ignore", "inherit"] });

rmSync("dist-pages/.git", { recursive: true, force: true });
git("init", "-q", "-b", "gh-pages");
git("add", "-A");
git("commit", "-q", "-m", "Демо-сборка для GitHub Pages\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>");
git("push", "-q", "--force", origin, "gh-pages");
rmSync("dist-pages/.git", { recursive: true, force: true });
console.log("Опубликовано в ветку gh-pages");
