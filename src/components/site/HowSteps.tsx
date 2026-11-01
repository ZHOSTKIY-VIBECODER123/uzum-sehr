"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { HowStep } from "@/lib/types";

const STROKE = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

// Небольшие иллюстрации к шагам: повторяются по кругу, если администратор добавит шаги.
const ILLUSTRATIONS = [
  <svg key="bulb" viewBox="0 0 64 64" className="h-full w-full"><path {...STROKE} d="M32 8v8M12 28c0-11 9-14 20-14s20 3 20 14" opacity=".35" /><path {...STROKE} d="M32 20c-7 0-12 5-12 12 0 5 3 8 5 11 1 2 2 3 2 5h10c0-2 1-3 2-5 2-3 5-6 5-11 0-7-5-12-12-12Z" /><path {...STROKE} d="M28 53h8M29 57h6" /><path {...STROKE} d="M46 12l-3 4M18 12l3 4" opacity=".5" /></svg>,
  <svg key="card" viewBox="0 0 64 64" className="h-full w-full"><rect {...STROKE} x="12" y="12" width="40" height="42" rx="6" /><circle {...STROKE} cx="32" cy="26" r="6" /><path {...STROKE} d="M21 40h22M25 46h14" /><path d="M44 8l1.5 3.5L49 13l-3.5 1.5L44 18l-1.5-3.5L39 13l3.5-1.5z" fill="currentColor" /></svg>,
  <svg key="lit" viewBox="0 0 64 64" className="h-full w-full"><circle cx="32" cy="29" r="20" fill="currentColor" opacity=".16" /><path d="M32 16c-7 0-12 5-12 12 0 5 3 8 5 11 1 2 2 3 2 5h10c0-2 1-3 2-5 2-3 5-6 5-11 0-7-5-12-12-12Z" fill="currentColor" /><path {...STROKE} d="M28 49h8M29 53h6M32 5v5M13 12l3 4M51 12l-3 4M6 28h5M53 28h5" /></svg>,
  <svg key="gift" viewBox="0 0 64 64" className="h-full w-full"><rect {...STROKE} x="12" y="26" width="40" height="28" rx="4" /><path {...STROKE} d="M8 18h48v8H8zM32 18v36M32 18c-4-10-16-10-14-3 1 3 8 3 14 3Zm0 0c4-10 16-10 14-3-1 3-8 3-14 3Z" /><rect x="37" y="36" width="12" height="8" rx="2" fill="currentColor" /></svg>,
  <svg key="tree" viewBox="0 0 64 64" className="h-full w-full"><path {...STROKE} d="M32 6 20 24h6L15 40h8L12 52h40L41 40h8L38 24h6L32 6Z" /><path {...STROKE} d="M32 52v6" /><rect x="42" y="50" width="11" height="9" rx="1.5" fill="currentColor" /><path {...STROKE} d="M47.5 50v9" stroke="#080d27" /></svg>,
];

const STEP_COLORS = ["#b98cff", "#a8f000", "#ffc46b"];

export function HowSteps({ steps, finale }: { steps: HowStep[]; finale: string }) {
  return (
    <div className="relative mt-12 md:mt-16">
      <div className="garland-wire absolute bottom-0 left-[22px] top-2 w-px md:left-1/2" aria-hidden />
      <ol className="space-y-10 md:space-y-16">
        {steps.map((step, i) => {
          const color = STEP_COLORS[i % STEP_COLORS.length];
          const flip = i % 2 === 1;
          return (
            <li key={step.title} className="relative">
              <motion.span
                aria-hidden
                className="absolute left-[22px] top-1 z-10 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full font-display text-sm font-medium text-night md:left-1/2"
                style={{ background: "#2a2547", color: "#ffffff80" }}
                whileInView={{ background: color, color: "#080d27", boxShadow: `0 0 34px 6px ${color}88` }}
                viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
                transition={{ duration: 0.6 }}
              >
                {i + 1}
              </motion.span>
              <motion.div
                className={`ml-[60px] md:ml-0 md:w-[calc(50%-48px)] ${flip ? "md:ml-auto" : ""}`}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
              >
                <div className="glass rounded-3xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color }}>Шаг {i + 1}</p>
                      <h2 className="mt-1.5 text-xl font-extrabold leading-tight md:text-[22px]">{step.title}</h2>
                    </div>
                    <span className="h-14 w-14 shrink-0" style={{ color }} aria-hidden>
                      {ILLUSTRATIONS[i % ILLUSTRATIONS.length]}
                    </span>
                  </div>
                  <p className="prose-lines mt-3 text-[15px] leading-relaxed text-white/80">{step.body}</p>
                  {step.note && (
                    <p className="mt-4 flex gap-2.5 rounded-2xl border border-lime/35 bg-lime/10 p-3.5 text-sm font-bold leading-snug text-lime-soft">
                      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                      {step.note}
                    </p>
                  )}
                </div>
              </motion.div>
            </li>
          );
        })}
      </ol>
      <motion.p
        className="relative mt-14 rounded-3xl bg-gradient-to-br from-plum to-violet/70 px-6 py-9 text-center font-display text-xl font-medium leading-snug md:text-[27px]"
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        {finale}
      </motion.p>
    </div>
  );
}
