"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "./api";
import { supabaseBrowser } from "./supabase/browser";
import type { MyBooking, MyProfile, TreeData } from "./types";

export const BOOKINGS_EVENT = "sehr:bookings-changed";
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabaseBrowser();
    let alive = true;
    client.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

// Ёлка и счётчики: Realtime сообщает об изменении, данные запрашиваются заново.
export function useTree(initial: TreeData) {
  const [tree, setTree] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTree(await rpc<TreeData>(supabaseBrowser(), "get_tree"));
    } catch {
      // Сеть вернётся, и следующий сигнал или опрос обновит данные.
    }
  }, []);

  useEffect(() => {
    const client = supabaseBrowser();
    refresh();

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      // Небольшой разброс, чтобы все открытые вкладки не запрашивали базу в один момент.
      timer.current = setTimeout(refresh, 120 + Math.random() * 700);
    };

    const channel = DEMO
      ? null
      : client
          .channel("site-pulse")
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "site_pulse" }, schedule)
          .subscribe();

    // Запасной опрос на случай обрыва Realtime.
    const poll = setInterval(refresh, DEMO ? 3000 : 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const { data: auth } = client.auth.onAuthStateChange(() => schedule());
    window.addEventListener(BOOKINGS_EVENT, refresh);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (channel) client.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      auth.subscription.unsubscribe();
      window.removeEventListener(BOOKINGS_EVENT, refresh);
    };
  }, [refresh]);

  return { tree, refresh };
}

export function useMyBookings(user: User | null) {
  const [data, setData] = useState<{ bookings: MyBooking[]; profile: MyProfile | null }>({ bookings: [], profile: null });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setData({ bookings: [], profile: null });
      setLoading(false);
      return;
    }
    try {
      setData(await rpc(supabaseBrowser(), "my_bookings"));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
    window.addEventListener(BOOKINGS_EVENT, reload);
    return () => window.removeEventListener(BOOKINGS_EVENT, reload);
  }, [reload]);

  return { ...data, loading, reload };
}
