"use client";

import { AuthForm } from "./AuthForm";

export function AuthPanel({ next }: { next: string }) {
  return <AuthForm next={next} onDone={() => window.location.assign(next)} />;
}
