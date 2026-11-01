import { describe, expect, it } from "vitest";
import { safePath } from "../src/lib/safe-path";

describe("адрес возврата после входа", () => {
  it("пропускает страницы сайта", () => {
    expect(safePath("/admin")).toBe("/admin");
    expect(safePath("/admin/wishes?status=free#top")).toBe("/admin/wishes?status=free#top");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/.//evil.com",
    "/..//evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
  ])("не уводит на чужой адрес: %j", (value) => {
    expect(safePath(value)).toBe("/my");
  });

  it("без адреса ведёт на запасную страницу", () => {
    expect(safePath(null)).toBe("/my");
    expect(safePath(undefined, "/")).toBe("/");
  });
});
