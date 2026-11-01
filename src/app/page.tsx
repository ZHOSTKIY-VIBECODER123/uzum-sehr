import { HomeClient } from "@/components/home/HomeClient";
import { rpc } from "@/lib/api";
import { getContent } from "@/lib/content";
import { supabaseServer } from "@/lib/supabase/server";
import type { TreeData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [content, tree] = await Promise.all([
    getContent(),
    supabaseServer().then((client) => rpc<TreeData>(client, "get_tree")),
  ]);
  return <HomeClient content={content} initialTree={tree} />;
}
