import { randomBytes } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

    const { data, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return Response.json({ linked: Boolean(data?.telegram_chat_id) });
  } catch (error) {
    console.error("Gagal memeriksa integrasi Telegram:", error);
    return Response.json({ error: "Status Telegram gagal dimuat. Pastikan skema terbaru sudah dijalankan." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return Response.json({ error: "Origin tidak valid." }, { status: 403 });
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

    const code = randomBytes(8).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .update({ telegram_link_code: code, telegram_link_expires_at: expiresAt })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Profil belum tersedia. Jalankan pembaruan supabase/schema.sql lalu masuk ulang." }, { status: 409 });
    }
    return Response.json({ code, expiresAt });
  } catch (error) {
    console.error("Gagal membuat kode tautan Telegram:", error);
    return Response.json({ error: "Kode tautan gagal dibuat. Periksa konfigurasi Supabase server." }, { status: 500 });
  }
}
