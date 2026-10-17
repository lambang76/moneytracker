"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRightLeft,
  CheckCircle2,
  CircleUserRound,
  Home,
  Link as LinkIcon,
  LogOut,
  Pencil,
  PieChart,
  Send,
  Settings,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

export type DashboardTransaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  transactionType: "income" | "expense";
  source: "Telegram" | "Web Dashboard";
};

const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];
const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString("id-ID")}`;

export default function DashboardClient({
  transactions,
  account,
  loadError,
}: {
  transactions: DashboardTransaction[];
  account: { username: string; email: string };
  loadError?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramMessage, setTelegramMessage] = useState("");
  const [telegramError, setTelegramError] = useState(false);
  const now = new Date();
  const monthTransactions = transactions.filter((tx) => {
    const date = new Date(tx.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const monthExpenses = monthTransactions.filter((tx) => tx.transactionType === "expense");
  const monthIncome = monthTransactions.filter((tx) => tx.transactionType === "income");
  const expenseTotal = monthExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const incomeTotal = monthIncome.reduce((sum, tx) => sum + tx.amount, 0);
  const netTotal = incomeTotal - expenseTotal;
  const currentBalance = transactions.reduce(
    (balance, tx) => balance + (tx.transactionType === "income" ? tx.amount : -tx.amount),
    0,
  );

  const categories = Object.entries(
    monthExpenses.reduce<Record<string, number>>((acc, tx) => {
      acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
      return acc;
    }, {}),
  ).map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }));

  const daily = Object.entries(
    monthExpenses.reduce<Record<string, number>>((acc, tx) => {
      const day = new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      acc[day] = (acc[day] ?? 0) + tx.amount;
      return acc;
    }, {}),
  ).map(([name, total]) => ({ name, total }));

  const biggestCategory = categories.reduce(
    (max, item) => (item.value > max.value ? item : max),
    { name: "-", value: 0, color: colors[0] },
  );

  const refreshTelegramStatus = useCallback(async () => {
    setTelegramLoading(true);
    setTelegramError(false);
    try {
      const response = await fetch("/api/telegram/link", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status Telegram gagal dimuat.");
      setTelegramLinked(Boolean(result.linked));
      setTelegramMessage(result.linked ? "Telegram sudah terhubung ke akun ini." : "Telegram belum terhubung.");
    } catch (error) {
      setTelegramError(true);
      setTelegramMessage(error instanceof Error ? error.message : "Status Telegram gagal dimuat.");
    } finally {
      setTelegramLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTelegramStatus();
  }, [refreshTelegramStatus]);

  async function createTelegramLinkCode() {
    setTelegramLoading(true);
    setTelegramCode("");
    setTelegramMessage("");
    setTelegramError(false);
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kode tautan gagal dibuat.");
      setTelegramCode(result.code);
      setTelegramMessage("Kirim perintah ini sebagai pesan pribadi ke bot Telegram kamu:");
    } catch (error) {
      setTelegramError(true);
      setTelegramMessage(error instanceof Error ? error.message : "Kode tautan gagal dibuat.");
    } finally {
      setTelegramLoading(false);
    }
  }

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormMessage("");
    setFormError(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formData.get("description"),
          category: formData.get("category"),
          amount: formData.get("amount"),
          transactionType: formData.get("transactionType"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transaksi gagal disimpan.");

      form.reset();
      setFormMessage("Transaksi berhasil ditambahkan.");
      router.refresh();
    } catch (error) {
      setFormError(true);
      setFormMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(transaction: DashboardTransaction) {
    if (!window.confirm(`Hapus transaksi "${transaction.description}" sebesar ${formatRupiah(transaction.amount)}?`)) return;
    setDeletingId(transaction.id);
    setDeleteMessage("");
    setDeleteError(false);
    try {
      const response = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transaction.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transaksi gagal dihapus.");
      setDeleteMessage("Transaksi berhasil dihapus.");
      router.refresh();
    } catch (error) {
      setDeleteError(true);
      setDeleteMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus transaksi.");
    } finally {
      setDeletingId(null);
    }
  }

  async function updateTransaction(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setUpdating(true);
    setDeleteMessage("");
    setDeleteError(false);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          description: formData.get("description"),
          category: formData.get("category"),
          amount: formData.get("amount"),
          transactionType: formData.get("transactionType"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transaksi gagal diperbarui.");
      setEditingId(null);
      setDeleteMessage("Transaksi berhasil diperbarui.");
      router.refresh();
    } catch (error) {
      setDeleteError(true);
      setDeleteMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat memperbarui transaksi.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-3 p-6">
          <div className="rounded-lg bg-indigo-600 p-2"><Wallet className="h-6 w-6 text-white" /></div>
          <h1 className="text-xl font-bold">SakuBot</h1>
        </div>
        <nav className="flex-1 space-y-2 px-4 py-4">
          <a href="#dashboard" className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 font-medium text-indigo-600"><Home className="h-5 w-5" />Dashboard</a>
          <a href="#transactions" className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-500 hover:bg-slate-50"><ArrowRightLeft className="h-5 w-5" />Transaksi</a>
          <a href="#charts" className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-500 hover:bg-slate-50"><PieChart className="h-5 w-5" />Ringkasan</a>
          <a href="#telegram" className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-500 hover:bg-slate-50"><LinkIcon className="h-5 w-5" />Integrasi</a>
          <a href="#settings" className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-500 hover:bg-slate-50"><Settings className="h-5 w-5" />Pengaturan</a>
        </nav>
        <div className="border-t border-slate-200 p-4"><form action="/api/auth/sign-out" method="post"><button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-500"><LogOut className="h-5 w-5" />Keluar</button></form></div>
      </aside>

      <main id="dashboard" className="min-w-0 flex-1 overflow-y-auto p-5 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600"><Send className="h-4 w-4" />Input via Telegram</div>
            <div className="font-medium capitalize text-slate-500">{now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold uppercase text-indigo-700">{account.username.slice(0, 1)}</div>
              <div className="leading-tight"><p className="text-sm font-semibold text-slate-800">@{account.username}</p><p className="max-w-48 truncate text-xs text-slate-500">{account.email}</p></div>
            </div>
          </div>
        </header>

        {loadError && <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{loadError}</div>}

        <section aria-label="Saldo dan akun" className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200 lg:col-span-2">
            <div className="absolute -right-8 -top-16 h-52 w-52 rounded-full border-[28px] border-white/10" />
            <div className="relative flex items-start justify-between gap-4">
              <div><p className="text-sm font-medium text-indigo-100">Total uang saat ini</p><p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{formatRupiah(currentBalance)}</p><p className="mt-2 text-sm text-indigo-100">Saldo berdasarkan seluruh pemasukan dan pengeluaran yang dicatat</p></div>
              <div className="rounded-xl bg-white/15 p-3"><Wallet className="h-6 w-6" /></div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><CircleUserRound className="h-6 w-6" /></div><div><p className="text-sm text-slate-500">Akun yang digunakan</p><p className="font-semibold text-slate-800">@{account.username}</p></div></div>
            <div className="mt-5 border-t border-slate-100 pt-4"><p className="truncate text-sm text-slate-500">{account.email}</p><form action="/api/auth/sign-out" method="post" className="mt-3"><button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Keluar dari akun</button></form></div>
          </div>
        </section>

        <section id="telegram" className="mb-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Hubungkan Telegram</h3>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Hubungkan bot secara pribadi agar catatan Telegram tersimpan di akun ini dan masuk ke perhitungan saldo.</p>
              <p role="status" className={`mt-3 text-sm font-medium ${telegramError ? "text-red-600" : telegramLinked ? "text-emerald-700" : "text-slate-600"}`}>{telegramMessage || (telegramLoading ? "Memeriksa koneksi..." : "")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={createTelegramLinkCode} disabled={telegramLoading} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{telegramLoading ? "Memproses..." : telegramLinked ? "Tautkan ulang Telegram" : "Buat kode tautan"}</button>
              <button type="button" onClick={refreshTelegramStatus} disabled={telegramLoading} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Saya sudah kirim, cek koneksi</button>
            </div>
          </div>
          {telegramCode && <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Kirim perintah ini sebagai pesan pribadi ke bot Telegram dalam 10 menit:</p>
            <code className="mt-2 block select-all rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-base font-bold tracking-widest text-indigo-700">/link {telegramCode}</code>
            <p className="mt-2 text-xs text-slate-500">Setelah bot menerima perintah, tekan “Saya sudah kirim, cek koneksi”.</p>
          </div>}
          {telegramLinked && <p className="mt-3 text-xs text-slate-500">Untuk mencatat transaksi, kirim contoh: /expense 25000 | Makan siang | Makanan</p>}
        </section>

        <section className="mb-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Tambah transaksi</h3>
          <form onSubmit={addTransaction} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium text-slate-600">Jenis
              <select name="transactionType" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800" defaultValue="expense">
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">Nominal (Rp)
              <input name="amount" type="number" min="1" step="1" required placeholder="50000" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800" />
            </label>
            <label className="text-sm font-medium text-slate-600">Deskripsi
              <input name="description" maxLength={200} required placeholder="Contoh: Gaji bulanan" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800" />
            </label>
            <label className="text-sm font-medium text-slate-600">Kategori
              <input name="category" maxLength={80} required placeholder="Contoh: Gaji" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800" />
            </label>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Menyimpan..." : "Tambah"}</button>
          </form>
          {formMessage && <p role="status" className={`mt-3 text-sm ${formError ? "text-red-600" : "text-emerald-600"}`}>{formMessage}</p>}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="font-medium">Pemasukan bulan ini</span><ArrowDownRight className="h-5 w-5 rotate-180 text-emerald-500" /></div><div className="text-2xl font-bold text-emerald-600">{formatRupiah(incomeTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl bg-red-500 p-6 text-white shadow-sm"><div className="mb-4 flex items-center justify-between text-red-100"><span className="font-medium">Pengeluaran bulan ini</span><ArrowDownRight className="h-5 w-5" /></div><div className="text-2xl font-bold">{formatRupiah(expenseTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl bg-indigo-600 p-6 text-white shadow-sm"><div className="mb-4 flex items-center justify-between text-indigo-100"><span className="font-medium">Selisih bulan ini</span><Wallet className="h-5 w-5" /></div><div className="text-2xl font-bold">{formatRupiah(netTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="font-medium">Transaksi bulan ini</span><ArrowRightLeft className="h-5 w-5" /></div><div className="text-2xl font-bold">{monthTransactions.length}</div></div>
        </section>

        <section id="charts" className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2"><h3 className="mb-6 text-lg font-bold">Tren pengeluaran bulan ini</h3><div className="h-64">
            {daily.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={daily}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip formatter={(value) => [formatRupiah(Number(value)), "Pengeluaran"]} /><Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada pengeluaran bulan ini</div>}
          </div></div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h3 className="mb-2 text-lg font-bold">Pengeluaran per kategori</h3><div className="relative h-48">
            {categories.length ? <><ResponsiveContainer width="100%" height="100%"><RechartsPie><Pie data={categories} innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value">{categories.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => formatRupiah(Number(value))} /></RechartsPie></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xs text-slate-400">Pengeluaran</span><span className="text-sm font-bold">{formatRupiah(expenseTotal)}</span></div></> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data</div>}
          </div><div className="mt-4 flex flex-wrap justify-center gap-3">{categories.map((item) => <div key={item.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</div>)}</div></div>
        </section>

        <section id="transactions" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><h3 className="text-lg font-bold">Transaksi terakhir</h3>{deleteMessage && <p role="status" className={`mt-2 text-sm ${deleteError ? "text-red-600" : "text-emerald-600"}`}>{deleteMessage}</p>}</div><div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="bg-slate-50 text-sm text-slate-500"><th className="px-6 py-4 font-medium">Tanggal</th><th className="px-6 py-4 font-medium">Deskripsi</th><th className="px-6 py-4 font-medium">Kategori</th><th className="px-6 py-4 font-medium">Nominal</th><th className="px-6 py-4 font-medium">Sumber</th><th className="px-6 py-4 text-right font-medium">Aksi</th></tr></thead><tbody className="text-sm">
          {transactions.length ? transactions.map((tx) => editingId === tx.id ? (
            <tr key={tx.id} className="border-b border-indigo-100 bg-indigo-50/50"><td colSpan={6} className="p-4">
              <form onSubmit={(event) => updateTransaction(event, tx.id)} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <label className="text-xs font-medium text-slate-600">Jenis<select name="transactionType" defaultValue={tx.transactionType} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
                <label className="text-xs font-medium text-slate-600">Nominal<input name="amount" type="number" min="1" step="1" required defaultValue={tx.amount} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-600 xl:col-span-2">Deskripsi<input name="description" maxLength={200} required defaultValue={tx.description} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-600">Kategori<input name="category" maxLength={80} required defaultValue={tx.category} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                <div className="flex gap-2"><button type="submit" disabled={updating} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{updating ? "Menyimpan..." : "Simpan"}</button><button type="button" disabled={updating} onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button></div>
              </form>
            </td></tr>
          ) : <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="whitespace-nowrap px-6 py-4 text-slate-500">{new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td><td className="px-6 py-4 font-medium">{tx.description}</td><td className="px-6 py-4 text-slate-600">{tx.category} <span className="ml-1 text-xs text-slate-400">| {tx.transactionType === "income" ? "Pemasukan" : "Pengeluaran"}</span></td><td className={`whitespace-nowrap px-6 py-4 font-semibold ${tx.transactionType === "income" ? "text-emerald-600" : "text-red-500"}`}>{tx.transactionType === "income" ? "+" : "-"} {formatRupiah(tx.amount)}</td><td className="whitespace-nowrap px-6 py-4"><span className="flex items-center gap-1.5 text-slate-600">{tx.source === "Telegram" ? <Send className="h-4 w-4 text-blue-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}{tx.source}</span></td><td className="px-6 py-3 text-right"><div className="inline-flex items-center"><button type="button" onClick={() => { setDeleteMessage(""); setEditingId(tx.id); }} aria-label={`Edit transaksi ${tx.description}`} title="Edit transaksi" className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => deleteTransaction(tx)} disabled={deletingId === tx.id || editingId === tx.id} aria-label={`Hapus transaksi ${tx.description}`} title="Hapus transaksi" className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>) : <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Belum ada transaksi. Tambahkan lewat formulir di atas atau Telegram.</td></tr>}
        </tbody></table></div></section>
      </main>
    </div>
  );
}



