"use client";

import { motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Circle, Gift, Loader2, LogOut, Tag, TreePine, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { ChildAvatar } from "@/components/wish/ChildAvatar";
import { CopyId } from "@/components/wish/CopyId";
import { MediaList, Sheet } from "@/components/wish/WishSheet";
import { humanError, rpc } from "@/lib/api";
import { ageLabel, formatDate, formatDateTime, plural } from "@/lib/format";
import { useMyBookings, useUser } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { MyBooking, MyProfile } from "@/lib/types";

function StatusChip({ booking }: { booking: MyBooking }) {
  return booking.status === "fulfilled" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warm/15 px-2.5 py-1 text-xs font-bold text-warm">
      <CheckCircle2 size={13} /> Подарок передан
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/12 px-2.5 py-1 text-xs font-bold text-lime">
      <Gift size={13} /> Готовлю подарок
    </span>
  );
}

function Timeline({ booking }: { booking: MyBooking }) {
  const fulfilled = booking.status === "fulfilled";
  const items = [
    { done: true, title: "Лампочка зажжена", hint: formatDateTime(booking.booked_at) },
    { done: fulfilled, title: "Подарок передан", hint: fulfilled ? formatDateTime(booking.fulfilled_at) : "Отметит организатор, когда получит подарок" },
  ];
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.title} className="flex gap-3">
          {item.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-violet" /> : <Circle size={20} className="mt-0.5 shrink-0 text-ink/30" />}
          <span>
            <span className="block text-sm font-bold">{item.title}</span>
            <span className="block text-xs text-ink-soft">{item.hint}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function DeedDetails({ booking, dropOff, onClose }: { booking: MyBooking | null; dropOff: string; onClose: () => void }) {
  return (
    <Sheet open={Boolean(booking)} onClose={onClose} label="Подробности доброго дела">
      {booking && (
        <>
          <div className="flex items-center justify-between px-6 pb-3 pt-4">
            <h2 className="text-lg font-extrabold">Твоё доброе дело</h2>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X size={18} />
            </button>
          </div>
          <div className="scroll-thin mx-2 mb-2 max-h-[76dvh] overflow-y-auto rounded-[22px] bg-card p-5 text-ink md:p-6">
            <div className="flex items-start gap-4">
              <ChildAvatar path={booking.photo_path} name={booking.name} size={84} />
              <div>
                <h3 className="text-xl font-extrabold leading-tight">
                  {booking.name}, {ageLabel(booking.age)}{booking.city ? `, ${booking.city}` : ""}
                </h3>
                <p className="mt-1 text-sm font-bold text-violet">Мечтает: {booking.wish_title}</p>
              </div>
            </div>
            {booking.description && <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{booking.description}</p>}
            <MediaList media={booking.media} />

            <div className="mt-5 rounded-2xl bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold"><Tag size={16} className="text-violet" /> Обязательно подпиши подарок этим ID</p>
              <div className="mt-2.5"><CopyId value={booking.ward_id} /></div>
            </div>
            <div className="mt-3 rounded-2xl bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold"><TreePine size={16} className="text-violet" /> Куда отнести подарок</p>
              <p className="mt-1.5 text-sm text-ink-soft">{dropOff}. Сладости можно добавить, фрукты и скоропортящиеся продукты не нужны.</p>
              {booking.expires_at && booking.status === "booked" && (
                <p className="mt-2.5 flex items-center gap-2 text-sm font-bold text-ink">
                  <CalendarClock size={16} className="text-violet" /> Постарайся успеть до {formatDateTime(booking.expires_at)}
                </p>
              )}
            </div>
            <div className="mt-3 rounded-2xl bg-white p-4">
              <Timeline booking={booking} />
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}

function ProfileForm({ profile, onSaved }: { profile: MyProfile; onSaved: () => void }) {
  const [name, setName] = useState(profile.display_name ?? "");
  const [slack, setSlack] = useState(profile.slack ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("busy");
    setError(null);
    try {
      await rpc(supabaseBrowser(), "save_my_profile", { p_display_name: name, p_slack: slack, p_phone: phone });
      setState("saved");
      onSaved();
    } catch (failure) {
      setError(humanError(failure));
      setState("idle");
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-6">
      <h2 className="text-lg font-extrabold">Как с тобой связаться</h2>
      <p className="mt-1 text-sm text-mist">Необязательно. Организаторы увидят эти данные, если появится вопрос по подарку.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input aria-label="Имя" className="admin-input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Slack" className="admin-input" placeholder="Slack" value={slack} onChange={(e) => setSlack(e.target.value)} />
        <input aria-label="Телефон" className="admin-input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-300">{error}</p>}
      <button type="submit" disabled={state === "busy"} className="mt-4 rounded-full bg-white/12 px-5 py-2 text-sm font-bold transition hover:bg-white/20">
        {state === "saved" ? "Сохранено ✓" : "Сохранить"}
      </button>
    </form>
  );
}

export function MyDeeds({ dropOff }: { dropOff: string }) {
  const { user, loading: userLoading } = useUser();
  const { bookings, profile, loading, reload } = useMyBookings(user);
  const [open, setOpen] = useState<MyBooking | null>(null);

  if (userLoading || (user && loading)) {
    return (
      <div className="grid h-72 place-items-center text-mist">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-[26px] font-medium">Мои добрые дела</h1>
        <div className="glass mt-6 rounded-3xl p-6">
          <AuthForm next="/my" intro="Войди по почте, чтобы увидеть выбранные желания. Они сохраняются за твоим аккаунтом." />
        </div>
      </div>
    );
  }

  const count = bookings.length;
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.assign("/");
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime">Мои добрые дела</p>
          <h1 className="mt-3 flex items-baseline gap-3 font-display text-[22px] font-medium md:text-[30px]">
            Количество добрых дел:
            <span className="text-[44px] leading-none text-lime [text-shadow:0_0_30px_#a8f00088] md:text-[60px]" data-testid="deeds-count">{count}</span>
          </h1>
          <p className="mt-2 text-sm text-mist">{user.email}</p>
        </div>
        <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-mist transition hover:bg-white/10 hover:text-white">
          <LogOut size={15} /> Выйти
        </button>
      </div>

      {count === 0 ? (
        <div className="glass mt-10 rounded-3xl p-10 text-center">
          <p className="font-display text-xl font-medium">Здесь пока темно</p>
          <p className="mx-auto mt-2 max-w-sm text-mist">Выбери лампочку на ёлке, и здесь появится твоё первое доброе дело.</p>
          <Link href="/" className="btn-lime mt-6 inline-block rounded-2xl px-7 py-3.5 font-extrabold">К ёлке</Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {bookings.map((booking, i) => (
            <motion.li key={booking.booking_id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button
                type="button"
                onClick={() => setOpen(booking)}
                data-testid="deed-card"
                className="glass flex w-full gap-4 rounded-3xl p-5 text-left transition hover:-translate-y-0.5 hover:border-lime/50"
              >
                <ChildAvatar path={booking.photo_path} name={booking.name} size={68} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-extrabold text-lime">{booking.ward_id}</span>
                    <StatusChip booking={booking} />
                  </span>
                  <span className="mt-1.5 block text-lg font-extrabold leading-tight">{booking.name}, {ageLabel(booking.age)}</span>
                  <span className="mt-0.5 block text-sm text-white/80">{booking.wish_title}</span>
                  <span className="mt-2 block text-xs text-mist">Выбрано {formatDate(booking.booked_at)}</span>
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      {count > 0 && (
        <p className="mt-5 text-sm text-mist">
          {count} {plural(count, "огонёк горит", "огонька горят", "огоньков горят")} благодаря тебе. Нажми на карточку, чтобы увидеть ID и инструкцию.
        </p>
      )}

      {profile && <div className="mt-10"><ProfileForm key={profile.email} profile={profile} onSaved={reload} /></div>}

      <DeedDetails booking={open} dropOff={dropOff} onClose={() => setOpen(null)} />
    </>
  );
}
