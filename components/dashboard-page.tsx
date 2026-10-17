import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import DashboardClient, { type DashboardPage, type DashboardTransaction } from "@/components/dashboard-client";
import { createSupabaseServer } from "@/lib/supabase/server";

async function DashboardData({ page }: { page: DashboardPage }) {
  await connection();
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const account = {
    username: profile?.username ?? user.user_metadata?.username ?? "Pengguna",
    email: user.email ?? "",
  };

  let transactions: DashboardTransaction[] = [];
  let loadError: string | undefined;
  try {
    const rows: Record<string, unknown>[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, description, category, amount, transaction_type, source")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    transactions = rows.map((row) => ({
      id: String(row.id),
      date: String(row.date),
      description: String(row.description),
      category: String(row.category),
      amount: Number(row.amount),
      transactionType: row.transaction_type as DashboardTransaction["transactionType"],
      source: row.source as DashboardTransaction["source"],
    }));
  } catch (error) {
    console.error("Gagal memuat transaksi:", error);
    loadError = "Data belum dapat dimuat. Pastikan tabel transactions sudah dibuat dan akses Supabase aktif.";
  }

  return <DashboardClient page={page} transactions={transactions} account={account} loadError={loadError} />;
}

export default function DashboardPageView({ page }: { page: DashboardPage }) {
  return <Suspense fallback={<div className="p-8 text-slate-500">Memuat SakuBot...</div>}><DashboardData page={page} /></Suspense>;
}
