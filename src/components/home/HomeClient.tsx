"use client";

import { animate, AnimatePresence, motion } from "framer-motion";
import { Gift, Heart, List, Move3d, RefreshCw, Sparkles, Tag, TreePine } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/site/Header";
import { webglAvailable } from "@/components/tree/tiers";
import { CopyId } from "@/components/wish/CopyId";
import { Sheet, WishSheet } from "@/components/wish/WishSheet";
import { ageLabel } from "@/lib/format";
import { BOOKINGS_EVENT, useTree } from "@/lib/hooks";
import type { BookingResult, Bulb, PublicContent, TreeData, TreeStats } from "@/lib/types";
import { FlatTree } from "./FlatTree";

const TreeScene = dynamic(() => import("@/components/tree/TreeScene"), { ssr: false });

function Counter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(previous.current, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString("ru-RU");
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("ru-RU")}
    </span>
  );
}

function Progress({ stats }: { stats: TreeStats }) {
  const booked = (stats.booked / stats.target) * 100;
  const fulfilled = (stats.fulfilled / stats.target) * 100;
  return (
    <div
      className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/12"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={stats.target}
      aria-valuenow={stats.lit}
      aria-label="Прогресс акции"
    >
      <motion.div className="h-full bg-warm shadow-[0_0_12px_#ffc46b]" animate={{ width: `${fulfilled}%` }} transition={{ duration: 1 }} />
      <motion.div className="h-full bg-lime shadow-[0_0_12px_#a8f000]" animate={{ width: `${booked}%` }} transition={{ duration: 1 }} />
    </div>
  );
}

function pickFree(bulbs: Bulb[], count: number) {
  const free = bulbs.filter((b) => b.status === "free");
  for (let i = free.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, count);
}

type Props = { content: PublicContent; initialTree: TreeData };

