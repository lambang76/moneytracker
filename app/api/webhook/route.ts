import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type TelegramUpdate = {
  update_id?: number;
  message?: { text?: string; date?: number; chat?: { id?: number; type?: string } };
  edited_message?: { text?: string; date?: number; chat?: { id?: number; type?: string } };
};

type TransactionType = "income" | "expense";
type ReportPeriod = "day" | "month";

const botCommands = [
  { command: "start", description: "Mulai dan lihat panduan SakuBot" },
  { command: "help", description: "Tampilkan daftar perintah" },
  { command: "saldo", description: "Lihat saldo saat ini" },
  { command: "hari_ini", description: "Ringkasan transaksi hari ini" },
  { command: "bulan_ini", description: "Ringkasan transaksi bulan ini" },
  { command: "kategori", description: "Pengeluaran terbesar per kategori" },
  { command: "terakhir", description: "Lihat 5 transaksi terbaru" },
  { command: "expense", description: "Catat pengeluaran baru" },
  { command: "income", description: "Catat pemasukan baru" },
  { command: "unlink", description: "Putuskan tautan akun Telegram" },
];

function isAuthorized(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function reply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN belum diatur; balasan Telegram tidak dapat dikirim.");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      cache: "no-store",
    });
    if (!response.ok) console.error("Telegram sendMessage gagal:", await response.text());
  } catch (error) {
    console.error("Tidak dapat mengirim balasan Telegram:", error);
  }
}

async function registerBotCommands() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: { type: "all_private_chats" }, commands: botCommands }),
      cache: "no-store",
    });
    const result = await response.json() as { ok?: boolean; description?: string };
    if (!response.ok || !result.ok) console.error("Telegram setMyCommands gagal:", result.description ?? response.statusText);
  } catch (error) {
    console.error("Tidak dapat mendaftarkan command Telegram:", error);
  }
}

function jakartaPeriodBounds(period: ReportPeriod) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  const offset = 7 * 60 * 60 * 1000;
  const startMs = period === "day"
    ? Date.UTC(values.year, values.month - 1, values.day) - offset
    : Date.UTC(values.year, values.month - 1, 1) - offset;
  const endMs = period === "day"
    ? Date.UTC(values.year, values.month - 1, values.day + 1) - offset
    : Date.UTC(values.year, values.month, 1) - offset;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), now };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
}

function formatRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
}

function parseTransaction(text: string) {
  const command = text.match(/^\/(expense|pengeluaran|income|pemasukan)(?:@\w+)?\s*/i);
  const transactionType: TransactionType = command && /^(income|pemasukan)$/i.test(command[1]) ? "income" : "expense";
  const body = (command ? text.slice(command[0].length) : text).trim();
  const parts = body.split("|").map((part) => part.trim());

  // Format utama: 25000 | Makan siang | Makanan.
  // Format singkat juga diterima: makan siang 25000.
  let amountText: string;
  let description: string;
  let category: string;
  if (parts.length >= 2) {
    amountText = parts[0].replace(/^(rp\.?\s*)/i, "").replace(/[^\d]/g, "");
    description = parts[1];
    category = parts[2] || "Lainnya";
  } else {
    const match = body.match(/^(.+?)\s+(?:rp\.?\s*)?([\d][\d.,]*)$/i);
    if (!match) return null;
    description = match[1].trim();
    amountText = match[2].replace(/[^\d]/g, "");
    category = "Lainnya";
  }

  const amount = Number(amountText);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !description) return null;
  return { amount, description, category, transaction_type: transactionType };
}

