import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type TelegramUpdate = {
  update_id?: number;
  message?: { text?: string; date?: number; chat?: { id?: number; type?: string } };
  edited_message?: { text?: string; date?: number; chat?: { id?: number; type?: string } };
};

function isAuthorized(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function parseTransaction(text: string) {
  const command = text.match(/^\/(expense|pengeluaran|income|pemasukan)(?:@\w+)?\s*/i);
  const transactionType = command && /^(income|pemasukan)$/i.test(command[1]) ? "income" : "expense";
  const message = command ? text.slice(command[0].length) : text;
  const parts = message.trim().split("|").map((part) => part.trim());
  if (parts.length < 2) return null;

  const amountText = parts[0].replace(/^(rp\.?\s*)/i, "").replace(/[^\d]/g, "");
  const amount = Number(amountText);
  const description = parts[1];
  const category = parts[2] || "Lainnya";

  if (!Number.isSafeInteger(amount) || amount <= 0 || !description) return null;
  return { amount, description, category, transaction_type: transactionType };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const message = update.message ?? update.edited_message;
  if (!message?.text) return Response.json({ ok: true, ignored: true });

  // Keep the account connection private; group chats are not accepted.
  if (message.chat?.type !== "private" || !Number.isSafeInteger(message.chat.id)) {
    return Response.json({ ok: true, ignored: true });
  }
  const chatId = String(message.chat.id);

  try {
    const supabase = createSupabaseAdmin();
    const linkCommand = message.text.match(/^\/link(?:@\w+)?\s+([a-f0-9]{16})\s*$/i);
    if (linkCommand) {
      const { data: profile, error: linkError } = await supabase
        .from("profiles")
        .update({
          telegram_chat_id: chatId,
          telegram_link_code: null,
          telegram_link_expires_at: null,
        })
        .eq("telegram_link_code", linkCommand[1].toUpperCase())
        .gt("telegram_link_expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      if (linkError?.code === "23505") {
        return Response.json({ ok: true, ignored: true, reason: "telegram_chat_already_linked" });
      }
      if (linkError) throw linkError;
      return Response.json({ ok: true, linked: Boolean(profile) });
    }

    const transaction = parseTransaction(message.text);
    if (!transaction) {
      return Response.json({
        ok: true,
        ignored: true,
        hint: "Format: /expense 25000 | Makan siang | Makanan atau /income 500000 | Gaji | Pemasukan",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return Response.json({ ok: true, ignored: true, reason: "telegram_not_linked" });

    const { error } = await supabase.from("transactions").upsert(
      {
        ...transaction,
        date: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
        source: "Telegram",
        user_id: profile.id,
        telegram_update_id: update.update_id ?? null,
      },
      { onConflict: "telegram_update_id", ignoreDuplicates: true },
    );

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Gagal menyimpan transaksi Telegram:", error);
    return Response.json({ error: "Gagal menyimpan transaksi" }, { status: 500 });
  }
}
