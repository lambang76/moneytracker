import { createSupabaseServer } from "@/lib/supabase/server";

type TransactionType = "income" | "expense";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origin tidak valid." }, { status: 403 });
  }

  let body: {
    description?: unknown;
    category?: unknown;
    amount?: unknown;
    transactionType?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const amount = Number(body.amount);
  const transactionType = body.transactionType;

  if (!description || description.length > 200 || !category || category.length > 80) {
    return Response.json({ error: "Deskripsi dan kategori wajib diisi." }, { status: 400 });
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return Response.json({ error: "Nominal harus berupa angka rupiah yang lebih besar dari 0." }, { status: 400 });
  }
  if (transactionType !== "income" && transactionType !== "expense") {
    return Response.json({ error: "Jenis transaksi tidak valid." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

    const { error } = await supabase.from("transactions").insert({
      description,
      category,
      amount,
      transaction_type: transactionType as TransactionType,
      source: "Web Dashboard",
      user_id: user.id,
    });

    if (error) throw error;
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan transaksi dari dashboard:", error);
    return Response.json({ error: "Transaksi gagal disimpan." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!hasValidOrigin(request)) {
    return Response.json({ error: "Origin tidak valid." }, { status: 403 });
  }

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: "ID transaksi tidak valid." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return Response.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Gagal menghapus transaksi:", error);
    return Response.json({ error: "Transaksi gagal dihapus." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) {
    return Response.json({ error: "Origin tidak valid." }, { status: 403 });
  }

  let body: {
    id?: unknown;
    description?: unknown;
    category?: unknown;
    amount?: unknown;
    transactionType?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const amount = Number(body.amount);
  const transactionType = body.transactionType;

  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: "ID transaksi tidak valid." }, { status: 400 });
  }
  if (!description || description.length > 200 || !category || category.length > 80) {
    return Response.json({ error: "Deskripsi dan kategori wajib diisi." }, { status: 400 });
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return Response.json({ error: "Nominal harus berupa angka rupiah yang lebih besar dari 0." }, { status: 400 });
  }
  if (transactionType !== "income" && transactionType !== "expense") {
    return Response.json({ error: "Jenis transaksi tidak valid." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

    const { data, error } = await supabase
      .from("transactions")
      .update({ description, category, amount, transaction_type: transactionType as TransactionType })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return Response.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Gagal memperbarui transaksi:", error);
    return Response.json({ error: "Transaksi gagal diperbarui." }, { status: 500 });
  }
}