export function HomeClient({ content, initialTree }: Props) {
  const { settings } = content;
  const counter = settings.tree.counter;
  const { tree, refresh } = useTree(initialTree);
  const { stats, bulbs } = tree;

  const [selected, setSelected] = useState<Bulb | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [igniteId, setIgniteId] = useState<string | null>(null);
  const [success, setSuccess] = useState<BookingResult | null>(null);
  const [touched, setTouched] = useState(false);
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");
  const [hasWebgl, setHasWebgl] = useState(true);
  const [suggestions, setSuggestions] = useState<Bulb[]>([]);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("sehr:view");
    } catch {
      saved = null;
    }
    const supported = webglAvailable();
    setHasWebgl(supported);
    setMode(!supported || saved === "flat" ? "flat" : "3d");
  }, []);

  const switchMode = (next: "3d" | "flat") => {
    setMode(next);
    try {
      window.localStorage.setItem("sehr:view", next);
    } catch {
      // Режим просто не запомнится.
    }
  };

  const reshuffle = useCallback(() => setSuggestions(pickFree(bulbs, 6)), [bulbs]);
  const freeCount = stats.free;
  useEffect(() => {
    // Подсказки обновляем, только если кого-то из них уже выбрали.
    setSuggestions((current) => {
      const stillFree = current.filter((c) => bulbs.find((b) => b.id === c.id)?.status === "free");
      return stillFree.length === Math.min(6, freeCount) && stillFree.length > 0 ? stillFree : pickFree(bulbs, 6);
    });
  }, [bulbs, freeCount]);

  const open = useCallback((bulb: Bulb) => {
    setTouched(true);
    setSelected(bulb);
  }, []);

  const openFromList = (bulb: Bulb) => {
    setFocusId(bulb.id);
    setListOpen(false);
    open(bulb);
  };

  const onBooked = async (result: BookingResult) => {
    setSelected(null);
    setFocusId(result.wish_id);
    await refresh();
    setIgniteId(result.wish_id);
    window.dispatchEvent(new Event(BOOKINGS_EVENT));
    // Сначала пользователь видит вспышку на ёлке, потом благодарность.
    setTimeout(() => setSuccess(result), mode === "3d" ? 1500 : 300);
  };

  const onInteract = useCallback(() => setTouched(true), []);
  const allLit = stats.total > 0 && stats.free === 0;
  const progress = stats.lit / stats.target;
  const titleLines = settings.general.hero_title.split("\n");

  const selectedId = selected?.id ?? null;
  const sortedFree = useMemo(() => bulbs.filter((b) => b.status === "free"), [bulbs]);
  const mineCount = useMemo(() => bulbs.filter((b) => b.mine).length, [bulbs]);

  return (
    <div className="hero-sky relative h-dvh w-full overflow-hidden">
      <Header title={settings.general.project_title} />

      <div className="absolute inset-0">
        {mode === "3d" && (
          <TreeScene
            bulbs={bulbs}
            target={stats.target}
            progress={progress}
            selectedId={selectedId}
            focusId={focusId}
            igniteId={igniteId}
            onSelect={open}
            onInteract={onInteract}
          />
        )}
        {mode === "flat" && <FlatTree bulbs={bulbs} target={stats.target} onSelect={open} />}
      </div>

      {/* Заголовок над ёлкой */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-[76px] z-10 px-4 text-center md:top-[84px]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15 }}
      >
        <h1 className="font-display text-[23px] font-normal leading-[1.2] tracking-tight [text-shadow:0_2px_30px_#080d27] md:text-[38px]">
          {titleLines.map((line) => (
            <span key={line} className="block">{line}</span>
          ))}
        </h1>
        <p className="mx-auto mt-1.5 max-w-xl text-[12.5px] leading-snug text-mist [text-shadow:0_1px_14px_#080d27] md:mt-2 md:text-[15px] [@media(max-height:700px)]:hidden">
          {settings.general.hero_subtitle}
        </p>

        {/* Счётчик на телефоне */}
        <div className="glass mx-auto mt-2.5 max-w-sm rounded-2xl px-4 py-2 text-left md:hidden">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-mist">{counter.label}</span>
            <span className="font-display text-lg font-medium" data-testid="lit-counter-mobile">
              <Counter value={stats.lit} className="text-lime" />
              <span className="text-sm text-white/50"> / {stats.target}</span>
            </span>
          </div>
          {counter.show_progress && <div className="mt-1"><Progress stats={stats} /></div>}
          {(counter.show_gifts || counter.show_free) && (
            <div className="mt-1 flex justify-between text-[11px] font-semibold text-mist">
              {counter.show_gifts && <span>Передано: <b className="text-white">{stats.fulfilled}</b></span>}
              {counter.show_free && <span>Свободно: <b className="text-white">{stats.free}</b></span>}
            </div>
          )}
        </div>
      </motion.div>

      {/* Счётчик и выбор: слева на компьютере */}
      <motion.aside
        className="absolute bottom-6 left-8 top-24 z-10 hidden w-[292px] flex-col justify-center gap-4 lg:flex"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <div className="glass rounded-3xl p-5">
          <p className="text-sm font-semibold text-mist">{counter.label}:</p>
          <p className="mt-1 font-display text-[38px] font-medium leading-none" data-testid="lit-counter">
            <Counter value={stats.lit} className="text-lime" />
            <span className="text-[24px] text-white/45"> / {stats.target}</span>
          </p>
          {counter.show_progress && <div className="mt-4"><Progress stats={stats} /></div>}
          <dl className="mt-4 space-y-2 text-sm">
            {counter.show_gifts && (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-mist"><Gift size={15} className="text-warm" /> Подарков передано</dt>
                <dd className="font-extrabold tabular-nums" data-testid="gifts-counter"><Counter value={stats.fulfilled} /></dd>
              </div>
            )}
            {counter.show_free && (
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-mist"><TreePine size={15} className="text-violet-soft" /> Свободно желаний</dt>
                <dd className="font-extrabold tabular-nums" data-testid="free-counter"><Counter value={stats.free} /></dd>
              </div>
            )}
          </dl>
        </div>

        {!allLit && suggestions.length > 0 && (
          <div className="glass rounded-3xl p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-semibold text-mist">Эти мечты ждут тебя</p>
              <button type="button" onClick={reshuffle} aria-label="Показать другие мечты" className="grid h-7 w-7 place-items-center rounded-full text-mist transition hover:bg-white/10 hover:text-white">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {suggestions.map((bulb) => (
                <button
                  key={bulb.id}
                  type="button"
                  onClick={() => openFromList(bulb)}
                  className="rounded-xl border border-white/10 bg-white/5 px-1 py-2.5 text-center text-[12px] font-semibold leading-tight transition hover:border-lime/60 hover:bg-white/10"
                >
                  <span className="mx-auto mb-1.5 block h-2.5 w-2.5 rounded-full bg-violet-soft/40 ring-1 ring-white/20" />
                  {bulb.name}
                  <span className="block font-medium text-mist">{ageLabel(bulb.age)}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setListOpen(true)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold text-lime transition hover:bg-white/5">
              <List size={15} /> Все свободные желания
            </button>
          </div>
        )}
      </motion.aside>

      {/* Счётчик на планшете */}
      <div className="absolute left-6 top-24 z-10 hidden w-64 md:block lg:hidden">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-semibold text-mist">{counter.label}</p>
          <p className="font-display text-2xl font-medium"><Counter value={stats.lit} className="text-lime" /><span className="text-base text-white/50"> / {stats.target}</span></p>
          {counter.show_progress && <div className="mt-2"><Progress stats={stats} /></div>}
        </div>
      </div>

      {/* Низ экрана */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[84px] z-10 flex flex-col items-center gap-2 px-4 md:bottom-7">
        <AnimatePresence>
          {!touched && mode === "3d" && !allLit && (
            <motion.div
              className="flex items-center gap-2 rounded-full bg-night/50 px-3.5 py-1.5 text-xs font-semibold text-white/85 backdrop-blur"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <Move3d size={15} /> Вращай ёлку на 360° и нажимай на огоньки
            </motion.div>
          )}
        </AnimatePresence>
        {mineCount > 0 && (
          <Link href="/my" data-testid="my-deeds-pill" className="glass pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition hover:border-lime/60">
            <Heart size={15} className="fill-lime text-lime" />
            Твоих огоньков: {mineCount}. Открыть кабинет
          </Link>
        )}
        {allLit && (
          <p className="max-w-lg rounded-2xl border border-white/20 bg-night/85 px-5 py-3 text-center text-sm font-bold backdrop-blur" data-testid="all-lit">
            <Sparkles size={15} className="mr-1 inline text-warm" />
            {settings.messages.all_lit}
          </p>
        )}
        {tree.paused && !allLit && (
          <p className="max-w-lg rounded-2xl border border-white/20 bg-night/85 px-5 py-3 text-center text-sm font-bold text-warm backdrop-blur" data-testid="paused">
            {tree.pause_message}
          </p>
        )}
        {!allLit && !tree.paused && sortedFree.length > 0 && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="btn-lime pointer-events-auto flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-extrabold lg:hidden"
          >
            <List size={17} /> Выбрать мечту
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => switchMode(mode === "flat" ? "3d" : "flat")}
        disabled={!hasWebgl}
        className="absolute bottom-7 right-8 z-10 hidden rounded-full bg-night/50 px-3.5 py-1.5 text-xs font-semibold text-mist backdrop-blur transition hover:text-white disabled:opacity-40 md:block"
      >
        {mode === "flat" ? "Вернуть 3D-ёлку" : "Лёгкий режим"}
      </button>

      <WishSheet
        bulb={selected}
        paused={tree.paused}
        pauseMessage={tree.pause_message}
        onClose={() => {
          setSelected(null);
          setFocusId(null);
        }}
        onBooked={onBooked}
      />

      <Sheet open={listOpen} onClose={() => setListOpen(false)} label="Свободные желания">
        <div className="flex items-center justify-between px-6 pb-3 pt-4">
          <h2 className="text-lg font-extrabold">Свободные желания: {sortedFree.length}</h2>
          <button type="button" onClick={() => setListOpen(false)} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold">Закрыть</button>
        </div>
        <ul className="scroll-thin max-h-[66dvh] space-y-1.5 overflow-y-auto px-3 pb-4">
          {sortedFree.map((bulb) => (
            <li key={bulb.id}>
              <button
                type="button"
                onClick={() => openFromList(bulb)}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 text-left transition hover:bg-white/12"
              >
                <span className="font-bold">{bulb.name}, {ageLabel(bulb.age)}</span>
                <span className="font-mono text-xs text-mist">{bulb.ward_id}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={Boolean(success)} onClose={() => setSuccess(null)} label="Желание закреплено за тобой">
        {success && (
          <div className="px-6 pb-7 pt-6 text-center" data-testid="booking-success">
            <motion.div
              className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-lime shadow-[0_0_50px_#a8f000]"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              <Sparkles className="text-ink" size={30} />
            </motion.div>
            <p className="font-display text-[19px] font-medium leading-snug md:text-[22px]">{settings.messages.booking_success}</p>

            <div className="mt-5 rounded-2xl bg-white/8 p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-bold"><Tag size={16} className="text-lime" /> Напиши этот ID на подарке</p>
              <div className="mt-2.5"><CopyId value={success.ward_id} tone="dark" /></div>
              <p className="mt-3 flex items-start gap-2 text-sm text-mist">
                <Gift size={16} className="mt-0.5 shrink-0 text-warm" />
                <span>Оставь подарок здесь: {settings.messages.drop_off.charAt(0).toLowerCase() + settings.messages.drop_off.slice(1)}.</span>
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href="/my" className="btn-lime flex-1 rounded-2xl py-3.5 font-extrabold">Мои добрые дела</Link>
              <button type="button" onClick={() => setSuccess(null)} className="flex-1 rounded-2xl bg-white/10 py-3.5 font-bold transition hover:bg-white/15">
                Вернуться к ёлке
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
