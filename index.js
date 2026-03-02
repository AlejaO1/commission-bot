// =======================
// index.js (Render-ready)
// =======================
console.log("🔥 VERSION NUEVA DEL INDEX ACTIVA");
// Carga .env SOLO en local (en Render NO hace falta)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();

// Healthcheck para Render
app.get("/", (req, res) => {
  res.send("Bot is alive ✅");
});

// Render expone el puerto en process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require("discord.js");

function resolveDiscordToken() {
  const rawToken =
    process.env.DISCORD_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.TOKEN ||
    "";

  return rawToken.trim().replace(/^['\"]|['\"]$/g, "");
}

const DISCORD_TOKEN = resolveDiscordToken();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// =======================
// Logs de errores (CLAVE)
// =======================
client.on("error", console.error);
client.on("shardError", console.error);
client.on("warn", console.warn);

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// =======================
// ENV VARS
// =======================
const LEADS_CHANNEL_ID = process.env.LEADS_CHANNEL_ID || null;
const SCAN_CHANNEL_ID = process.env.SCAN_CHANNEL_ID;

const CHANNELS = new Set([
  process.env.BUYING_CHANNEL_ID,
  process.env.TRUSTED_BUYING_CHANNEL_ID,
].filter(Boolean)); // quita undefined/null

// ---------------- CONFIG ----------------
const TAT_MIN_DAYS = 7;
const TAT_MAX_DAYS = 14;

// Estilos permitidos
const STYLE_ALLOWED = [
  "anime",
  "semi-real", "semi real", "semireal", "semirealista",
  "semi realism", "semi-realism",
  "chibi",
  "cute",
  "goth", "gothic",
  "vampire",
  "castlevania",
  "hazbin", "hazbin hotel",
  "helluva", "helluva boss",
];

// Estilos NO deseados (solo invalidan si NO hay ninguno permitido)
const STYLE_DISALLOWED = [
  "cartoony",
  "hyperrealism",
  "photoreal",
  "photorealistic",
];

// Tipos que te interesan
const COMMISSION_KEYWORDS = [
  "icon","headshot","bust","bust up","bust-up",
  "half body","half-body",
  "middle body","middle-body","waist up","knee up",
  "full body","full-body",
  "chibi","animated chibi",
  "character sheet","reference sheet",
  "character design","character desing",
  "sketch","line work","lineart","clean sketch","line art",
  "outfit","clothing","custom outfit",
];

// Bloqueo duro
const HARD_BLOCK_KEYWORDS = [
  "adopt", "adopst", "adoptable", "adoptables",
  "anthro", "fursona",
  "furry",
];

// Background-only
const BG_TERMS = ["scenery", "background", "bg"];
const BG_ONLY_PHRASES = [
  "bg only",
  "background only",
  "scenery only",
  "only background",
  "only backgrounds",
  "only scenery",
  "backgrounds only",
  "scenery comms only",
];

// Señales de personajes
const CHARACTER_INDICATORS = [
  "character", "characters", "oc", "ocs", "couple", "portrait",
  "1 character", "2 characters", "two characters", "three characters",
  "full body", "half body", "headshot", "bust", "icon", "chibi",
  "character sheet", "reference sheet", "design",
];

// Pagos
const ALLOWED_PAYMENTS = ["paypal", "ko-fi", "kofi", "vgen"];
const DISALLOWED_PAYMENTS = [
  "cashapp", "cash app",
  "venmo",
  "robux",
  "giftcard", "gift card", "giftcards", "gift cards",
  "discord nitro", "nitro",
  "steam gift card", "steam card",
  "in-game", "ingame",
  "game currency",
];

const MINIMUMS_USD = {
  "sketch:headshot": 5,
  "sketch:half": 10,
  "sketch:full": 15,
  "lineart:headshot": 8,
  "lineart:half": 15,
  "lineart:full": 20,
  "flat:headshot": 15,
  "flat:half": 20,
  "flat:full": 25,
  "render:headshot": 20,
  "render:half": 25,
  "render:full": 30,
};

// ---------------- UTILS ----------------
function normalize(text) {
  return (text || "").toLowerCase();
}

function containsAny(text, arr) {
  return arr.some(k => text.includes(k));
}

function findFirst(text, arr) {
  return arr.find(k => text.includes(k)) || null;
}

function hasWord(text, word) {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(text);
}

function hasSemiRealism(text) {
  const t = normalize(text);
  return /\bsemi[-\s]?realism\b/i.test(t) || t.includes("semireal") || t.includes("semirealista");
}

// -------- Negative style requests (NO ANIME / NO CARTOON) --------
function hasForbiddenStyleRequest(text) {
  const t = normalize(text);

  const mentionsAnimeNeg =
    t.includes("no anime") ||
    t.includes("not anime") ||
    t.includes("dont want anime") ||
    t.includes("do not want anime") ||
    t.includes("nothing that looks like anime") ||
    t.includes("nothing that looks like generic anime") ||
    t.includes("no generic anime") ||
    /\bno\s+anime\b/i.test(t) ||
    /\bnot\s+anime\b/i.test(t);

  const mentionsCartoonNeg =
    t.includes("no cartoon") ||
    t.includes("no cartoons") ||
    t.includes("not cartoony") ||
    t.includes("nothing cartoony") ||
    t.includes("dont want cartoony") ||
    t.includes("do not want cartoony") ||
    /\bno\s+cartoon(s)?\b/i.test(t) ||
    /\bnot\s+cartoon(y)?\b/i.test(t);

  return mentionsAnimeNeg || mentionsCartoonNeg;
}

// -------- NSFW inteligente --------
function isRealNSFW(text) {
  const t = normalize(text);
  const negations = [
    "nothing nsfw",
    "no nsfw",
    "not nsfw",
    "non nsfw",
    "sfw",
    "nothing explicit",
    "no explicit",
    "not explicit",
  ];
  if (negations.some(p => t.includes(p))) return false;
  if (t.includes("nsfw")) return true;
  return false;
}

// -------- Style logic --------
function styleCheck(text) {
  const t = normalize(text);

  const hasAllowed = STYLE_ALLOWED.some(s => t.includes(s)) || hasSemiRealism(t);
  const hasDisallowedSimple = STYLE_DISALLOWED.some(s => t.includes(s));
  const hasRealismOnly = hasWord(t, "realism") && !hasSemiRealism(t);

  const hasDisallowed = hasDisallowedSimple || hasRealismOnly;
  const hasAnyStyleMention = hasAllowed || hasDisallowed;

  if (!hasAnyStyleMention) return { ok: true, reason: null, hasStyleInfo: false };
  if (hasAllowed) return { ok: true, reason: null, hasStyleInfo: true };
  return { ok: false, reason: "solo menciona estilos que no tomo", hasStyleInfo: true };
}

// -------- Background-only --------
function hasAnyBgTerm(text) {
  return BG_TERMS.some(k => text.includes(k));
}

function isBackgroundOnly(text) {
  const t = normalize(text);
  if (!hasAnyBgTerm(t)) return false;
  if (BG_ONLY_PHRASES.some(p => t.includes(p))) return true;

  const hasCharacters = containsAny(t, CHARACTER_INDICATORS) || containsAny(t, COMMISSION_KEYWORDS);
  return !hasCharacters;
}

// -------- Payment --------
function paymentCheck(text) {
  const t = normalize(text);

  const hasAllowed = ALLOWED_PAYMENTS.some(p => t.includes(p));
  const hasDisallowed = DISALLOWED_PAYMENTS.some(p => t.includes(p));
  const hasAnyPaymentMention = hasAllowed || hasDisallowed;

  if (!hasAnyPaymentMention) return { ok: true, reason: null, hasPaymentInfo: false };
  if (hasAllowed) return { ok: true, reason: null, hasPaymentInfo: true };

  return { ok: false, reason: "método de pago no compatible", hasPaymentInfo: true };
}

// -------- TAT --------
function extractDeadlineDays(text) {
  const t = normalize(text);
  const candidates = [];

  for (const m of t.matchAll(/\b(\d{1,3})\s*(h|hr|hrs|hour|hours)\b/g)) {
    const hrs = Number(m[1]);
    if (!Number.isNaN(hrs)) candidates.push(hrs / 24);
  }

  for (const m of t.matchAll(/\b(\d{1,3})\s*(d|day|days)\b/g)) {
    const days = Number(m[1]);
    if (!Number.isNaN(days)) candidates.push(days);
  }

  for (const m of t.matchAll(/\b(\d{1,2})\s*(w|wk|wks|week|weeks)\b/g)) {
    const w = Number(m[1]);
    if (!Number.isNaN(w)) candidates.push(w * 7);
  }

  if (t.includes("48hr") || t.includes("48 hrs") || t.includes("48hours") || t.includes("48 hours")) candidates.push(2);
  if (t.includes("24hr") || t.includes("24 hrs") || t.includes("24hours") || t.includes("24 hours")) candidates.push(1);

  if (t.includes("tomorrow")) candidates.push(1);
  if (t.includes("today")) candidates.push(0);
  if (t.includes("asap") || t.includes("urgent") || t.includes("rush")) candidates.push(0);

  for (const m of t.matchAll(/\bwithin\s+(\d{1,3})\s*(hours?|hrs?|hr|days?)\b/g)) {
    const n = Number(m[1]);
    const unit = m[2];
    if (Number.isNaN(n)) continue;
    if (unit.startsWith("h")) candidates.push(n / 24);
    else candidates.push(n);
  }

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

function tatCheck(text) {
  const days = extractDeadlineDays(text);
  if (days == null) return { ok: true, days: null, reason: null };

  if (days < TAT_MIN_DAYS) {
    return {
      ok: false,
      days,
      reason: `deadline muy ajustado (~${days.toFixed(2)} días). Mi TAT es ${TAT_MIN_DAYS}-${TAT_MAX_DAYS} días.`,
    };
  }

  return { ok: true, days, reason: null };
}

// -------- Budget (price + ranges) --------
function extractBudgetUSD(text) {
  const t = normalize(text);
  const tt = t.replace(/[–—]/g, "-");

  const priceRange = tt.match(/\bprice\b[^0-9$]{0,20}\$?\s*(\d{1,4})\s*-\s*\$?\s*(\d{1,4})/i);
  if (priceRange) return Number(priceRange[2]);

  const budgetRange = tt.match(/\bbudget\b[^0-9$]{0,20}\$?\s*(\d{1,4})\s*-\s*\$?\s*(\d{1,4})/i);
  if (budgetRange) return Number(budgetRange[2]);

  const paymentPriceRange = tt.match(/\b(payment|pay)\b[^0-9$]{0,40}\$?\s*(\d{1,4})\s*-\s*\$?\s*(\d{1,4})/i);
  if (paymentPriceRange) return Number(paymentPriceRange[3]);

  const greaterMatch = tt.match(/\b(?:budget\s*(?:is|=)?\s*)?>\s*\$?\s*(\d{1,4})/i);
  if (greaterMatch) return Number(greaterMatch[1]);

  const maxMatch = tt.match(/max(?:imum)?\s*(?:budget\s*)?(?:for\s*one\s*is\s*)?\$?\s*(\d{1,4})/i);
  if (maxMatch) return Number(maxMatch[1]);

  const budgetMatch = tt.match(/\bbudget\b[^0-9$]{0,20}\$?\s*(\d{1,4})/i);
  if (budgetMatch) return Number(budgetMatch[1]);

  const priceMatch = tt.match(/\bprice\b[^0-9$]{0,20}\$?\s*(\d{1,4})/i);
  if (priceMatch) return Number(priceMatch[1]);

  const moneyMatch = tt.match(/\$\s*(\d{1,4})|\b(\d{1,4})\s*usd\b/i);
  if (moneyMatch) return Number(moneyMatch[1] || moneyMatch[2]);

  return null;
}

function detectQualityTier(text) {
  const t = normalize(text);
  if (t.includes("render")) return "render";
  if (t.includes("flat")) return "flat";
  if (t.includes("lineart") || t.includes("line art")) return "lineart";
  if (t.includes("sketch")) return "sketch";
  return "lineart";
}

function detectBodySize(text) {
  const t = normalize(text);
  if (t.includes("headshot") || t.includes("icon") || t.includes("bust")) return "headshot";
  if (t.includes("half body") || t.includes("half-body")) return "half";
  if (t.includes("full body") || t.includes("full-body")) return "full";
  if (t.includes("character sheet") || t.includes("reference sheet")) return "sheet";
  return "half";
}

function estimateMinimum(text) {
  const tier = detectQualityTier(text);
  const size = detectBodySize(text);

  if (size === "sheet") {
    const key = `${tier}:full`;
    return (MINIMUMS_USD[key] ?? 0) * 2;
  }

  const key = `${tier}:${size}`;
  return MINIMUMS_USD[key] ?? null;
}

// ---------------- NOTIFY ----------------
async function notifyLead(msg, budget, minAdjusted, extraNote = null) {
  const embed = new EmbedBuilder()
    .setTitle("Nuevo lead detectado")
    .addFields(
      { name: "Budget", value: budget != null ? `$${budget}` : "No detectado", inline: true },
      { name: "Mínimo sugerido", value: minAdjusted != null ? `$${minAdjusted}` : "No estimado", inline: true },
      { name: "Nota", value: extraNote ?? "—" },
      { name: "Texto", value: (msg.content.slice(0, 900) || "(vacío)") }
    )
    .setTimestamp();

  if (LEADS_CHANNEL_ID) {
    const ch = await client.channels.fetch(LEADS_CHANNEL_ID).catch(() => null);
    if (ch) return ch.send({ embeds: [embed] });
  }
}

// ---------------- MESSAGE CREATE ----------------
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;

    // -------- MANUAL SCAN MODE (#scan-channel) --------
    if (msg.channelId === SCAN_CHANNEL_ID) {
      const text = normalize(msg.content);

      if (hasForbiddenStyleRequest(text)) {
        await msg.reply("🚫 Ignorado: el cliente explícitamente NO quiere anime/cartoon.");
        return;
      }

      if (isBackgroundOnly(text)) {
        await msg.reply("🚫 Ignorado: la request es SOLO scenery/background (sin personajes).");
        return;
      }

      if (isRealNSFW(text)) {
        await msg.reply("🚫 Ignorado: pide NSFW.");
        return;
      }

      const hardBlocked = findFirst(text, HARD_BLOCK_KEYWORDS);
      if (hardBlocked) {
        await msg.reply(`🚫 Ignorado: contiene keyword bloqueada (${hardBlocked}).`);
        return;
      }

      const pay = paymentCheck(text);
      if (!pay.ok) {
        await msg.reply("🚫 Ignorado: método de pago no compatible (solo acepto PayPal / Ko-fi / VGen).");
        return;
      }

      const tat = tatCheck(text);
      if (!tat.ok) {
        await msg.reply(`🚫 Ignorado: ${tat.reason}`);
        return;
      }

      const style = styleCheck(text);
      if (!style.ok) {
        await msg.reply(`🚫 Ignorado: ${style.reason}.`);
        return;
      }

      const budget = extractBudgetUSD(text);

      const okType = containsAny(text, COMMISSION_KEYWORDS);
      const okStyle = STYLE_ALLOWED.some(s => text.includes(s)) || hasSemiRealism(text) || !style.hasStyleInfo;
      const flexibleType = !okType && (budget !== null) && okStyle;

      const verdict = (okStyle && (okType || flexibleType)) ? "✅ MATCH" : "❌ NO MATCH";
      const minAdjusted = estimateMinimum(text);

      await notifyLead(
        msg,
        budget,
        minAdjusted,
        `SCAN: ${verdict}${pay.hasPaymentInfo ? " | Payment: OK" : " | Payment: no info"}${tat.days != null ? ` | Deadline: ~${tat.days.toFixed(2)}d` : ""}${style.hasStyleInfo ? " | Style: OK" : " | Style: no info"}`
      );

      await msg.reply(`${verdict}\nBudget: ${budget ?? "?"}${tat.days != null ? ` | Deadline: ~${tat.days.toFixed(2)}d` : ""}`);
      return;
    }

    // -------- AUTO MODE (buying channels) --------
    if (!CHANNELS.has(msg.channelId)) return;

    const text = normalize(msg.content);

    if (hasForbiddenStyleRequest(text)) return;
    if (isBackgroundOnly(text)) return;
    if (isRealNSFW(text)) return;

    const hardBlocked = findFirst(text, HARD_BLOCK_KEYWORDS);
    if (hardBlocked) return;

    const pay = paymentCheck(text);
    if (!pay.ok) return;

    const tat = tatCheck(text);
    if (!tat.ok) return;

    const style = styleCheck(text);
    if (!style.ok) return;

    const budget = extractBudgetUSD(text);
    const okType = containsAny(text, COMMISSION_KEYWORDS);

    const okStyle = STYLE_ALLOWED.some(s => text.includes(s)) || hasSemiRealism(text) || !style.hasStyleInfo;
    const flexibleType = !okType && (budget !== null) && okStyle;

    if (!(okType || flexibleType)) return;

    const minAdjusted = estimateMinimum(text);

    await notifyLead(
      msg,
      budget,
      minAdjusted,
      `AUTO: ✅ MATCH${pay.hasPaymentInfo ? " | Payment: OK" : " | Payment: no info"}${tat.days != null ? ` | Deadline: ~${tat.days.toFixed(2)}d` : ""}${style.hasStyleInfo ? " | Style: OK" : " | Style: no info"}`
    );

  } catch (err) {
    console.error(err);
  }
});

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`✅ Bot listo como ${client.user.tag}`);
  console.log(`Watching channels: ${[...CHANNELS].join(", ") || "(none)"}`);
});

// ---------------- LOGIN (con logs) ----------------
(async () => {
  if (!DISCORD_TOKEN) {
    console.log("❌ No se encontró token de Discord. Define DISCORD_BOT_TOKEN, DISCORD_TOKEN, BOT_TOKEN o TOKEN");
    return;
  }

  console.log("TOKEN PRESENT?", Boolean(DISCORD_TOKEN));
  console.log("SCAN_CHANNEL_ID:", process.env.SCAN_CHANNEL_ID);
  console.log("LEADS_CHANNEL_ID:", process.env.LEADS_CHANNEL_ID);

  client.login(DISCORD_TOKEN)
    .then(() => console.log("✅ login() OK"))
    .catch((err) => console.error("❌ login() FAILED:", err));
})();
