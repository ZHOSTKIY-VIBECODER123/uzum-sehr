"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { resetDemo } from "@/lib/demo/backend";
import { supabaseBrowser, withBase } from "@/lib/supabase/browser";
import type { PublicContent, TreeData } from "@/lib/types";

export async function resetAndReload() {
  await supabaseBrowser().auth.signOut({ scope: "local" }).catch(() => undefined);
  await resetDemo();
  window.location.assign(withBase("/"));
}

function Waiting() {
  return (
    <div className="night-sky grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Loader2 className="mx-auto animate-spin text-lime" size={30} />
        <p className="mt-4 font-display text-lg font-medium">Развешиваем лампочки…</p>
        <p className="mt-2 max-w-xs text-sm text-mist">При первом открытии демо готовит базу в браузере. Это занимает несколько секунд.</p>
      </div>
    </div>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <div className="night-sky grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-xl font-medium">Демо не запустилось</p>
        <p className="mt-3 text-sm text-mist">{message}</p>
        <button type="button" onClick={resetAndReload} className="btn-lime mt-6 inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-extrabold">
          <RotateCcw size={16} /> Начать заново
        </button>
      </div>
    </div>
  );
}

function useLoaded<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((result) => {
        if (alive) setValue(result);
      })
      .catch((failure) => {
        if (alive) setError(humanError(failure));
      });
    return () => {
      alive = false;
    };
    // Загрузка нужна один раз при открытии страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { value, error };
}

export function WithContent({ children }: { children: (content: PublicContent) => React.ReactNode }) {
  const { value, error } = useLoaded(() => rpc<PublicContent>(supabaseBrowser(), "get_public_content"));
  if (error) return <Failed message={error} />;
  return value ? children(value) : <Waiting />;
}

export function WithHome({ children }: { children: (content: PublicContent, tree: TreeData) => React.ReactNode }) {
  const { value, error } = useLoaded(async () => {
    const client = supabaseBrowser();
    const content = await rpc<PublicContent>(client, "get_public_content");
    return { content, tree: await rpc<TreeData>(client, "get_tree") };
  });
  if (error) return <Failed message={error} />;
  return value ? children(value.content, value.tree) : <Waiting />;
}
