import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";

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

type InvoiceItem = {
  item_name: string | null;
  quantity: string | null;
  unit: string | null;
  unit_price: string | null;
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

const fieldLabels: Record<string, string> = {
  seller_nip: "NIP sprzedawcy",
  seller_name: "Nazwa sprzedawcy",
  seller_address: "Adres sprzedawcy",
  seller_regon: "REGON sprzedawcy",
  buyer_nip: "NIP nabywcy",
  buyer_name: "Nazwa nabywcy",
  buyer_address: "Adres nabywcy",
  invoice_number: "Numer faktury",
  issue_date: "Data wystawienia",
  sale_date: "Data sprzedaży",
  net_total: "Kwota netto",
  vat_total: "Kwota VAT",
  gross_total: "Kwota brutto",
  payment_due_date: "Termin płatności",
  payment_date: "Data zapłaty",
  bank_account: "Numer rachunku bankowego",
  paid: "Informacja o zapłacie",
  items: "Pozycje faktury",
};

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

function cleanJsonText(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
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
  if (num === 7) return "8";
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
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const ymd = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (ymd) {
    const yyyy = ymd[1];
    const mm = ymd[2].padStart(2, "0");
    const dd = ymd[3].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function formatMidnightZulu(dateValue: string | null | undefined): string {
  const date = normalizeDate(dateValue);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T00:00:00Z`;
  }

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00:00Z`;
}

function splitAddress(address: string | null | undefined): { line1: string; line2: string } {
  const raw = normalizeSpaces(address);
  if (!raw) return { line1: "", line2: "" };

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      line1: parts[0],
      line2: parts.slice(1).join(", "),
    };
  }

  const postalMatch = raw.match(/^(.*?)(\d{2}-\d{3}.*)$/);
  if (postalMatch) {
    return {
      line1: postalMatch[1].trim().replace(/[,\s]+$/, ""),
      line2: postalMatch[2].trim(),
    };
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
    .filter((item) => item.item_name || item.net_total || item.unit_price || item.quantity || item.code || item.pkwiu);
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
  if (normalizedItems.length > 0) {
    return { ...data, items: normalizedItems };
  }
  return { ...data, items: buildLegacySingleItem(data) };
}

function repairSingleItemMath(item: InvoiceItem): {
  item: InvoiceItem;
  math_problem: boolean;
  repaired: boolean;
} {
  const result = { ...item };
  let repaired = false;
  let math_problem = false;

  let qty = toNum(result.quantity);
  let unitPrice = toNum(result.unit_price);
  let net = toNum(result.net_total);
  let vat = toNum(result.vat_total);
  let gross = toNum(result.gross_total);

  const rateRaw = normalizeVatRate(result.vat_rate);
  const rateNum = Number(rateRaw);

  const hasQty = !Number.isNaN(qty) && qty > 0;
  const hasUnitPrice = !Number.isNaN(unitPrice) && unitPrice >= 0;
  const hasNet = !Number.isNaN(net) && net >= 0;

  if (hasQty && hasUnitPrice && hasNet) {
    const calculatedNet = round2(qty * unitPrice);

    if (!nearlyEqual(calculatedNet, net)) {
      math_problem = true;

      const derivedUnitPrice = round2(net / qty);
      if (derivedUnitPrice >= 0 && nearlyEqual(round2(qty * derivedUnitPrice), net)) {
        result.unit_price = derivedUnitPrice.toFixed(2);
        unitPrice = derivedUnitPrice;
        repaired = true;
        math_problem = false;
      }

      if (math_problem && unitPrice > 0) {
        const derivedQty = Number((net / unitPrice).toFixed(6));
        if (derivedQty > 0 && nearlyEqual(round2(derivedQty * unitPrice), net)) {
          result.quantity = derivedQty.toFixed(6);
          qty = derivedQty;
          repaired = true;
          math_problem = false;
        }
      }
    }
  }

  if ((!result.net_total || result.net_total === "") && hasQty && hasUnitPrice) {
    result.net_total = round2(qty * unitPrice).toFixed(2);
    net = toNum(result.net_total);
    repaired = true;
  }

  if ((!result.vat_total || result.vat_total === "") && !Number.isNaN(net) && !Number.isNaN(rateNum)) {
    result.vat_total = round2((net * rateNum) / 100).toFixed(2);
    vat = toNum(result.vat_total);
    repaired = true;
  }

  if ((!result.gross_total || result.gross_total === "") && !Number.isNaN(net) && !Number.isNaN(vat)) {
    result.gross_total = round2(net + vat).toFixed(2);
    gross = toNum(result.gross_total);
    repaired = true;
  }

  if (!Number.isNaN(net) && !Number.isNaN(vat) && !Number.isNaN(gross)) {
    if (!nearlyEqual(round2(net + vat), gross)) {
      math_problem = true;
    }
  }

  return { item: result, math_problem, repaired };
}

function validateAndRepairItems(items: InvoiceItem[]): {
  items: InvoiceItem[];
  math_problem: boolean;
  repaired: boolean;
  line_issues: Array<{ line: number; fields: string[] }>;
} {
  let repaired = false;
  let math_problem = false;
  const line_issues: Array<{ line: number; fields: string[] }> = [];

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

function computeTotalsFromItems(items: InvoiceItem[]): {
  net_total: string | null;
  vat_total: string | null;
  gross_total: string | null;
} {
  if (!items.length) {
    return { net_total: null, vat_total: null, gross_total: null };
  }

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

  if (gross === 0 && net >= 0 && vat >= 0) {
    gross = net + vat;
  }

  return {
    net_total: round2(net).toFixed(2),
    vat_total: round2(vat).toFixed(2),
    gross_total: round2(gross).toFixed(2),
  };
}

function mergeManualData(baseData: InvoiceData, manualData: Record<string, unknown>): InvoiceData {
  const merged: InvoiceData = { ...baseData };

  for (const [key, value] of Object.entries(manualData)) {
    if (key === "items" && Array.isArray(value)) {
      merged.items = normalizeItems(value as Partial<InvoiceItem>[]);
      continue;
    }

    if (!(key in merged)) continue;

    if (key === "paid") {
      const normalized = String(value ?? "").trim().toLowerCase();
      if (["true", "1", "tak", "yes"].includes(normalized)) merged.paid = true;
      else if (["false", "0", "nie", "no"].includes(normalized)) merged.paid = false;
      continue;
    }

    (merged as Record<string, unknown>)[key] = typeof value === "string" ? value.trim() || null : value;
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

function finalizeData(raw: InvoiceData): InvoiceData {
  let data: InvoiceData = ensureItems(raw);

  data.seller_nip = normalizeNip(data.seller_nip) || null;
  data.buyer_nip = normalizeNip(data.buyer_nip || data.recipient_nip) || null;
  data.seller_regon = normalizeRegon(data.seller_regon) || null;

  data.seller_name = coalesce(data.seller_name) ?? null;
  data.seller_address = coalesce(data.seller_address) ?? null;

  data.buyer_name = coalesce(data.buyer_name, data.recipient_name) ?? null;
  data.buyer_address = coalesce(data.buyer_address, data.recipient_address) ?? null;

  data.invoice_number = coalesce(data.invoice_number) ?? null;
  data.issue_date = normalizeDate(data.issue_date) || null;
  data.sale_date = normalizeDate(data.sale_date || data.issue_date) || null;

  data.payment_due_date = normalizeDate(data.payment_due_date) || null;
  data.payment_date = normalizeDate(data.payment_date) || null;
  data.bank_account = normalizeBankAccount(data.bank_account) || null;
  data.currency = normalizeCurrency(data.currency);

  if (!data.sale_date && data.issue_date) {
    data.sale_date = data.issue_date;
  }

  const itemCheck = validateAndRepairItems(data.items);
  data.items = itemCheck.items;

  const totalsFromItems = computeTotalsFromItems(data.items);

  data.net_total = normalizeDecimal(data.net_total, 2) || totalsFromItems.net_total;
  data.vat_total = normalizeDecimal(data.vat_total, 2) || totalsFromItems.vat_total;
  data.gross_total = normalizeDecimal(data.gross_total, 2) || totalsFromItems.gross_total;

  if (data.paid == null) {
    if (data.payment_date) data.paid = true;
    else if (data.payment_due_date) data.paid = false;
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

  const paymentMethodCode = "6";

  const paymentXml =
    data.paid === true
      ? [
          `<Zaplacono>1</Zaplacono>`,
          paymentDate ? `<DataZaplaty>${escapeXml(paymentDate)}</DataZaplaty>` : "",
          `<FormaPlatnosci>${paymentMethodCode}</FormaPlatnosci>`,
          bankAccount ? `<RachunekBankowy><NrRB>${escapeXml(bankAccount)}</NrRB></RachunekBankowy>` : "",
        ]
          .filter(Boolean)
          .join("")
      : [
          paymentDueDate ? `<TerminPlatnosci><Termin>${escapeXml(paymentDueDate)}</Termin></TerminPlatnosci>` : "",
          `<FormaPlatnosci>${paymentMethodCode}</FormaPlatnosci>`,
          bankAccount ? `<RachunekBankowy><NrRB>${escapeXml(bankAccount)}</NrRB></RachunekBankowy>` : "",
        ]
          .filter(Boolean)
          .join("");

  const stopkaXml = sellerRegon
    ? `
  <Stopka>
    <Rejestry>
      <REGON>${escapeXml(sellerRegon)}</REGON>
    </Rejestry>
  </Stopka>`
    : "";

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

  const vatSummaryXml = buildVatSummaryTags(data.items);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${escapeXml(formatMidnightZulu(issueDate))}</DataWytworzeniaFa>
    <SystemInfo>Wygenerowano lokalnie</SystemInfo>
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
  </Podmiot2>
  <Fa>
    <KodWaluty>${escapeXml(currency)}</KodWaluty>
    ${tag("P_1", issueDate)}
    ${tag("P_2", data.invoice_number)}
    ${tag("P_6", saleDate)}
    ${vatSummaryXml}
    ${tag("P_15", grossTotal)}
    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie>
        <P_19N>1</P_19N>
      </Zwolnienie>
      <NoweSrodkiTransportu>
        <P_22N>1</P_22N>
      </NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy>
        <P_PMarzyN>1</P_PMarzyN>
      </PMarzy>
    </Adnotacje>
    <RodzajFaktury>VAT</RodzajFaktury>${itemsXml}
    <Platnosc>${paymentXml}</Platnosc>
  </Fa>${stopkaXml}
</Faktura>`;
}

function buildExtractionPrompt(): string {
  return `
Wyciągnij dane z faktury i zwróć WYŁĄCZNIE czysty JSON.

CEL:
Masz poprawnie odczytać polskie faktury w bardzo różnych układach:
- klasyczne faktury VAT
- faktury z blokami Sprzedawca / Nabywca / Odbiorca
- faktury z tabelą pozycji w różnych kolejnościach kolumn
- faktury ze starym layoutem, kodami PKWiU/GTU/kodami towarów
- faktury PDF lub zdjęcia/skany

ZASADY OGÓLNE:
- nie zgaduj danych
- jeśli czegoś nie ma na fakturze, ustaw null
- analizuj CAŁĄ fakturę: nagłówek, bloki kontrahentów, tabelę pozycji, sekcję płatności, stopkę
- zwróć tylko JSON, bez komentarzy i bez markdown
- seller_nip i buyer_nip zwracaj bez prefiksu kraju
- buyer_nip ma być NIP-em NABYWCY, nie numerem klienta, nie numerem odbiorcy wewnętrznym
- jeżeli na dokumencie występują jednocześnie "Nabywca" i "Odbiorca", to:
  - buyer_* = dane nabywcy
  - recipient_* = dane odbiorcy
- jeśli brakuje bloku "Nabywca", ale jest tylko jeden blok klienta po stronie kupującego, użyj go jako buyer_*
- jeśli jest informacja o zapłacie, opłacono, saldo 0, do zapłaty 0, ustaw paid=true
- jeśli jest termin płatności, ale brak informacji o opłaceniu, ustaw paid=false
- kwoty zwracaj bez waluty
- currency zwracaj jako kod, np. PLN, EUR, USD

ROZPOZNAWANIE PÓL:
- numer faktury: "Faktura nr", "Nr", "FV", "Invoice", "Faktura VAT nr"
- data wystawienia: "Data wystawienia", "Wystawiono dnia", "Wystawiono", "Data faktury"
- data sprzedaży: "Data sprzedaży", "Sprzedaż", "Data dostawy", "Data dokonania dostawy", "Data wykonania usługi"
- place_of_issue: miejsce wystawienia, np. miasto obok daty wystawienia
- bank_account: numer rachunku / konto bankowe / rachunek bankowy
- payment_due_date: termin płatności
- payment_date: data zapłaty
- payment_method: przelew / gotówka / karta / pobranie
- seller_name / seller_address / seller_nip: blok sprzedawcy / wystawcy
- buyer_name / buyer_address / buyer_nip: blok nabywcy / klienta / kupującego
- recipient_name / recipient_address / recipient_nip: blok odbiorcy, jeśli występuje osobno
- seller_regon: tylko jeśli faktycznie widoczny na dokumencie

BARDZO WAŻNE DLA TABELI POZYCJI:
- obsługuj WIELE pozycji faktury
- zwracaj wszystkie pozycje w tablicy "items"
- NIE myl kolumn:
  - PKWiU / GTU / kod / indeks / symbol / materiał / SKU to NIE jest ilość
  - ilość to osobna kolumna
  - jednostka (Jm, j.m., jm, unit) to osobna kolumna
  - cena netto / cena jedn. netto / cena po rabacie to osobna kolumna
  - wartość netto to osobna kolumna
  - VAT / stawka VAT to osobna kolumna
  - kwota VAT to osobna kolumna
  - wartość brutto to osobna kolumna
- jeśli tabela ma kolumny w innej kolejności, odczytaj je po NAGŁÓWKACH, nie po pozycji
- jeśli w jednej linii są jednocześnie kod i nazwa, item_name ma zawierać nazwę, a code/pkwiu/gtu odczytaj osobno gdy występują
- jeśli VAT jest podany jako 7%, zachowaj odczyt z dokumentu
- dla każdej pozycji postaraj się odczytać:
  item_name, quantity, unit, unit_price, net_total, vat_rate, vat_total, gross_total, pkwiu, gtu, code
- jeśli pozycja nie ma brutto, ustaw gross_total=null
- jeśli pozycja nie ma kwoty VAT, ustaw vat_total=null
- jeśli pozycja ma tylko wartość netto i stawkę VAT, nie wyliczaj nic samodzielnie, ustaw brakujące pola null

WYMUSZENIA JAKOŚCI:
- jeśli faktura ma więcej niż 1 pozycję, w items muszą być wszystkie pozycje
- nie kopiuj sumy "Razem" jako osobnej pozycji
- nie kopiuj wierszy "W tym", "Razem", "Podsumowanie", "Do zapłaty" jako itemów
- nie zamieniaj "Odbiorca" na "Nabywca", jeśli obie sekcje są obecne
- nie traktuj numerów kont, kodów kreskowych ani numeru zamówienia jako NIP
- jeśli na dokumencie jest tylko numer wewnętrzny klienta, to buyer_nip ustaw null
- jeśli na fakturze są stare układy z 7% VAT, odczytaj je poprawnie z dokumentu

Zwróć JSON dokładnie w tej strukturze:
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
  "items": [
    {
      "item_name": null,
      "quantity": null,
      "unit": null,
      "unit_price": null,
      "net_total": null,
      "vat_rate": null,
      "vat_total": null,
      "gross_total": null,
      "pkwiu": null,
      "gtu": null,
      "code": null
    }
  ]
}`;
}

type InputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
  | { type: "input_file"; filename: string; file_data: string };

async function extractInvoiceData(file: File, base64: string): Promise<InvoiceData> {
  const content: InputContent[] = [{ type: "input_text", text: buildExtractionPrompt() }];

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

  const output = cleanJsonText(extractOutputText(response));
  return JSON.parse(output) as InvoiceData;
}

async function validateWithSecondPass(file: File, base64: string, firstPassData: InvoiceData): Promise<InvoiceData> {
  const secondPassPrompt = `
Masz dwa zadania:
1) sprawdzić poprawność wcześniej odczytanych danych z faktury,
2) poprawić JSON, jeśli widzisz błąd.

Najczęstsze błędy do wychwycenia:
- pomylenie nabywcy z odbiorcą
- błędny NIP nabywcy lub sprzedawcy
- odczytanie "Razem" jako pozycji faktury
- pomylenie PKWiU / GTU / kodu z ilością
- przesunięcie kolumn w tabeli
- brak części pozycji przy wielowierszowej fakturze
- wpisanie kwot z podsumowania zamiast z wiersza pozycji
- błędne rozpoznanie stawki VAT 7% / 8% / 5%
- wzięcie numeru konta, kodu kreskowego albo numeru zamówienia za NIP albo numer faktury

Masz poprawić JSON i zwrócić WYŁĄCZNIE czysty JSON w tej samej strukturze.
Oto kandydat JSON do weryfikacji:
${JSON.stringify(firstPassData, null, 2)}
`;

  const content: InputContent[] = [{ type: "input_text", text: secondPassPrompt }];

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

  const output = cleanJsonText(extractOutputText(response));
  return JSON.parse(output) as InvoiceData;
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

    if (!file) {
      return Response.json({ success: false, message: "Nie wybrano pliku." }, { status: 400 });
    }

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];

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
      return Response.json(
        { success: false, message: "Brak kredytów na koncie.", credits_left: 0 },
        { status: 402 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    let data: InvoiceData;

    try {
      const firstPass = await extractInvoiceData(file, base64);
      const secondPass = await validateWithSecondPass(file, base64, firstPass);
      data = secondPass;
    } catch (parseError) {
      console.error("Błąd odczytu modelu:", parseError);
      return Response.json(
        {
          success: false,
          message: "Nie udało się poprawnie odczytać danych z faktury.",
        },
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

    if (data.seller_nip && !hasNipFormat(data.seller_nip)) {
      missingFields.push("seller_nip");
    }

    if (data.buyer_nip && !hasNipFormat(data.buyer_nip)) {
      missingFields.push("buyer_nip");
    }

    const lineMissingFields: Array<{ line: number; fields: string[] }> = [];

    data.items.forEach((item, index) => {
      const lineFields: string[] = [];
      if (!item.item_name) lineFields.push("item_name");
      if (!item.quantity) lineFields.push("quantity");
      if (!item.unit) lineFields.push("unit");
      if (!item.unit_price) lineFields.push("unit_price");
      if (!item.net_total) lineFields.push("net_total");
      if (!item.vat_rate) lineFields.push("vat_rate");
      if (!item.vat_total) lineFields.push("vat_total");
      if (!item.gross_total) lineFields.push("gross_total");

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
    if (!Number.isNaN(declaredNet) && !Number.isNaN(summedNet) && !nearlyEqual(declaredNet, summedNet)) totalsMismatch = true;
    if (!Number.isNaN(declaredVat) && !Number.isNaN(summedVat) && !nearlyEqual(declaredVat, summedVat)) totalsMismatch = true;
    if (!Number.isNaN(declaredGross) && !Number.isNaN(summedGross) && !nearlyEqual(declaredGross, summedGross)) totalsMismatch = true;

    const uniqueMissingFields = [...new Set(missingFields)];

    if (itemCheck.math_problem || lineMissingFields.length > 0 || totalsMismatch || uniqueMissingFields.length > 0) {
      return Response.json(
        {
          success: false,
          message:
            "Brakują wymagane dane, część pozycji ma nieprawidłowy format albo matematyka pozycji nie zgadza się z fakturą.",
          missing_fields: uniqueMissingFields,
          extracted_data: data,
          missing_field_labels: uniqueMissingFields.map((field) => fieldLabels[field] || field),
          math_problem: itemCheck.math_problem,
          auto_repaired: itemCheck.repaired,
          line_issues: itemCheck.line_issues,
          line_missing_fields: lineMissingFields,
          totals_mismatch: totalsMismatch,
          totals_from_items: totalsFromItems,
          credits_left: freshUser.credits,
        },
        { status: 400 }
      );
    }

    const safeInvoiceNumber = buildSafeFilename(data.invoice_number);
    const xml = buildXml(data);

    const [, updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: freshUser.id },
        data: {
          credits: {
            decrement: 1,
          },
        },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: freshUser.id },
        select: {
          credits: true,
        },
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
