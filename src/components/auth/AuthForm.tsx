"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

type Props = {
  next?: string;
  tone?: "dark" | "light";
  intro?: string;
  onDone?: () => void;
};

// Вход по почте. Код из письма надёжнее ссылки: корпоративные почтовые сканеры иногда открывают ссылки сами.
export function AuthForm({ next = "/my", tone = "dark", intro, onDone }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const light = tone === "light";
  const input = light
    ? "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-violet"
    : "w-full rounded-xl border border-white/20 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-haze focus:border-lime";
  const muted = light ? "text-ink-soft" : "text-mist";

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    // Берём значение из самого поля: автозаполнение могло сработать до гидратации страницы.
    const address = String(new FormData(event.currentTarget as HTMLFormElement).get("email") ?? "").trim().toLowerCase();
    setEmail(address);
    setBusy(true);
    setError(null);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error: failure } = await supabaseBrowser().auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    setBusy(false);
    if (failure) {
      setError(/rate|limit/i.test(failure.message) ? "Слишком много попыток. Подожди минуту и попробуй снова." : "Не получилось отправить письмо. Проверь адрес почты.");
      return;
    }
    setStep("code");
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failure } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (failure) {
      setError("Код не подошёл или устарел. Проверь его или запроси новый.");
      return;
    }
    onDone?.();
  };

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-3">
        <p className={`text-sm leading-relaxed ${muted}`}>
          {intro ?? "Войди по почте, чтобы твои добрые дела сохранялись за тобой. Пароль не нужен: пришлём код."}
        </p>
        <label className="block">
          <span className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${muted}`}>Почта</span>
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.uz"
            className={input}
          />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="btn-lime flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-extrabold">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
          Получить код
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <button type="button" onClick={() => setStep("email")} className={`flex items-center gap-1.5 text-sm font-semibold ${muted}`}>
        <ArrowLeft size={15} /> Другая почта
      </button>
      <p className={`text-sm leading-relaxed ${muted}`}>
        Отправили код на <b>{email}</b>. Письмо может идти пару минут, проверь и папку «Спам».
      </p>
      <label className="block">
        <span className={`mb-1.5 block text-xs font-bold uppercase tracking-wider ${muted}`}>Код из письма</span>
        <input
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className={`${input} text-center text-xl font-bold tracking-[0.3em]`}
        />
      </label>
      {DEMO && <p className={`text-xs ${muted}`}>Демо-режим: код всегда 000000.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
      <button type="submit" disabled={busy} className="btn-lime flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-extrabold">
        {busy && <Loader2 size={18} className="animate-spin" />}
        Войти
      </button>
    </form>
  );
}
