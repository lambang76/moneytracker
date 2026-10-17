"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRightLeft,
  CheckCircle2,
  CircleUserRound,
  Home,
  Link as LinkIcon,
  LogOut,
  Menu,
  Pencil,
  PieChart,
  Send,
  Settings,
  Trash2,
  Wallet,
  X,
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
const navigationItems = [
  { id: "dashboard", href: "/", label: "Dashboard", icon: Home },
  { id: "transactions", href: "/transactions", label: "Transaksi", icon: ArrowRightLeft },
  { id: "summary", href: "/summary", label: "Ringkasan", icon: PieChart },
  { id: "integrations", href: "/integrations", label: "Integrasi", icon: LinkIcon },
  { id: "settings", href: "/settings", label: "Pengaturan", icon: Settings },
];

export type DashboardPage = (typeof navigationItems)[number]["id"];

export default function DashboardClient({
  transactions,
  account,
  loadError,
  page,
}: {
  transactions: DashboardTransaction[];
  account: { username: string; email: string };
  loadError?: string;
  page: DashboardPage;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transactionQuery, setTransactionQuery] = useState("");
  const [transactionFilter, setTransactionFilter] = useState("all");
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

  const visibleTransactions = transactions.filter((tx) => {
    const query = transactionQuery.trim().toLocaleLowerCase("id-ID");
    const matchesQuery = !query || `${tx.description} ${tx.category} ${tx.source}`.toLocaleLowerCase("id-ID").includes(query);
    const matchesFilter = transactionFilter === "all" || tx.transactionType === transactionFilter;
    return matchesQuery && matchesFilter;
  });

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

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const currentPage = navigationItems.find((item) => item.id === page) ?? navigationItems[0];

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
    <div className="min-h-screen bg-[#f5f7fb] font-sans text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white md:flex">
        <Link href="/" className="flex items-center gap-3 p-6 text-left">
          <div className="rounded-xl bg-indigo-600 p-2.5 shadow-lg shadow-indigo-200"><Wallet className="h-6 w-6 text-white" /></div>
          <span><span className="block text-xl font-bold tracking-tight">SakuBot</span><span className="block text-xs text-slate-400">Catat uang dengan rapi</span></span>
        </Link>
        <p className="px-6 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Menu utama</p>
        <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3">
          {navigationItems.map(({ id, href, label, icon: Icon }) => (
            <Link key={id} href={href} aria-current={page === id ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${page === id ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
              <Icon className={`h-[18px] w-[18px] ${page === id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />{label}
              {page === id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600" />}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-2xl bg-slate-50 p-3">
          <div className="mb-3 flex items-center gap-2.5 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold uppercase text-indigo-700">{account.username.slice(0, 1)}</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">@{account.username}</p><p className="truncate text-xs text-slate-500">{account.email}</p></div>
          </div>
          <form action="/api/auth/sign-out" method="post"><button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-rose-600"><LogOut className="h-4 w-4" />Keluar</button></form>
        </div>
      </aside>

      <main className="min-w-0 md:ml-64">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 md:px-8 md:py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-600">SakuBot</p><h2 className="text-2xl font-bold tracking-tight">{currentPage.label}</h2></div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/integrations" className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 sm:flex"><Send className="h-4 w-4" />Input via Telegram</Link>
            <div className="hidden font-medium capitalize text-slate-500 sm:block">{now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</div>
            <Link href="/settings" className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-sm transition hover:border-indigo-200 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold uppercase text-indigo-700">{account.username.slice(0, 1)}</div>
              <div className="leading-tight"><p className="text-sm font-semibold text-slate-800">@{account.username}</p><p className="max-w-48 truncate text-xs text-slate-500">{account.email}</p></div>
            </Link>
          </div>
        </header>

        <div aria-hidden={!mobileMenuOpen} inert={!mobileMenuOpen} className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Tutup menu navigasi" tabIndex={mobileMenuOpen ? 0 : -1} onClick={() => setMobileMenuOpen(false)} className={`absolute inset-0 h-full w-full bg-slate-950/45 transition-opacity duration-300 ${mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
          <aside role="dialog" aria-modal={mobileMenuOpen} aria-label="Menu navigasi SakuBot" className={`absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col rounded-r-[28px] bg-white shadow-2xl shadow-slate-950/20 transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2.5 shadow-md shadow-indigo-200"><Wallet className="h-5 w-5 text-white" /></span><span><span className="block font-bold">SakuBot</span><span className="block text-xs text-slate-400">Menu utama</span></span></Link>
              <button type="button" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
              {navigationItems.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={page === id ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition ${page === id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${page === id ? "bg-white text-indigo-600 shadow-sm" : "bg-slate-50 text-slate-500"}`}><Icon className="h-[18px] w-[18px]" /></span>{label}{page === id && <span className="ml-auto h-2 w-2 rounded-full bg-indigo-600" />}</Link>)}
            </nav>
            <div className="border-t border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold uppercase text-indigo-700">{account.username.slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">@{account.username}</p><p className="truncate text-xs text-slate-500">{account.email}</p></div></div>
              <form action="/api/auth/sign-out" method="post"><button className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-4 w-4" />Keluar dari akun</button></form>
            </div>
          </aside>
        </div>

        {loadError && <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{loadError}</div>}

        <div className="mb-7"><p className="text-sm text-slate-500">{page === "dashboard" ? "Pantau kondisi keuanganmu dalam satu ringkasan." : page === "transactions" ? "Catat dan kelola semua pemasukan serta pengeluaran." : page === "summary" ? "Pahami pola pengeluaran dan pemasukanmu." : page === "integrations" ? "Hubungkan SakuBot dengan Telegram untuk mencatat lewat chat." : "Atur akun dan koneksi SakuBot milikmu."}</p></div>

        {page === "dashboard" && <>
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

        <section aria-label="Ringkasan bulan ini" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="font-medium">Pemasukan bulan ini</span><ArrowDownRight className="h-5 w-5 rotate-180 text-emerald-500" /></div><div className="text-2xl font-bold text-emerald-600">{formatRupiah(incomeTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl bg-red-500 p-6 text-white shadow-sm"><div className="mb-4 flex items-center justify-between text-red-100"><span className="font-medium">Pengeluaran bulan ini</span><ArrowDownRight className="h-5 w-5" /></div><div className="text-2xl font-bold">{formatRupiah(expenseTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl bg-indigo-600 p-6 text-white shadow-sm"><div className="mb-4 flex items-center justify-between text-indigo-100"><span className="font-medium">Selisih bulan ini</span><Wallet className="h-5 w-5" /></div><div className="text-2xl font-bold">{formatRupiah(netTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="font-medium">Transaksi bulan ini</span><ArrowRightLeft className="h-5 w-5" /></div><div className="text-2xl font-bold">{monthTransactions.length}</div></div>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6"><div><h3 className="text-lg font-bold">Aktivitas terbaru</h3><p className="mt-1 text-sm text-slate-500">Catatan terakhir yang masuk ke akunmu.</p></div><Link href="/transactions" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Lihat semua transaksi →</Link></div>
          {transactions.length ? <ul className="divide-y divide-slate-100">{transactions.slice(0, 5).map((tx) => <li key={tx.id} className="flex items-center justify-between gap-4 px-6 py-4"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tx.transactionType === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{tx.transactionType === "income" ? "+" : "−"}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{tx.description}</p><p className="mt-0.5 text-xs text-slate-500">{tx.category} · {new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p></div></div><span className={`whitespace-nowrap text-sm font-bold ${tx.transactionType === "income" ? "text-emerald-600" : "text-slate-800"}`}>{tx.transactionType === "income" ? "+" : "−"}{formatRupiah(tx.amount)}</span></li>)}</ul> : <div className="p-8 text-center text-sm text-slate-500">Belum ada catatan. Tambahkan transaksi pertamamu di menu Transaksi.</div>}
        </section>
        </>}

        {page === "integrations" && <>
        <section className="mb-6 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl"><div className="flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-3 text-sky-600"><Send className="h-6 w-6" /></div><div><h3 className="text-lg font-bold">Bot Telegram</h3><p className="text-sm text-slate-500">Catat uang dengan mengirim pesan pribadi ke bot.</p></div></div>
              <p role="status" className={`mt-4 text-sm font-medium ${telegramError ? "text-red-600" : telegramLinked ? "text-emerald-700" : "text-slate-600"}`}>{telegramMessage || (telegramLoading ? "Memeriksa koneksi..." : "")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={createTelegramLinkCode} disabled={telegramLoading} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">{telegramLoading ? "Memproses..." : telegramLinked ? "Buat kode tautan baru" : "Hubungkan Telegram"}</button>
              <button type="button" onClick={refreshTelegramStatus} disabled={telegramLoading} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Periksa koneksi</button>
            </div>
          </div>
          {telegramCode && <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4"><p className="text-sm text-slate-700">Kirim sebagai pesan pribadi ke bot dalam 10 menit:</p><code className="mt-2 block select-all rounded-lg border border-indigo-100 bg-white px-4 py-3 font-mono text-base font-bold tracking-widest text-indigo-700">/link {telegramCode}</code><p className="mt-2 text-xs text-slate-500">Setelah dikirim, klik “Periksa koneksi”.</p></div>}
          {telegramLinked && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"><b>Sudah terhubung.</b> Catat transaksi lewat chat, atau kirim <code>/unlink</code> ke bot untuk memutus koneksi.</div>}
        </section>
        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40"><h3 className="text-lg font-bold">Perintah bot</h3><p className="mt-1 text-sm text-slate-500">Pakai perintah ini di chat pribadi dengan bot SakuBot.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{[
          ["/saldo", "Lihat saldo saat ini"], ["/terakhir", "Lihat 5 transaksi terbaru"], ["/expense 25000 | Makan siang | Makanan", "Catat pengeluaran"], ["/income 500000 | Uang mingguan | Pemasukan", "Catat pemasukan"], ["/unlink", "Putuskan akun Telegram"],
        ].map(([command, description]) => <div key={command} className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4"><code className="break-all text-sm font-semibold text-indigo-700">{command}</code><span className="text-xs text-slate-500">{description}</span></div>)}</div><p className="mt-4 text-xs text-slate-500">Format singkat pengeluaran juga didukung, misalnya <code>makan siang 25000</code>.</p></section>
        </>}

        {page === "summary" && <>
        <section aria-label="Ringkasan bulan ini" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="font-medium">Pemasukan bulan ini</span><ArrowDownRight className="h-5 w-5 rotate-180 text-emerald-500" /></div><div className="text-2xl font-bold text-emerald-600">{formatRupiah(incomeTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl border border-rose-100 bg-rose-50 p-6"><div className="mb-4 flex items-center justify-between text-rose-600"><span className="font-medium">Pengeluaran bulan ini</span><ArrowDownRight className="h-5 w-5" /></div><div className="text-2xl font-bold text-rose-700">{formatRupiah(expenseTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl bg-indigo-600 p-6 text-white shadow-sm"><div className="mb-4 flex items-center justify-between text-indigo-100"><span className="font-medium">Selisih bulan ini</span><Wallet className="h-5 w-5" /></div><div className="text-2xl font-bold">{formatRupiah(netTotal)}</div></div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between text-slate-500"><span className="font-medium">Jumlah catatan</span><ArrowRightLeft className="h-5 w-5" /></div><div className="text-2xl font-bold">{monthTransactions.length}</div></div>
        </section>
        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2"><h3 className="mb-6 text-lg font-bold">Tren pengeluaran bulan ini</h3><div className="h-64">
            {daily.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={daily}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip formatter={(value) => [formatRupiah(Number(value)), "Pengeluaran"]} /><Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada pengeluaran bulan ini</div>}
          </div></div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"><h3 className="mb-2 text-lg font-bold">Pengeluaran per kategori</h3><div className="relative h-48">
            {categories.length ? <><ResponsiveContainer width="100%" height="100%"><RechartsPie><Pie data={categories} innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value">{categories.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => formatRupiah(Number(value))} /></RechartsPie></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xs text-slate-400">Pengeluaran</span><span className="text-sm font-bold">{formatRupiah(expenseTotal)}</span></div></> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data</div>}
          </div><div className="mt-4 flex flex-wrap justify-center gap-3">{categories.map((item) => <div key={item.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</div>)}</div></div>
        </section>
        <section className="mb-8 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40"><h3 className="text-lg font-bold">Rincian kategori</h3><p className="mt-1 text-sm text-slate-500">Kontribusi tiap kategori pada total pengeluaran bulan ini.</p>{categories.length ? <div className="mt-5 space-y-4">{categories.map((item) => <div key={item.name}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium">{item.name}</span><span className="text-slate-500">{formatRupiah(item.value)} · {expenseTotal ? Math.round((item.value / expenseTotal) * 100) : 0}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${expenseTotal ? (item.value / expenseTotal) * 100 : 0}%`, backgroundColor: item.color }} /></div></div>)}</div> : <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada pengeluaran untuk diringkas.</div>}</section>
        </>}

        {page === "transactions" && <>
        <section className="mb-8 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="mb-5"><h3 className="text-lg font-bold">Tambah transaksi</h3><p className="mt-1 text-sm text-slate-500">Masukkan pemasukan atau pengeluaran baru.</p></div>
          <form id="transaction-form" onSubmit={addTransaction} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium text-slate-600">Jenis<select name="transactionType" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-800" defaultValue="expense"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
            <label className="text-sm font-medium text-slate-600">Nominal (Rp)<input name="amount" type="number" min="1" step="1" required placeholder="50000" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800" /></label>
            <label className="text-sm font-medium text-slate-600">Deskripsi<input name="description" maxLength={200} required placeholder="Contoh: Gaji bulanan" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800" /></label>
            <label className="text-sm font-medium text-slate-600">Kategori<input name="category" maxLength={80} required placeholder="Contoh: Gaji" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800" /></label>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Menyimpan..." : "Tambah transaksi"}</button>
          </form>{formMessage && <p role="status" className={`mt-3 text-sm ${formError ? "text-red-600" : "text-emerald-600"}`}>{formMessage}</p>}
        </section>
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/40"><div className="border-b border-slate-100 p-6"><h3 className="text-lg font-bold">Semua transaksi</h3><p className="mt-1 text-sm text-slate-500">Cari, filter, edit, atau hapus catatanmu.</p>{deleteMessage && <p role="status" className={`mt-2 text-sm ${deleteError ? "text-red-600" : "text-emerald-600"}`}>{deleteMessage}</p>}</div><div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row">
          <input aria-label="Cari transaksi" value={transactionQuery} onChange={(event) => setTransactionQuery(event.target.value)} placeholder="Cari deskripsi atau kategori..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
          <select aria-label="Filter jenis transaksi" value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"><option value="all">Semua transaksi</option><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select>
          <button type="button" onClick={() => document.getElementById("transaction-form")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">+ Tambah transaksi</button>
        </div><div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="bg-slate-50 text-sm text-slate-500"><th className="px-6 py-4 font-medium">Tanggal</th><th className="px-6 py-4 font-medium">Deskripsi</th><th className="px-6 py-4 font-medium">Kategori</th><th className="px-6 py-4 font-medium">Nominal</th><th className="px-6 py-4 font-medium">Sumber</th><th className="px-6 py-4 text-right font-medium">Aksi</th></tr></thead><tbody className="text-sm">
          {visibleTransactions.length ? visibleTransactions.map((tx) => editingId === tx.id ? (
            <tr key={tx.id} className="border-b border-indigo-100 bg-indigo-50/50"><td colSpan={6} className="p-4">
              <form onSubmit={(event) => updateTransaction(event, tx.id)} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <label className="text-xs font-medium text-slate-600">Jenis<select name="transactionType" defaultValue={tx.transactionType} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
                <label className="text-xs font-medium text-slate-600">Nominal<input name="amount" type="number" min="1" step="1" required defaultValue={tx.amount} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-600 xl:col-span-2">Deskripsi<input name="description" maxLength={200} required defaultValue={tx.description} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-600">Kategori<input name="category" maxLength={80} required defaultValue={tx.category} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                <div className="flex gap-2"><button type="submit" disabled={updating} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{updating ? "Menyimpan..." : "Simpan"}</button><button type="button" disabled={updating} onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button></div>
              </form>
            </td></tr>
          ) : <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50"><td className="whitespace-nowrap px-6 py-4 text-slate-500">{new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td><td className="px-6 py-4 font-medium">{tx.description}</td><td className="px-6 py-4 text-slate-600">{tx.category} <span className="ml-1 text-xs text-slate-400">| {tx.transactionType === "income" ? "Pemasukan" : "Pengeluaran"}</span></td><td className={`whitespace-nowrap px-6 py-4 font-semibold ${tx.transactionType === "income" ? "text-emerald-600" : "text-red-500"}`}>{tx.transactionType === "income" ? "+" : "-"} {formatRupiah(tx.amount)}</td><td className="whitespace-nowrap px-6 py-4"><span className="flex items-center gap-1.5 text-slate-600">{tx.source === "Telegram" ? <Send className="h-4 w-4 text-blue-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}{tx.source}</span></td><td className="px-6 py-3 text-right"><div className="inline-flex items-center"><button type="button" onClick={() => { setDeleteMessage(""); setEditingId(tx.id); }} aria-label={`Edit transaksi ${tx.description}`} title="Edit transaksi" className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => deleteTransaction(tx)} disabled={deletingId === tx.id || editingId === tx.id} aria-label={`Hapus transaksi ${tx.description}`} title="Hapus transaksi" className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>) : <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">{transactions.length ? "Tidak ada transaksi yang cocok dengan pencarian atau filter." : "Belum ada transaksi. Tambahkan lewat formulir di atas atau Telegram."}</td></tr>}
        </tbody></table></div></section>
        </>}
        {page === "settings" && <>
        <section id="settings" className="scroll-mt-8 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="mb-5"><h3 className="text-lg font-bold">Pengaturan</h3><p className="mt-1 text-sm text-slate-500">Kelola akun dan preferensi pencatatanmu.</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
              <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700"><CircleUserRound className="h-5 w-5" /></div><div><h4 className="font-semibold">Akun SakuBot</h4><p className="mt-1 text-sm text-slate-500">Informasi akun yang sedang digunakan.</p></div></div>
              <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Username</dt><dd className="font-semibold">@{account.username}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Email</dt><dd className="max-w-[65%] truncate font-semibold">{account.email}</dd></div></dl>
              <form action="/api/auth/sign-out" method="post" className="mt-5 border-t border-slate-200 pt-4"><button className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"><LogOut className="h-4 w-4" />Keluar dari akun</button></form>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
              <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><Wallet className="h-5 w-5" /></div><div><h4 className="font-semibold">Preferensi pencatatan</h4><p className="mt-1 text-sm text-slate-500">Semua nominal disimpan sebagai rupiah Indonesia.</p></div></div>
              <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Mata uang</dt><dd className="font-semibold">Rupiah (IDR)</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Zona waktu tampilan</dt><dd className="font-semibold">Waktu lokal</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Telegram</dt><dd className={`font-semibold ${telegramLinked ? "text-emerald-700" : "text-slate-500"}`}>{telegramLinked ? "Terhubung" : "Belum terhubung"}</dd></div></dl>
              <Link href="/integrations" className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">Kelola integrasi Telegram</Link>
            </div>
          </div>
        </section>
        </>}
        <footer className="py-8 text-center text-xs text-slate-400">SakuBot · Catat uang dengan rapi</footer>
        </div>
      </main>
    </div>
  );
}



