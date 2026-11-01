import { rpc } from "./api";
import { supabaseServer } from "./supabase/server";
import type { PublicContent } from "./types";

export async function getContent(): Promise<PublicContent> {
  return rpc<PublicContent>(await supabaseServer(), "get_public_content");
}
