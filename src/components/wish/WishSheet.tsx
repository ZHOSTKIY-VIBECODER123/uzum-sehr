"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Flame, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { humanError, rpc, signedUrl } from "@/lib/api";
import { ageLabel } from "@/lib/format";
import { useUser } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { BookingResult, Bulb, WishCard, WishMedia } from "@/lib/types";
import { ChildAvatar } from "./ChildAvatar";

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

// Окно по центру на компьютере и выезжающая снизу карточка на телефоне.
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const mobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={label}>
          <motion.button
            type="button"
            aria-label="Закрыть"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-night/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full overflow-hidden rounded-t-[28px] border border-white/15 bg-plum shadow-[0_30px_100px_-20px_#8538e8aa] md:max-w-[560px] md:rounded-[28px]"
            initial={mobile ? { y: "100%" } : { opacity: 0, y: 26, scale: 0.96 }}
            animate={mobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={mobile ? { y: "100%" } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            drag={mobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            {mobile && <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-white/30" aria-hidden />}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function MediaList({ media }: { media: WishMedia[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    media.forEach((item) => {
      signedUrl(supabaseBrowser(), item.path).then((url) => {
        if (alive && url) setUrls((prev) => ({ ...prev, [item.id]: url }));
      });
    });
    return () => {
      alive = false;
    };
  }, [media]);

  if (media.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {media.map((item) =>
        item.mime_type?.startsWith("image/") && urls[item.id] ? (
          <a key={item.id} href={urls[item.id]} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[item.id]} alt={item.title ?? "Материал"} className="h-20 w-20 rounded-xl object-cover" />
          </a>
        ) : (
          <a
            key={item.id}
            href={urls[item.id]}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-ink/8 px-3 py-2 text-sm font-semibold text-ink"
          >
            <FileText size={15} /> {item.title ?? "Материал"}
          </a>
        ),
      )}
    </div>
  );
}

type Props = {
  bulb: Bulb | null;
  paused: boolean;
  pauseMessage: string | null;
  onClose: () => void;
  onBooked: (result: BookingResult) => void;
};

export function WishSheet({ bulb, paused, pauseMessage, onClose, onBooked }: Props) {
  const { user } = useUser();
  const [card, setCard] = useState<WishCard | null>(null);
  const [view, setView] = useState<"card" | "auth">("card");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bulb) return;
    let alive = true;
    setCard(null);
    setError(null);
    setView("card");
    setLoading(true);
    rpc<WishCard>(supabaseBrowser(), "get_wish", { p_id: bulb.id })
      .then((value) => {
        if (alive) setCard(value);
      })
      .catch((failure) => {
        if (alive) setError(humanError(failure));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bulb]);

  const book = async () => {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rpc<BookingResult>(supabaseBrowser(), "book_wish", { p_wish_id: card.id });
      onBooked(result);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(humanError(failure));
      if (message === "wish_unavailable") {
        setCard({ ...card, status: "booked", mine: false });
      }
      if (message === "auth_required" || /jwt/i.test(message)) setView("auth");
    } finally {
      setBusy(false);
    }
  };

  const onLight = () => {
    if (!user) setView("auth");
    else book();
  };

  const free = card?.status === "free";

  return (
    <Sheet open={Boolean(bulb)} onClose={onClose} label="Карточка желания">
      <div className="flex items-center justify-between px-6 pb-3 pt-4 md:pt-5">
        <h2 className="text-lg font-extrabold md:text-xl">Исполни мечту!</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
          <X size={18} />
        </button>
      </div>

      <div className="mx-2 mb-2 max-h-[74dvh] overflow-y-auto rounded-[22px] bg-card p-5 text-ink scroll-thin md:p-6">
        {loading && (
          <div className="grid h-52 place-items-center text-ink-soft">
            <Loader2 className="animate-spin" />
          </div>
        )}

        {!loading && !card && error && <p role="alert" className="py-12 text-center font-semibold">{error}</p>}

        {card && view === "auth" && (
          <div>
            <p className="mb-3 font-extrabold">
              Ещё один шаг, и мечта {card.name} закрепится за тобой
            </p>
            <AuthForm
              tone="light"
              next="/"
              intro="Войди по почте, чтобы желание сохранилось в твоём кабинете. Пароль не нужен: пришлём код."
              onDone={() => {
                setView("card");
                book();
              }}
            />
          </div>
        )}

        {card && view === "card" && (
          <>
            <div className="flex items-start gap-4">
              <ChildAvatar path={card.photo_path} name={card.name} size={92} />
              <div className="min-w-0">
                <h3 className="text-xl font-extrabold leading-tight">
                  {card.name}, {ageLabel(card.age)}
                  {card.city ? `, ${card.city}` : ""}
                </h3>
                <p className="mt-1 text-sm font-bold text-violet">Мечтает: {card.wish_title}</p>
                <p className="mt-2 inline-flex rounded-full bg-ink/8 px-2.5 py-1 font-mono text-xs font-bold">ID {card.ward_id}</p>
              </div>
            </div>

            {card.description && <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{card.description}</p>}
            <MediaList media={card.media} />

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

            <div className="mt-5">
              {card.mine ? (
                <Link href="/my" className="btn-lime block rounded-2xl py-4 text-center text-[17px] font-extrabold">
                  Это твоё доброе дело: открыть в кабинете
                </Link>
              ) : !free ? (
                <p className="rounded-2xl bg-violet/10 px-4 py-4 text-center font-bold text-violet">
                  {card.status === "fulfilled" ? "Эта мечта уже исполнена ✨" : "У этой мечты уже есть свой волшебник ✨"}
                </p>
              ) : paused ? (
                <p className="rounded-2xl bg-ink/8 px-4 py-4 text-center font-bold">{pauseMessage ?? "Бронирование приостановлено."}</p>
              ) : (
                <button
                  type="button"
                  onClick={onLight}
                  disabled={busy}
                  className="btn-lime flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[17px] font-extrabold"
                >
                  {busy ? <Loader2 size={20} className="animate-spin" /> : <Flame size={20} />}
                  Зажечь лампочку!
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
