import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import crypto from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const runtime = "nodejs";

const prisma = globalThis.__prisma__ || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const reviewSessions = new Map<
  string,
  { userId: string; fileHash: string; fileName: string; createdAt: number }
>();

const REVIEW_SESSION_TTL_MS = 30 * 60 * 1000;

type InvoiceItem = {
  item_name: string | null;
  quantity: string | null;
  unit: string | null;
  unit_price: string | null;
  unit_price_before_discount?: string | null;
  unit_price_gross?: string | null;
  discount_percent?: string | null;
  discount_amount?: string | null;
  net_total: string | null;
  vat_rate: string | null;
  vat_total: string | null;
  gross_total: string | null;
  pkwiu?: string | null;
  gtu?: string | null;
  code?: string | null;
};

type InvoiceData = {
  seller_nip: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_regon: string | null;

  buyer_nip: string | null;
  buyer_name: string | null;
  buyer_address: string | null;

  recipient_name?: string | null;
  recipient_address?: string | null;
  recipient_nip?: string | null;

  invoice_number: string | null;
  issue_date: string | null;
  sale_date: string | null;
  currency?: string | null;
  place_of_issue?: string | null;

  net_total: string | null;
  vat_total: string | null;
  gross_total: string | null;

  payment_due_date: string | null;
  payment_date: string | null;
  bank_account: string | null;
  payment_method?: string | null;
  paid: boolean | null;

  items: InvoiceItem[];

  vat_rate?: string | null;
  item_name?: string | null;
  quantity?: string | null;
  unit?: string | null;
  unit_price?: string | null;
};

type LineIssue = { line: number; fields: string[] };

type InputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
  | { type: "input_file"; filename: string; file_data: string };

const fieldLabels: Record<string, string> = {
  seller_nip: "NIP sprzedawcy",
  seller_name: "Nazwa sprzedawcy",
  seller_address: "Adres sprzedawcy",
  seller_regon: "REGON sprzedawcy",
  buyer_nip: "NIP nabywcy",
  buyer_name: "Nazwa nabywcy",
  buyer_address: "Adres nabywcy",
  recipient_name: "Nazwa odbiorcy",
  recipient_address: "Adres odbiorcy",
  recipient_nip: "NIP odbiorcy",
  invoice_number: "Numer faktury",
  issue_date: "Data wystawienia",
  sale_date: "Data sprzedaży",
  currency: "Waluta",
  place_of_issue: "Miejsce wystawienia",
  net_total: "Kwota netto",
  vat_total: "Kwota VAT",
  gross_total: "Kwota brutto",
  payment_due_date: "Termin płatności",
  payment_date: "Data zapłaty",
  bank_account: "Numer rachunku bankowego",
  payment_method: "Forma płatności",
  paid: "Czy zapłacono",
  items: "Pozycje faktury",
};

function cleanupReviewSessions() {
  const now = Date.now();
  for (const [key, session] of reviewSessions.entries()) {
    if (now - session.createdAt > REVIEW_SESSION_TTL_MS) {
      reviewSessions.delete(key);
    }
  }
}

function createReviewSession(userId: string, fileHash: string, fileName: string) {
  cleanupReviewSessions();
  const token = crypto.randomUUID();
  reviewSessions.set(token, { userId, fileHash, fileName, createdAt: Date.now() });
  return token;
}

function verifyReviewSession(token: string, userId: string, fileHash: string, fileName: string) {
  cleanupReviewSessions();
  const session = reviewSessions.get(token);
  if (!session) return false;
  return session.userId === userId && session.fileHash === fileHash && session.fileName === fileName;
}

function destroyReviewSession(token: string) {
  reviewSessions.delete(token);
}

function buildFileHash(bytes: Buffer, fileName: string, contentType: string) {
  return crypto
    .createHash("sha256")
    .update(bytes)
    .update("|")
    .update(fileName)
    .update("|")
    .update(contentType)
    .digest("hex");
}

async function getUserFromSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.session.update({
    where: { token: sessionToken },
    data: { expiresAt: newExpiresAt },
  });

  cookieStore.set("session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: newExpiresAt,
  });

  return session.user;
}

function extractOutputText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const texts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        texts.push(content.text);
      }
    }
  }

  return texts.join("\n").trim();
}

function extractFirstJsonObject(text: string): string {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Brak JSON w odpowiedzi modelu.");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  throw new Error("Nie udało się wyciąć poprawnego JSON.");
}

function parseInvoiceJson(rawText: string): InvoiceData {
  return JSON.parse(extractFirstJsonObject(rawText)) as InvoiceData;
}

function escapeXml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeSpaces(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeNip(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().replace(/^PL/i, "").replace(/[^\d]/g, "");
}

function hasNipFormat(value: string | null | undefined): boolean {
  return /^\d{10}$/.test(normalizeNip(value));
}

function normalizeRegon(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().replace(/[^\d]/g, "");
}

function normalizeBankAccount(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).trim().replace(/\s/g, "").replace(/^PL/i, "").replace(/[^\d]/g, "");
}

function normalizeDecimal(value: string | null | undefined, digits = 2): string {
  if (value == null || value === "") return "";
  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned) return "";
  const num = Number(cleaned);
  if (Number.isNaN(num)) return "";
  return num.toFixed(digits);
}

function normalizeQuantity(value: string | null | undefined): string {
  if (value == null || value === "") return "1.000000";
  const cleaned = String(value).trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num) || num <= 0) return "1.000000";
  return num.toFixed(6);
}

