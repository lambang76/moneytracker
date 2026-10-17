import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return Response.json({ error: "Isi email/username dan password." }, { status: 400 });
  }

  let email = identifier.toLowerCase();
  if (!email.includes("@")) {
    try {
      const admin = createSupabaseAdmin();
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("username", identifier.toLowerCase())
        .maybeSingle();
      if (profileError || !profile) {
        return Response.json({ error: "Email/username atau password salah." }, { status: 401 });
      }

      const { data, error } = await admin.auth.admin.getUserById(profile.id);
      if (error || !data.user?.email) {
        return Response.json({ error: "Email/username atau password salah." }, { status: 401 });
      }
      email = data.user.email;
    } catch (error) {
      console.error("Username sign-in belum terkonfigurasi:", error);
      return Response.json({ error: "Login dengan username belum siap. Periksa SUPABASE_SECRET_KEY." }, { status: 503 });
    }
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return Response.json({ error: "Email/username atau password salah." }, { status: 401 });
  }
  return Response.json({ ok: true });
}
