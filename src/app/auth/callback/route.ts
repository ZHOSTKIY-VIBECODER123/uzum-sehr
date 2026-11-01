import { NextResponse, type NextRequest } from "next/server";
import { safePath } from "@/lib/safe-path";
import { supabaseServer } from "@/lib/supabase/server";

// Сюда ведёт ссылка из письма со входом.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safeNext = safePath(searchParams.get("next"));

  if (code) {
    const client = await supabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