function normalizeVatRate(value: string | null | undefined): string {
  if (!value) return "";
  const raw = String(value).trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  if (["zw", "np", "oo"].includes(raw)) return raw === "oo" ? "0" : raw;
  const cleaned = raw.replace("%", "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return cleaned;
  return String(Number.isInteger(num) ? num : Number(num.toFixed(2)));
}

function normalizeCurrency(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "PLN";
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  if (raw.includes("PLN") || raw.includes("ZŁ")) return "PLN";
  if (raw.includes("EUR")) return "EUR";
  if (raw.includes("USD")) return "USD";
  return "PLN";
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) return "";
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dmy = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  const ymd = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return "";
}

function formatMidnightZulu(dateValue: string | null | undefined): string {
  const date = normalizeDate(dateValue);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00Z`;

  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T00:00:00Z`;
}

function splitAddress(address: string | null | undefined): { line1: string; line2: string } {
  const raw = normalizeSpaces(address);
  if (!raw) return { line1: "", line2: "" };

<<<<<<< HEAD
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { line1: parts[0], line2: parts.slice(1).join(", ") };

  const streetFirst = raw.match(/^(.+?\d+[A-Za-z\/\-]*)(?:\s+|,\s*)(\d{2}-\d{3}.*)$/);
  if (streetFirst) {
    return {
      line1: streetFirst[1].trim(),
=======
  const commaParts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const postalIndex = commaParts.findIndex((p) => /\b\d{2}-\d{3}\b/.test(p));
    if (postalIndex > 0) {
      const line1 = commaParts.slice(0, postalIndex).join(", ");
      const line2 = commaParts.slice(postalIndex).join(", ");
      return { line1, line2 };
    }
    return {
      line1: commaParts[0],
      line2: commaParts.slice(1).join(", "),
    };
  }

  const streetFirst = raw.match(/^(.*?\b\d+[A-Za-z\/-]*)(?:\s+|,\s*)(\d{2}-\d{3}.*)$/);
  if (streetFirst) {
    return {
      line1: streetFirst[1].trim().replace(/[,\s]+$/, ""),
>>>>>>> b64d6bc76030c3d96b47389aee4cc3c69e5094b9
      line2: streetFirst[2].trim(),
    };
  }

<<<<<<< HEAD
  const postalFirst = raw.match(/^(\d{2}-\d{3}\s+[^,]+)(?:\s+|,\s*)(.+)$/);
=======
  const postalFirst = raw.match(/^(\d{2}-\d{3}[^,]*)(?:\s+|,\s*)(.*)$/);
>>>>>>> b64d6bc76030c3d96b47389aee4cc3c69e5094b9
  if (postalFirst) {
    return {
      line1: postalFirst[2].trim(),
      line2: postalFirst[1].trim(),
    };
<<<<<<< HEAD
  }

  const postalMatch = raw.match(/^(.*?)(\d{2}-\d{3}.*)$/);
  if (postalMatch) {
    const left = postalMatch[1].trim().replace(/[,\s]+$/, "");
    const right = postalMatch[2].trim();
    if (left && /\d/.test(left)) {
      return { line1: left, line2: right };
    }
    if (right && /[A-Za-zĄĆĘŁŃÓŚŹŻ]/i.test(right)) {
      return { line1: left || raw, line2: right };
    }
=======
>>>>>>> b64d6bc76030c3d96b47389aee4cc3c69e5094b9
  }

  return { line1: raw, line2: "" };
}
function tag(name: string, value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value).trim();
  if (!str) return "";
  return `<${name}>${escapeXml(str)}</${name}>`;
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function nearlyEqual(a: number, b: number, tolerance = 0.05): boolean {
  return Math.abs(a - b) <= tolerance;
}

function toNum(value: string | null | undefined): number {
  const normalized = normalizeDecimal(value, 6);
  const num = Number(normalized);
  return Number.isNaN(num) ? NaN : num;
}

function buildSafeFilename(invoiceNumber: string | null | undefined): string {
  if (!invoiceNumber) return "faktura";
  return (
    String(invoiceNumber)
      .trim()
      .replace(/[\/\\]/g, "-")
      .replace(/[^\p{L}\p{N}._-]+/gu, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "faktura"
  );
}

function normalizeItem(item: Partial<InvoiceItem>): InvoiceItem {
  return {
    item_name: normalizeSpaces(item.item_name) || null,
    quantity: normalizeQuantity(item.quantity),
    unit: normalizeSpaces(item.unit) || "szt",
    unit_price: normalizeDecimal(item.unit_price, 2) || null,
    unit_price_before_discount: normalizeDecimal(item.unit_price_before_discount, 2) || null,
    unit_price_gross: normalizeDecimal(item.unit_price_gross, 2) || null,
    discount_percent: normalizeDecimal(item.discount_percent, 2) || null,
    discount_amount: normalizeDecimal(item.discount_amount, 2) || null,
    net_total: normalizeDecimal(item.net_total, 2) || null,
    vat_rate: normalizeVatRate(item.vat_rate) || null,
    vat_total: normalizeDecimal(item.vat_total, 2) || null,
    gross_total: normalizeDecimal(item.gross_total, 2) || null,
    pkwiu: normalizeSpaces(item.pkwiu) || null,
    gtu: normalizeSpaces(item.gtu) || null,
    code: normalizeSpaces(item.code) || null,
  };
}

function normalizeItems(items: Partial<InvoiceItem>[] | null | undefined): InvoiceItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map(normalizeItem)
    .filter((item) => item.item_name || item.net_total || item.gross_total || item.unit_price || item.quantity);
}

function buildLegacySingleItem(data: InvoiceData): InvoiceItem[] {
  const hasLegacy =
    data.item_name ||
    data.quantity ||
    data.unit ||
    data.unit_price ||
    data.net_total ||
    data.vat_total ||
    data.vat_rate;

  if (!hasLegacy) return [];
  return [
    normalizeItem({
      item_name: data.item_name ?? null,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      unit_price: data.unit_price ?? null,
      net_total: data.net_total ?? null,
      vat_rate: data.vat_rate ?? null,
      vat_total: data.vat_total ?? null,
      gross_total: data.gross_total ?? null,
    }),
  ];
}

function ensureItems(data: InvoiceData): InvoiceData {
  const normalizedItems = normalizeItems(data.items);
  if (normalizedItems.length > 0) return { ...data, items: normalizedItems };
  return { ...data, items: buildLegacySingleItem(data) };
}

function mergeManualItem(baseItem: InvoiceItem | undefined, rawManual: Record<string, unknown> | undefined): InvoiceItem {
  const source = baseItem ?? normalizeItem({});
  if (!rawManual) return source;

  const merged: Partial<InvoiceItem> = { ...source };
  for (const key of Object.keys(rawManual)) {
    const value = rawManual[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  return normalizeItem(merged);
}

function mergeManualData(baseData: InvoiceData, manualData: Record<string, unknown>): InvoiceData {
  const merged: InvoiceData = { ...baseData };

  for (const [key, value] of Object.entries(manualData)) {
    if (key === "items" && Array.isArray(value)) {
      const manualItems = value as Record<string, unknown>[];
      const maxLength = Math.max(baseData.items?.length || 0, manualItems.length);
      const mergedItems: InvoiceItem[] = [];
      for (let i = 0; i < maxLength; i++) {
        mergedItems.push(mergeManualItem(baseData.items?.[i], manualItems[i]));
      }
      merged.items = mergedItems;
      continue;
    }

    if (!(key in merged)) continue;

    if (key === "paid") {
      const normalized = String(value ?? "").trim().toLowerCase();
      if (["true", "1", "tak", "yes"].includes(normalized)) merged.paid = true;
      else if (["false", "0", "nie", "no"].includes(normalized)) merged.paid = false;
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      (merged as Record<string, unknown>)[key] = trimmed;
      continue;
    }

    (merged as Record<string, unknown>)[key] = value;
  }

  return merged;
}

function coalesce(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = normalizeSpaces(value);
    if (normalized) return normalized;
  }
  return null;
}

function applyDiscountMath(item: InvoiceItem): InvoiceItem {
  const result = { ...item };

  let qty = toNum(result.quantity);
  let unitAfter = toNum(result.unit_price);
  let unitBefore = toNum(result.unit_price_before_discount);
  let discountPercent = toNum(result.discount_percent);
  let discountAmount = toNum(result.discount_amount);
  let net = toNum(result.net_total);

  const hasQty = !Number.isNaN(qty) && qty > 0;
  const hasNet = !Number.isNaN(net) && net >= 0;

  if (hasQty && hasNet) {
    const derivedAfter = round2(net / qty);
    if (Number.isNaN(unitAfter) || !nearlyEqual(unitAfter, derivedAfter, 0.02)) {
      result.unit_price = derivedAfter.toFixed(2);
      unitAfter = derivedAfter;
    }
  }

  if (!Number.isNaN(unitBefore) && !Number.isNaN(unitAfter)) {
    const derivedDiscountAmount = round2(unitBefore - unitAfter);
    if (derivedDiscountAmount >= 0 && (Number.isNaN(discountAmount) || !nearlyEqual(discountAmount, derivedDiscountAmount, 0.02))) {
      result.discount_amount = derivedDiscountAmount.toFixed(2);
      discountAmount = derivedDiscountAmount;
    }

    if (unitBefore > 0) {
      const derivedDiscountPercent = round2((derivedDiscountAmount / unitBefore) * 100);
      if (derivedDiscountPercent >= 0 && (Number.isNaN(discountPercent) || !nearlyEqual(discountPercent, derivedDiscountPercent, 0.2))) {
        result.discount_percent = derivedDiscountPercent.toFixed(2);
      }
    }
  }

  if (Number.isNaN(unitBefore) && !Number.isNaN(unitAfter) && !Number.isNaN(discountPercent) && discountPercent >= 0 && discountPercent < 100) {
    result.unit_price_before_discount = round2(unitAfter / (1 - discountPercent / 100)).toFixed(2);
  }

  if (Number.isNaN(unitBefore) && !Number.isNaN(unitAfter) && !Number.isNaN(discountAmount)) {
    result.unit_price_before_discount = round2(unitAfter + discountAmount).toFixed(2);
  }

  return result;
}

function repairSingleItemMath(item: InvoiceItem): { item: InvoiceItem; math_problem: boolean; repaired: boolean } {
  let result = applyDiscountMath(item);
  let repaired = JSON.stringify(result) !== JSON.stringify(item);
  let math_problem = false;

  let qty = toNum(result.quantity);
  let unitPrice = toNum(result.unit_price);
  let net = toNum(result.net_total);
  let vat = toNum(result.vat_total);
  let gross = toNum(result.gross_total);
  const rateNum = Number(normalizeVatRate(result.vat_rate));

  const hasQty = !Number.isNaN(qty) && qty > 0;
  const hasUnitPrice = !Number.isNaN(unitPrice) && unitPrice >= 0;
  const hasNet = !Number.isNaN(net) && net >= 0;
  const hasGross = !Number.isNaN(gross) && gross >= 0;

  if (!hasUnitPrice && hasQty && hasNet) {
    result.unit_price = round2(net / qty).toFixed(2);
    unitPrice = toNum(result.unit_price);
    repaired = true;
  }

  if (!hasNet && hasQty && hasUnitPrice) {
    result.net_total = round2(qty * unitPrice).toFixed(2);
    net = toNum(result.net_total);
    repaired = true;
  }

  if ((result.vat_total == null || result.vat_total === "") && hasNet && hasGross) {
    result.vat_total = round2(gross - net).toFixed(2);
    vat = toNum(result.vat_total);
    repaired = true;
  }

  if ((result.vat_total == null || result.vat_total === "") && !Number.isNaN(net) && !Number.isNaN(rateNum)) {
    result.vat_total = round2((net * rateNum) / 100).toFixed(2);
    vat = toNum(result.vat_total);
    repaired = true;
  }

  if ((result.gross_total == null || result.gross_total === "") && !Number.isNaN(net) && !Number.isNaN(vat)) {
    result.gross_total = round2(net + vat).toFixed(2);
    gross = toNum(result.gross_total);
    repaired = true;
  }

  if (hasQty && hasUnitPrice && hasNet && !nearlyEqual(round2(qty * unitPrice), net, 0.2)) {
    math_problem = true;
  }

  if (!Number.isNaN(net) && !Number.isNaN(vat) && !Number.isNaN(gross) && !nearlyEqual(round2(net + vat), gross, 0.2)) {
    math_problem = true;
  }

  return { item: result, math_problem, repaired };
}

function validateAndRepairItems(items: InvoiceItem[]) {
  let repaired = false;
  let math_problem = false;
  const line_issues: LineIssue[] = [];

  const repairedItems = items.map((item, index) => {
    const check = repairSingleItemMath(item);
    if (check.repaired) repaired = true;
    if (check.math_problem) {
      math_problem = true;
      line_issues.push({
        line: index + 1,
        fields: ["quantity", "unit_price", "net_total", "vat_total", "gross_total"],
      });
    }
    return check.item;
  });

  return { items: repairedItems, math_problem, repaired, line_issues };
}

function computeTotalsFromItems(items: InvoiceItem[]) {
  if (!items.length) return { net_total: null, vat_total: null, gross_total: null };

  let net = 0;
  let vat = 0;
  let gross = 0;

  for (const item of items) {
    const itemNet = toNum(item.net_total);
    const itemVat = toNum(item.vat_total);
    const itemGross = toNum(item.gross_total);
    if (!Number.isNaN(itemNet)) net += itemNet;
    if (!Number.isNaN(itemVat)) vat += itemVat;
    if (!Number.isNaN(itemGross)) gross += itemGross;
  }

  if (gross === 0 && net >= 0 && vat >= 0) gross = net + vat;

  return {
    net_total: round2(net).toFixed(2),
    vat_total: round2(vat).toFixed(2),
    gross_total: round2(gross).toFixed(2),
  };
}

function finalizeData(raw: InvoiceData): InvoiceData {
  let data: InvoiceData = ensureItems(raw);

  data.seller_nip = normalizeNip(data.seller_nip) || null;
  data.buyer_nip = normalizeNip(data.buyer_nip) || null;
  data.recipient_nip = normalizeNip(data.recipient_nip) || null;
  data.seller_regon = normalizeRegon(data.seller_regon) || null;

  data.seller_name = coalesce(data.seller_name) ?? null;
  data.seller_address = coalesce(data.seller_address) ?? null;
  data.buyer_name = coalesce(data.buyer_name) ?? null;
  data.buyer_address = coalesce(data.buyer_address) ?? null;
  data.recipient_name = coalesce(data.recipient_name) ?? null;
  data.recipient_address = coalesce(data.recipient_address) ?? null;

  data.invoice_number = coalesce(data.invoice_number) ?? null;
  data.issue_date = normalizeDate(data.issue_date) || null;
  data.sale_date = normalizeDate(data.sale_date || data.issue_date) || null;
  data.payment_due_date = normalizeDate(data.payment_due_date) || null;
  data.payment_date = normalizeDate(data.payment_date) || null;
  data.bank_account = normalizeBankAccount(data.bank_account) || null;
  data.currency = normalizeCurrency(data.currency);

  if (!data.sale_date && data.issue_date) data.sale_date = data.issue_date;
  if (data.paid == null) {
    if (data.payment_date) data.paid = true;
    else if (data.payment_due_date) data.paid = false;
  }

  const itemCheck = validateAndRepairItems(data.items);
  data.items = itemCheck.items;

  const totalsFromItems = computeTotalsFromItems(data.items);
  data.net_total = normalizeDecimal(data.net_total, 2) || totalsFromItems.net_total;
  data.vat_total = normalizeDecimal(data.vat_total, 2) || totalsFromItems.vat_total;
  data.gross_total = normalizeDecimal(data.gross_total, 2) || totalsFromItems.gross_total;

  if (!data.gross_total && data.net_total && data.vat_total) {
    data.gross_total = round2(Number(data.net_total) + Number(data.vat_total)).toFixed(2);
  }

  return data;
}

function getVatBucketIndex(vatRate: string | null | undefined): 1 | 2 | 3 | 4 | 6 | 7 {
  const rate = normalizeVatRate(vatRate);
  if (rate === "23") return 1;
  if (rate === "8" || rate === "7") return 2;
  if (rate === "5") return 3;
  if (rate === "0") return 6;
  if (rate === "zw" || rate === "np") return 7;
  return 1;
}

function buildVatSummaryTags(items: InvoiceItem[]): string {
  const summary = new Map<number, { net: number; vat: number }>();

  for (const item of items) {
    const bucket = getVatBucketIndex(item.vat_rate);
    const current = summary.get(bucket) || { net: 0, vat: 0 };
    current.net += Number(normalizeDecimal(item.net_total, 2) || "0");
    current.vat += Number(normalizeDecimal(item.vat_total, 2) || "0");
    summary.set(bucket, current);
  }

  const chunks: string[] = [];
  const sorted = Array.from(summary.entries()).sort((a, b) => a[0] - b[0]);

  for (const [bucket, values] of sorted) {
    chunks.push(`<P_13_${bucket}>${round2(values.net).toFixed(2)}</P_13_${bucket}>`);
    if (bucket !== 6 && bucket !== 7) {
      chunks.push(`<P_14_${bucket}>${round2(values.vat).toFixed(2)}</P_14_${bucket}>`);
    }
  }

  return chunks.join("");
}

function hasSeparateRecipient(data: InvoiceData): boolean {
  const recipientName = normalizeSpaces(data.recipient_name);
  const recipientAddress = normalizeSpaces(data.recipient_address);
  const recipientNip = normalizeNip(data.recipient_nip);

  if (!recipientName && !recipientAddress && !recipientNip) return false;

  const buyerName = normalizeSpaces(data.buyer_name);
  const buyerAddress = normalizeSpaces(data.buyer_address);
  const buyerNip = normalizeNip(data.buyer_nip);

  const sameName = recipientName && buyerName && recipientName.toLowerCase() === buyerName.toLowerCase();
  const sameAddress = recipientAddress && buyerAddress && recipientAddress.toLowerCase() === buyerAddress.toLowerCase();
  const sameNip = recipientNip && buyerNip && recipientNip === buyerNip;

  if (sameName && (!recipientAddress || sameAddress) && (!recipientNip || sameNip)) return false;
  if (!recipientName && !recipientNip) return false;

  return true;
}

function buildPodmiot3Xml(data: InvoiceData): string {
  if (!hasSeparateRecipient(data)) return "";

  const recipientAddress = splitAddress(data.recipient_address);
  const recipientName = normalizeSpaces(data.recipient_name);
  const recipientNip = normalizeNip(data.recipient_nip);

  return `
  <Podmiot3>
    <DaneIdentyfikacyjne>
      ${tag("NIP", recipientNip)}
      ${tag("Nazwa", recipientName)}
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      ${tag("AdresL1", recipientAddress.line1)}
      ${tag("AdresL2", recipientAddress.line2)}
    </Adres>
    <Rola>2</Rola>
  </Podmiot3>`;
}


function hasSeparateRecipient(data: InvoiceData): boolean {
  const recipientName = normalizeSpaces(data.recipient_name);
  const recipientAddress = normalizeSpaces(data.recipient_address);
  const recipientNip = normalizeNip(data.recipient_nip);

  if (!recipientName && !recipientAddress && !recipientNip) return false;

  const buyerName = normalizeSpaces(data.buyer_name);
  const buyerAddress = normalizeSpaces(data.buyer_address);
  const buyerNip = normalizeNip(data.buyer_nip);

  const sameName = !!recipientName && !!buyerName && recipientName.toLowerCase() === buyerName.toLowerCase();
  const sameAddress = !!recipientAddress && !!buyerAddress && recipientAddress.toLowerCase() === buyerAddress.toLowerCase();
  const sameNip = !!recipientNip && !!buyerNip && recipientNip === buyerNip;

  return !(sameName && sameAddress && (!recipientNip || sameNip));
}

function buildPodmiot3Xml(data: InvoiceData): string {
  if (!hasSeparateRecipient(data)) return "";

  const recipientAddress = splitAddress(data.recipient_address);
  const recipientNip = normalizeNip(data.recipient_nip);

  return `
  <Podmiot3>
    <DaneIdentyfikacyjne>
      ${tag("NIP", recipientNip)}
      ${tag("Nazwa", data.recipient_name)}
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      ${tag("AdresL1", recipientAddress.line1)}
      ${tag("AdresL2", recipientAddress.line2)}
    </Adres>
    <Rola>2</Rola>
  </Podmiot3>`;
}

function buildXml(data: InvoiceData): string {
  const sellerNip = normalizeNip(data.seller_nip);
  const buyerNip = normalizeNip(data.buyer_nip);
  const sellerRegon = normalizeRegon(data.seller_regon);

  const issueDate = normalizeDate(data.issue_date);
  const saleDate = normalizeDate(data.sale_date || data.issue_date);
  const paymentDueDate = normalizeDate(data.payment_due_date);
  const paymentDate = normalizeDate(data.payment_date);
  const grossTotal = normalizeDecimal(data.gross_total, 2);
  const bankAccount = normalizeBankAccount(data.bank_account);
  const currency = normalizeCurrency(data.currency);

  const sellerAddress = splitAddress(data.seller_address);
  const buyerAddress = splitAddress(data.buyer_address);
  const podmiot3Xml = buildPodmiot3Xml(data);

  const paymentXml =
    data.paid === true
      ? [
          `<Zaplacono>1</Zaplacono>`,
          paymentDate ? `<DataZaplaty>${escapeXml(paymentDate)}</DataZaplaty>` : "",
          `<FormaPlatnosci>6</FormaPlatnosci>`,
          bankAccount ? `<RachunekBankowy><NrRB>${escapeXml(bankAccount)}</NrRB></RachunekBankowy>` : "",
        ].filter(Boolean).join("")
      : [
          paymentDueDate ? `<TerminPlatnosci><Termin>${escapeXml(paymentDueDate)}</Termin></TerminPlatnosci>` : "",
          `<FormaPlatnosci>6</FormaPlatnosci>`,
          bankAccount ? `<RachunekBankowy><NrRB>${escapeXml(bankAccount)}</NrRB></RachunekBankowy>` : "",
        ].filter(Boolean).join("");

  const stopkaXml = sellerRegon
    ? `
  <Stopka>
    <Rejestry>
      <REGON>${escapeXml(sellerRegon)}</REGON>
    </Rejestry>
  </Stopka>`
    : "";

  const podmiot3Xml = buildPodmiot3Xml(data);

  const itemsXml = data.items
    .map((item, index) => {
      const itemName = normalizeSpaces(item.item_name) || "Towar lub usługa";
      const unit = normalizeSpaces(item.unit) || "szt";
      const quantity = normalizeQuantity(item.quantity);
      const unitPrice = normalizeDecimal(item.unit_price || item.net_total || "0", 2);
      const itemNet = normalizeDecimal(item.net_total, 2) || "0.00";
      const itemVat = normalizeDecimal(item.vat_total, 2) || "0.00";
      const itemVatRate = normalizeVatRate(item.vat_rate) || "23";

      return `
    <FaWiersz>
      <NrWierszaFa>${index + 1}</NrWierszaFa>
      ${tag("P_7", itemName)}
      ${tag("P_8A", unit)}
      ${tag("P_8B", quantity)}
      ${tag("P_9A", unitPrice)}
      <P_10>0.00</P_10>
      ${tag("P_11", itemNet)}
      ${tag("P_11Vat", itemVat)}
      ${tag("P_12", itemVatRate)}
    </FaWiersz>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${escapeXml(formatMidnightZulu(issueDate))}</DataWytworzeniaFa>
    <SystemInfo>Wygenerowano na ksefxml.pl</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      ${tag("NIP", sellerNip)}
      ${tag("Nazwa", data.seller_name)}
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      ${tag("AdresL1", sellerAddress.line1)}
      ${tag("AdresL2", sellerAddress.line2)}
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      ${tag("NIP", buyerNip)}
      ${tag("Nazwa", data.buyer_name)}
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      ${tag("AdresL1", buyerAddress.line1)}
      ${tag("AdresL2", buyerAddress.line2)}
    </Adres>
    <JST>2</JST>
    <GV>2</GV>
  </Podmiot2>${podmiot3Xml}
  <Fa>
    <KodWaluty>${escapeXml(currency)}</KodWaluty>
    ${tag("P_1", issueDate)}
    ${tag("P_2", data.invoice_number)}
    ${tag("P_6", saleDate)}
    ${buildVatSummaryTags(data.items)}
    ${tag("P_15", grossTotal)}
    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie><P_19N>1</P_19N></Zwolnienie>
      <NoweSrodkiTransportu><P_22N>1</P_22N></NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy><P_PMarzyN>1</P_PMarzyN></PMarzy>
    </Adnotacje>
    <RodzajFaktury>VAT</RodzajFaktury>${itemsXml}
    <Platnosc>${paymentXml}</Platnosc>
  </Fa>${stopkaXml}
</Faktura>`;
}

function buildExtractionPrompt(sessionScope: string): string {
  return `
Wyciągnij dane z faktury i zwróć WYŁĄCZNIE czysty JSON.

BARDZO WAŻNE ZASADY IZOLACJI:
- analizujesz tylko ten jeden dokument
- nie używaj żadnych danych z wcześniejszych analiz
- nie dopisuj nazw towarów, kontrahentów ani pozycji z pamięci
- jeśli coś jest nieczytelne, ustaw null
- identyfikator sesji tej analizy: ${sessionScope}

BARDZO WAŻNE:
- buyer_* = dane Nabywcy
- recipient_* = dane Odbiorcy, jeśli występuje osobno
- jeśli dokument ma osobne sekcje NABYWCA i ODBIORCA, nie łącz ich
- recipient_name, recipient_address, recipient_nip mają zostać zwrócone osobno
- w XML recipient_* zostanie mapowany do Podmiot3 z Rola=2
- nie zgaduj danych
- jeśli czegoś nie ma, ustaw null
- jeśli występuje rabat:
  - unit_price = cena netto po rabacie
  - unit_price_before_discount = cena netto przed rabatem
  - discount_percent = rabat %
  - discount_amount = rabat kwotowy
- zwróć wyłącznie JSON

Struktura:
{
  "seller_nip": null,
  "seller_name": null,
  "seller_address": null,
  "seller_regon": null,
  "buyer_nip": null,
  "buyer_name": null,
  "buyer_address": null,
  "recipient_name": null,
  "recipient_address": null,
  "recipient_nip": null,
  "invoice_number": null,
  "issue_date": null,
  "sale_date": null,
  "currency": null,
  "place_of_issue": null,
  "net_total": null,
  "vat_total": null,
  "gross_total": null,
  "payment_due_date": null,
  "payment_date": null,
  "bank_account": null,
  "payment_method": null,
  "paid": null,
  "items": [{
    "item_name": null,
    "quantity": null,
    "unit": null,
    "unit_price": null,
    "unit_price_before_discount": null,
    "unit_price_gross": null,
    "discount_percent": null,
    "discount_amount": null,
    "net_total": null,
    "vat_rate": null,
    "vat_total": null,
    "gross_total": null,
    "pkwiu": null,
    "gtu": null,
    "code": null
  }]
}`;
}

async function extractInvoiceData(file: File, base64: string, sessionScope: string): Promise<InvoiceData> {
  const content: InputContent[] = [{ type: "input_text", text: buildExtractionPrompt(sessionScope) }];

  if (file.type.startsWith("image/")) {
    content.push({
      type: "input_image",
      image_url: `data:${file.type};base64,${base64}`,
      detail: "auto",
    });
  } else {
    content.push({
      type: "input_file",
      filename: file.name,
      file_data: `data:application/pdf;base64,${base64}`,
    });
  }

  const response = await openai.responses.create({
    model: "gpt-4.1",
    input: [{ role: "user", content }],
  });

  return parseInvoiceJson(extractOutputText(response));
}

async function validateWithSecondPass(file: File, base64: string, firstPassData: InvoiceData, sessionScope: string): Promise<InvoiceData> {
  const prompt = `
Sprawdź i popraw JSON z faktury.

BARDZO WAŻNE ZASADY IZOLACJI:
- analizujesz wyłącznie bieżący dokument
- nie używaj danych z wcześniejszych analiz ani innych użytkowników
- identyfikator sesji tej analizy: ${sessionScope}

Najważniejsze:
- odróżnij Nabywcę od Odbiorcy
- jeśli dokument zawiera osobny Odbiorca, pozostaw go w recipient_*
- nie kopiuj sum jako pozycji
- rozpoznaj rabaty i wymuś cenę po rabacie jako unit_price
- sprawdź matematykę:
  quantity × unit_price = net_total
  net_total + vat_total = gross_total

ZWRÓĆ WYŁĄCZNIE JSON.
JSON do weryfikacji:
${JSON.stringify(firstPassData, null, 2)}
`;

  const content: InputContent[] = [{ type: "input_text", text: prompt }];

  if (file.type.startsWith("image/")) {
    content.push({
      type: "input_image",
      image_url: `data:${file.type};base64,${base64}`,
      detail: "auto",
    });
  } else {
    content.push({
      type: "input_file",
      filename: file.name,
      file_data: `data:application/pdf;base64,${base64}`,
    });
  }

  const response = await openai.responses.create({
    model: "gpt-4.1",
    input: [{ role: "user", content }],
  });

  return parseInvoiceJson(extractOutputText(response));
}

function buildValidationDetails(
  data: InvoiceData,
  lineMissingFields: LineIssue[],
  totalsFromItems: { net_total: string | null; vat_total: string | null; gross_total: string | null },
  totalsMismatch: boolean
): string[] {
  const details: string[] = [];

  if (data.paid === true && !data.payment_date) {
    details.push("Zaznaczono fakturę jako opłaconą, ale brakuje daty zapłaty.");
  }

  lineMissingFields.forEach((issue) => {
    details.push(`Pozycja ${issue.line}: brakujące pola: ${issue.fields.join(", ")}.`);
  });

  if (totalsMismatch) {
    details.push(
      `Suma pozycji nie zgadza się z nagłówkiem. Z pozycji: netto ${totalsFromItems.net_total ?? "-"}, VAT ${totalsFromItems.vat_total ?? "-"}, brutto ${totalsFromItems.gross_total ?? "-"}.`
    );
  }

  return details;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ success: false, message: "Brak OPENAI_API_KEY na serwerze." }, { status: 500 });
    }

    if (!process.env.DATABASE_URL) {
      return Response.json({ success: false, message: "Brak DATABASE_URL na serwerze." }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const manualDataRaw = formData.get("manualData");
    const manualData =
      typeof manualDataRaw === "string" && manualDataRaw.trim()
        ? (JSON.parse(manualDataRaw) as Record<string, unknown>)
        : {};
    const manualDataConfirmed = String(formData.get("manualDataConfirmed") || "false") === "true";
    const reviewToken = String(formData.get("reviewToken") || "").trim();

    if (!file) {
      return Response.json({ success: false, message: "Nie wybrano pliku." }, { status: 400 });
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { success: false, message: "Obsługiwane formaty: PDF, PNG, JPG, JPEG, WEBP." },
        { status: 400 }
      );
    }

    const user = await getUserFromSession();
    if (!user) {
      return Response.json({ success: false, message: "Nie jesteś zalogowany." }, { status: 401 });
    }

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, credits: true },
    });

    if (!freshUser) {
      return Response.json({ success: false, message: "Nie znaleziono konta użytkownika." }, { status: 404 });
    }

    if (freshUser.credits < 1) {
      return Response.json({ success: false, message: "Brak kredytów na koncie.", credits_left: 0 }, { status: 402 });
    }

    const bytesArrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(bytesArrayBuffer);
    const base64 = bytes.toString("base64");
    const fileHash = buildFileHash(bytes, file.name, file.type);
    const sessionScope = `${freshUser.id.slice(0, 8)}:${fileHash.slice(0, 12)}`;

    if (manualDataConfirmed && !reviewToken) {
      return Response.json(
        { success: false, message: "Brak tokenu zatwierdzonej sesji analizy. Wgraj dokument ponownie." },
        { status: 409 }
      );
    }

    if (manualDataConfirmed && !verifyReviewSession(reviewToken, freshUser.id, fileHash, file.name)) {
      return Response.json(
        { success: false, message: "Sesja analizy wygasła albo nie pasuje do bieżącego dokumentu. Wgraj dokument ponownie." },
        { status: 409 }
      );
    }

    let data: InvoiceData;
    try {
      const firstPass = await extractInvoiceData(file, base64, sessionScope);
      const secondPass = await validateWithSecondPass(file, base64, firstPass, sessionScope);
      data = secondPass;
    } catch (parseError) {
      console.error("Błąd odczytu modelu:", parseError);
      return Response.json(
        { success: false, message: "Nie udało się poprawnie odczytać danych z faktury." },
        { status: 500 }
      );
    }

    data = mergeManualData(data, manualData);
    data = finalizeData(data);

    const itemCheck = validateAndRepairItems(data.items);
    data.items = itemCheck.items;

    const totalsFromItems = computeTotalsFromItems(data.items);

    const missingFields: string[] = [];
    const requiredFields = [
      "seller_nip",
      "seller_name",
      "buyer_nip",
      "buyer_name",
      "invoice_number",
      "issue_date",
      "net_total",
      "vat_total",
      "gross_total",
      "items",
    ];

    for (const field of requiredFields) {
      const value = data[field as keyof InvoiceData];
      if (
        value === null ||
        value === "" ||
        (field === "items" && (!Array.isArray(data.items) || data.items.length === 0))
      ) {
        missingFields.push(field);
      }
    }

    if (data.seller_nip && !hasNipFormat(data.seller_nip)) missingFields.push("seller_nip");
    if (data.buyer_nip && !hasNipFormat(data.buyer_nip)) missingFields.push("buyer_nip");
    if (data.recipient_nip && !hasNipFormat(data.recipient_nip)) missingFields.push("recipient_nip");

    const lineMissingFields: LineIssue[] = [];
    data.items.forEach((item, index) => {
      const lineFields: string[] = [];
      if (!item.item_name) lineFields.push("item_name");
      if (!item.quantity) lineFields.push("quantity");
      if (!item.unit) lineFields.push("unit");
      if (!item.unit_price && !item.net_total) lineFields.push("unit_price_or_net_total");
      if (!item.net_total && !item.gross_total) lineFields.push("net_total_or_gross_total");
      if (!item.vat_rate) lineFields.push("vat_rate");
      if (lineFields.length > 0) {
        lineMissingFields.push({ line: index + 1, fields: lineFields });
      }
    });

    const declaredNet = toNum(data.net_total);
    const declaredVat = toNum(data.vat_total);
    const declaredGross = toNum(data.gross_total);
    const summedNet = toNum(totalsFromItems.net_total);
    const summedVat = toNum(totalsFromItems.vat_total);
    const summedGross = toNum(totalsFromItems.gross_total);

    let totalsMismatch = false;
    if (!Number.isNaN(declaredNet) && !Number.isNaN(summedNet) && !nearlyEqual(declaredNet, summedNet, 0.2)) totalsMismatch = true;
    if (!Number.isNaN(declaredVat) && !Number.isNaN(summedVat) && !nearlyEqual(declaredVat, summedVat, 0.2)) totalsMismatch = true;
    if (!Number.isNaN(declaredGross) && !Number.isNaN(summedGross) && !nearlyEqual(declaredGross, summedGross, 0.2)) totalsMismatch = true;

    const uniqueMissingFields = [...new Set(missingFields)];
    const validationDetails = buildValidationDetails(data, lineMissingFields, totalsFromItems, totalsMismatch);

    if (!manualDataConfirmed) {
      const newReviewToken = createReviewSession(freshUser.id, fileHash, file.name);
      return Response.json(
        {
          success: false,
          requires_confirmation: true,
          review_token: newReviewToken,
          session_scope: sessionScope,
          message: "Przed wygenerowaniem XML sprawdź i zatwierdź wszystkie dane faktury.",
          missing_fields: uniqueMissingFields,
          invalid_fields: invalidFields,
          extracted_data: data,
          missing_field_labels: uniqueMissingFields.map((field) => fieldLabels[field] || field),
          math_problem: itemCheck.math_problem,
          auto_repaired: itemCheck.repaired,
          line_issues: itemCheck.line_issues,
          line_missing_fields: lineMissingFields,
          totals_mismatch: totalsMismatch,
          totals_from_items: totalsFromItems,
          validation_details: validationDetails,
          credits_left: freshUser.credits,
        },
        { status: 409 }
      );
    }

    if (
      itemCheck.math_problem ||
      lineMissingFields.length > 0 ||
      totalsMismatch ||
      uniqueMissingFields.length > 0 ||
      invalidFields.length > 0 ||
      validationDetails.length > 0
    ) {
      return Response.json(
        {
          success: false,
          requires_confirmation: true,
          review_token: reviewToken,
          session_scope: sessionScope,
          message: "Formularz wymaga dalszej korekty. XML nie został jeszcze wygenerowany.",
    if (itemCheck.math_problem || lineMissingFields.length > 0 || totalsMismatch || uniqueMissingFields.length > 0 || validationDetails.length > 0) {
      return Response.json(
        {
          success: false,
          message: "Brakują wymagane dane lub co najmniej jedna pozycja wymaga ręcznej korekty.",
>>>>>>> b64d6bc76030c3d96b47389aee4cc3c69e5094b9
          missing_fields: uniqueMissingFields,
          extracted_data: data,
          missing_field_labels: uniqueMissingFields.map((field) => fieldLabels[field] || field),
          math_problem: itemCheck.math_problem,
          auto_repaired: itemCheck.repaired,
          line_issues: itemCheck.line_issues,
          line_missing_fields: lineMissingFields,
          totals_mismatch: totalsMismatch,
          totals_from_items: totalsFromItems,
          validation_details: validationDetails,
          credits_left: freshUser.credits,
        },
        { status: 400 }
      );
    }

    const safeInvoiceNumber = buildSafeFilename(data.invoice_number);
    const xml = buildXml(data);
    destroyReviewSession(reviewToken);

    const [, updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: freshUser.id },
        data: { credits: { decrement: 1 } },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: freshUser.id },
        select: { credits: true },
      }),
      prisma.creditUsage.create({
        data: {
          userId: freshUser.id,
          creditsUsed: 1,
          invoiceName: file.name || `${safeInvoiceNumber}.xml`,
        },
      }),
    ]);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeInvoiceNumber}.xml"`,
        "x-credits-left": String(updatedUser.credits),
      },
    });
  } catch (error) {
    console.error("BŁĄD API:", error);

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Wystąpił błąd serwera podczas przetwarzania faktury.",
      },
      { status: 500 }
    );
  }
}