function helpText() {
  return [
    "<b>Perintah SakuBot</b>",
    "/hari_ini — ringkasan transaksi hari ini",
    "/bulan_ini — ringkasan transaksi bulan ini",
    "/kategori — pengeluaran terbesar per kategori",
    "/start — mulai dan lihat bantuan",
    "/help — daftar perintah",
    "/saldo — lihat saldo saat ini",
    "/terakhir — lihat 5 transaksi terbaru",
    "/unlink — putuskan tautan Telegram dari akun ini",
    "/expense 25000 | Makan siang | Makanan — catat pengeluaran",
    "/income 500000 | Uang mingguan | Pemasukan — catat pemasukan",
    "Bisa juga kirim singkat: <code>makan siang 25000</code> (pengeluaran).",
    "Gunakan <code>/link KODE</code> untuk menghubungkan akun dari dashboard.",
  ].join("\n");
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const message = update.message ?? update.edited_message;
  if (!message?.text || message.chat?.type !== "private" || !Number.isSafeInteger(message.chat.id)) {
    return Response.json({ ok: true, ignored: true });
  }

  const chatId = message.chat.id!;
  const text = message.text.trim();
  try {
    const supabase = createSupabaseAdmin();
    const linkCommand = text.match(/^\/link(?:@\w+)?\s+([a-f0-9]{16})\s*$/i);
    if (linkCommand) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: String(chatId), telegram_link_code: null, telegram_link_expires_at: null })
        .eq("telegram_link_code", linkCommand[1].toUpperCase())
        .gt("telegram_link_expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      if (error?.code === "23505") {
        await reply(chatId, "Chat Telegram ini sudah tertaut ke akun lain. Putuskan tautan dulu dari akun tersebut.");
        return Response.json({ ok: true, linked: false });
      }
      if (error) throw error;
      await reply(chatId, profile
        ? "✅ Telegram berhasil ditautkan ke akun SakuBot kamu!\n\nKirim <code>/help</code> untuk melihat perintah."
        : "❌ Kode tidak valid atau sudah kedaluwarsa. Buat kode baru dari dashboard lalu kirim <code>/link KODE</code>.");
      return Response.json({ ok: true, linked: Boolean(profile) });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();
    if (profileError) throw profileError;

    if (/^\/(start|help)(?:@\w+)?(?:\s|$)/i.test(text)) {
      await registerBotCommands();
      await reply(chatId, profile
        ? `Halo! Akun SakuBot kamu sudah terhubung.\n\n${helpText()}`
        : `Halo! Saya bot pencatat keuangan SakuBot.\nTautkan akun dari dashboard dengan mengirim <code>/link KODE</code>.\n\n${helpText()}`);
      return Response.json({ ok: true, command: "help" });
    }

    if (/^\/(unlink|logout|putuskan)(?:@\w+)?\s*$/i.test(text)) {
      if (!profile) {
        await reply(chatId, "Telegram ini belum tertaut ke akun SakuBot.");
        return Response.json({ ok: true, command: "unlink", linked: false });
      }

      const { error } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: null })
        .eq("id", profile.id);
      if (error) throw error;

      await reply(chatId, "✅ Telegram berhasil diputuskan dari akun SakuBot. Data dan transaksi kamu tetap tersimpan. Untuk menautkan lagi, buat kode baru di dashboard lalu kirim <code>/link KODE</code>.");
      return Response.json({ ok: true, command: "unlink", linked: false });
    }

    if (!profile) {
      await reply(chatId, "Akun Telegram belum tertaut. Buka dashboard SakuBot → Integrasi Telegram, buat kode, lalu kirim <code>/link KODE</code> di chat pribadi ini.");
      return Response.json({ ok: true, ignored: true, reason: "telegram_not_linked" });
    }

    if (/^\/saldo(?:@\w+)?\s*$/i.test(text)) {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", profile.id);
      if (error) throw error;
      const balance = (data ?? []).reduce((sum, item) =>
        sum + (item.transaction_type === "income" ? Number(item.amount) : -Number(item.amount)), 0);
      await reply(chatId, `💰 <b>Saldo saat ini</b>\n${formatRupiah(balance)}`);
      return Response.json({ ok: true, command: "balance" });
    }

    const periodCommand = text.match(/^\/(hari_ini|hariini|bulan_ini|bulanini)(?:@\w+)?\s*$/i);
    if (periodCommand) {
      const period: ReportPeriod = /bulan/i.test(periodCommand[1]) ? "month" : "day";
      const { start, end, now } = jakartaPeriodBounds(period);
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("user_id", profile.id)
        .gte("date", start)
        .lt("date", end);
      if (error) throw error;
      const totals = (data ?? []).reduce((sum, item) => {
        const amount = Number(item.amount);
        if (item.transaction_type === "income") sum.income += amount;
        else sum.expense += amount;
        return sum;
      }, { income: 0, expense: 0 });
      const label = period === "day"
        ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full" }).format(now)
        : new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", month: "long", year: "numeric" }).format(now);
      const net = totals.income - totals.expense;
      await reply(chatId, `<b>Ringkasan ${period === "day" ? "hari ini" : "bulan ini"}</b> · ${label}\nPemasukan: +${formatRupiah(totals.income)}\nPengeluaran: −${formatRupiah(totals.expense)}\nSelisih: ${net >= 0 ? "+" : "−"}${formatRupiah(Math.abs(net))}\nJumlah transaksi: ${data?.length ?? 0}`);
      return Response.json({ ok: true, command: period === "day" ? "today" : "month" });
    }

    if (/^\/kategori(?:@\w+)?\s*$/i.test(text)) {
      const { start, end } = jakartaPeriodBounds("month");
      const { data, error } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", profile.id)
        .eq("transaction_type", "expense")
        .gte("date", start)
        .lt("date", end);
      if (error) throw error;
      const totals = Object.entries((data ?? []).reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + Number(item.amount);
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const lines = totals.map(([category, amount], index) => `${index + 1}. ${escapeHtml(category)} — ${formatRupiah(amount)}`);
      await reply(chatId, lines.length ? `<b>Pengeluaran per kategori bulan ini</b>\n${lines.join("\n")}` : "Belum ada pengeluaran bulan ini.");
      return Response.json({ ok: true, command: "categories" });
    }

    if (/^\/terakhir(?:@\w+)?\s*$/i.test(text)) {
      const { data, error } = await supabase
        .from("transactions")
        .select("date, description, category, amount, transaction_type")
        .eq("user_id", profile.id)
        .order("date", { ascending: false })
        .limit(5);
      if (error) throw error;
      const lines = (data ?? []).map((item) => {
        const sign = item.transaction_type === "income" ? "+" : "−";
        const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(item.date));
        return `• ${date} — ${escapeHtml(item.description)} (${escapeHtml(item.category)}): ${sign}${formatRupiah(Number(item.amount))}`;
      });
      await reply(chatId, lines.length ? `<b>5 transaksi terbaru</b>\n${lines.join("\n")}` : "Belum ada transaksi yang tercatat.");
      return Response.json({ ok: true, command: "recent" });
    }

    if (/^\/(expense|pengeluaran|income|pemasukan)(?:@\w+)?(?:\s|$)/i.test(text) || !text.startsWith("/")) {
      const transaction = parseTransaction(text);
      if (!transaction) {
        await reply(chatId, "Format belum terbaca. Contoh:\n<code>/expense 25000 | Makan siang | Makanan</code>\n<code>/income 500000 | Uang mingguan | Pemasukan</code>");
        return Response.json({ ok: true, ignored: true, reason: "invalid_transaction_format" });
      }

      const { data, error } = await supabase.from("transactions").upsert(
        {
          ...transaction,
          date: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
          source: "Telegram",
          user_id: profile.id,
          telegram_update_id: update.update_id ?? null,
        },
        { onConflict: "telegram_update_id", ignoreDuplicates: true },
      ).select("id");
      if (error) throw error;
      if (!data?.length) {
        await reply(chatId, "Pesan transaksi ini sudah pernah diproses, jadi tidak saya catat dua kali.");
        return Response.json({ ok: true, duplicate: true });
      }
      const isIncome = transaction.transaction_type === "income";
      await reply(chatId,
        `✅ <b>${isIncome ? "Pemasukan" : "Pengeluaran"} berhasil dicatat</b>\n` +
        `${escapeHtml(transaction.description)} · ${escapeHtml(transaction.category)}\n` +
        `${isIncome ? "+" : "−"}${formatRupiah(transaction.amount)}\n\nKetik /saldo untuk cek saldo.`);
      return Response.json({ ok: true });
    }

    await reply(chatId, "Perintah belum dikenal. Ketik /help untuk melihat semua perintah.");
    return Response.json({ ok: true, ignored: true, reason: "unknown_command" });
  } catch (error) {
    console.error("Gagal memproses pesan Telegram:", error);
    await reply(chatId, "Maaf, pesan belum bisa diproses karena ada gangguan server. Coba lagi sebentar.");
    // Return 200 to avoid Telegram retrying a message after the user has received feedback.
    return Response.json({ ok: true, processed: false });
  }
}
