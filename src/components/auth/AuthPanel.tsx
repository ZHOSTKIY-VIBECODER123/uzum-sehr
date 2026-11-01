"use client";

import { safePath } from "@/lib/safe-path";
import { withBase } from "@/lib/supabase/browser";
import { AuthForm } from "./AuthForm";

export function AuthPanel({ next }: { next: string }) {
  const target = safePath(next);
  return <AuthForm next={target} onDone={() => window.location.assign(withBase(target))} />;
}
