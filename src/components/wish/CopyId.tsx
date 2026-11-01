"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyId({ value, tone = "light" }: { value: string; tone?: "light" | "dark" }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      setDone(false);
    }
  };

  const light = tone === "light";
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Скопировать ID ${value}`}
      className={`inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 font-mono text-lg font-extrabold tracking-wide transition ${
        light ? "bg-ink text-lime hover:bg-ink/90" : "border border-lime/40 bg-lime/10 text-lime hover:bg-lime/20"
      }`}
    >
      {value}
      {done ? <Check size={18} /> : <Copy size={16} className="opacity-70" />}
    </button>
  );
}
