"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setIsError(false);
    const values = new FormData(event.currentTarget);

    try {
      const password = String(values.get("password") ?? "");
      if (mode === "signup") {
        const username = String(values.get("username") ?? "").trim().toLowerCase();
        const email = String(values.get("email") ?? "").trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(username)) {
          throw new Error("Username harus 3–24 karakter, hanya huruf kecil, angka, atau garis bawah.");
        }
        const supabase = createSupabaseBrowser();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMessage("Akun dibuat. Cek email untuk verifikasi, lalu masuk dengan email atau username.");
        }
      } else {
        const response = await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: values.get("identifier"), password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Email/username atau password salah.");
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Ada masalah saat memproses akun.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-800">
      <section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-7 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-600 p-2.5"><Wallet className="h-6 w-6 text-white" /></div>
          <div><h1 className="text-xl font-bold">SakuBot</h1><p className="text-sm text-slate-500">Catat uang dengan rapi</p></div>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => { setMode("signin"); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signin" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>Masuk</button>
          <button type="button" onClick={() => { setMode("signup"); setMessage(""); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "signup" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>Daftar</button>
        </div>

        <h2 className="mb-1 text-2xl font-bold">{mode === "signin" ? "Selamat datang" : "Buat akun"}</h2>
        <p className="mb-6 text-sm text-slate-500">{mode === "signin" ? "Masuk dengan email atau username." : "Daftar dengan username, email, dan password."}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" ? <>
            <label className="block text-sm font-medium text-slate-700">Username
              <input name="username" required minLength={3} maxLength={24} autoComplete="username" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="contoh: rizki_01" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Email
              <input name="email" type="email" required autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="nama@email.com" />
            </label>
          </> : <label className="block text-sm font-medium text-slate-700">Email atau username
            <input name="identifier" required autoComplete="username" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="nama@email.com atau rizki_01" />
          </label>}
          <label className="block text-sm font-medium text-slate-700">Password
            <input name="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Minimal 8 karakter" />
          </label>
          {message && <p role="status" className={`text-sm ${isError ? "text-red-600" : "text-emerald-700"}`}>{message}</p>}
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{submitting ? "Memproses..." : mode === "signin" ? "Masuk" : "Daftar"}</button>
        </form>
      </section>
    </main>
  );
}
