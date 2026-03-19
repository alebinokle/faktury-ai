import OpenAI from "openai";

type InvoiceData = {
  seller_nip: string | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_regon: string | null;
  buyer_nip: string | null;
  buyer_name: string | null;
  buyer_address: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  sale_date: string | null;
  net_total: string | null;
  vat_total: string | null;
  gross_total: string | null;
  vat_rate: string | null;
  item_name: string | null;
  quantity: string | null;
  unit: string | null;
  unit_price: string | null;
  payment_due_date: string | null;
  payment_date: string | null;
  bank_account: string | null;
  paid: boolean | null;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  vat_rate: "Stawka VAT",
  item_name: "Nazwa towaru lub usługi",
  quantity: "Ilość",
  unit: "Jednostka miary",
  unit_price: "Cena jednostkowa",
  payment_due_date: "Termin płatności",
  payment_date: "Data zapłaty",
  bank_account: "Numer rachunku bankowego",
  paid: "Informacja o zapłacie",
};

function cleanJsonText(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
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
  return String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/^PL/i, "")
    .replace(/[^\d]/g, "");
}

function normalizeDecimal(value: string | null | undefined, digits = 2): string {
  if (!value) return "";
  const cleaned = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return cleaned;
  return num.toFixed(digits);
}

function normalizeQuantity(value: string | null | undefined): string {
  if (!value) return "1.000000";
  const cleaned = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return "1.000000";
  return num.toFixed(6);
}

function normalizeVatRate(value: string | null | undefined): string {
  if (!value) return "23";
  const cleaned = String(value).trim().replace(",", ".").replace("%", "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return cleaned;
  return String(Number.isInteger(num) ? num : Number(num.toFixed(2)));
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) return "";

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

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

  return raw;
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
  if (!address) return { line1: "", line2: "" };

  const raw = String(address).trim().replace(/\s+/g, " ");
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);

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

function buildXml(data: InvoiceData): string {
  const sellerNip = normalizeNip(data.seller_nip);
  const buyerNip = normalizeNip(data.buyer_nip);
  const sellerRegon = normalizeRegon(data.seller_regon);

  const issueDate = normalizeDate(data.issue_date);
  const saleDate = normalizeDate(data.sale_date || data.issue_date);
  const paymentDueDate = normalizeDate(data.payment_due_date);
  const paymentDate = normalizeDate(data.payment_date || data.issue_date);

  const netTotal = normalizeDecimal(data.net_total, 2);
  const vatTotal = normalizeDecimal(data.vat_total, 2);
  const grossTotal = normalizeDecimal(data.gross_total, 2);
  const quantity = normalizeQuantity(data.quantity);
  const unitPrice = normalizeDecimal(data.unit_price || data.net_total || "0", 2);
  const vatRate = normalizeVatRate(data.vat_rate);
  const bankAccount = normalizeBankAccount(data.bank_account);

  const sellerAddress = splitAddress(data.seller_address);
  const buyerAddress = splitAddress(data.buyer_address);

  const itemName = (data.item_name || "Towar lub usługa").trim();
  const unit = (data.unit || "szt").trim();

  const paymentXml =
    data.paid === true
      ? [
          `<Zaplacono>1</Zaplacono>`,
          paymentDate ? `<DataZaplaty>${escapeXml(paymentDate)}</DataZaplaty>` : "",
          `<FormaPlatnosci>6</FormaPlatnosci>`,
          bankAccount
            ? `<RachunekBankowy><NrRB>${escapeXml(bankAccount)}</NrRB></RachunekBankowy>`
            : "",
        ]
          .filter(Boolean)
          .join("")
      : [
          paymentDueDate
            ? `<TerminPlatnosci><Termin>${escapeXml(paymentDueDate)}</Termin></TerminPlatnosci>`
            : "",
          `<FormaPlatnosci>6</FormaPlatnosci>`,
          bankAccount
            ? `<RachunekBankowy><NrRB>${escapeXml(bankAccount)}</NrRB></RachunekBankowy>`
            : "",
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/DefinicjeTypy/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${escapeXml(formatMidnightZulu(issueDate))}</DataWytworzeniaFa>
    <SystemInfo>ksefxml.pl</SystemInfo>
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
    <KodWaluty>PLN</KodWaluty>
    ${tag("P_1", issueDate)}
    ${tag("P_2", data.invoice_number)}
    ${tag("P_6", saleDate)}
    ${tag("P_13_2", netTotal)}
    ${tag("P_14_2", vatTotal)}
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
    <RodzajFaktury>VAT</RodzajFaktury>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      ${tag("P_7", itemName)}
      ${tag("P_8A", unit)}
      ${tag("P_8B", quantity)}
      ${tag("P_9A", unitPrice)}
      <P_10>0.00</P_10>
      ${tag("P_11", netTotal)}
      ${tag("P_11Vat", vatTotal)}
      ${tag("P_12", vatRate)}
    </FaWiersz>
    <Platnosc>${paymentXml}</Platnosc>
  </Fa>${stopkaXml}
</Faktura>`;
}

function mergeManualData(
  baseData: InvoiceData,
  manualData: Record<string, string>
): InvoiceData {
  const merged: InvoiceData = { ...baseData };

  for (const [key, value] of Object.entries(manualData)) {
    if (!(key in merged)) continue;

    if (key === "paid") {
      const normalized = String(value).trim().toLowerCase();
      if (["true", "1", "tak", "yes"].includes(normalized)) {
        merged.paid = true;
      } else if (["false", "0", "nie", "no"].includes(normalized)) {
        merged.paid = false;
      }
      continue;
    }

    (merged as Record<string, unknown>)[key] = value?.trim() || null;
  }

  return merged;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, message: "Brak OPENAI_API_KEY na serwerze." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const manualDataRaw = formData.get("manualData");
    const manualData =
      typeof manualDataRaw === "string" && manualDataRaw.trim()
        ? JSON.parse(manualDataRaw)
        : {};

    if (!file) {
      return Response.json(
        { success: false, message: "Nie wybrano pliku." },
        { status: 400 }
      );
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
        {
          success: false,
          message: "Obsługiwane formaty: PDF, PNG, JPG, JPEG, WEBP.",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `
Wyciągnij dane z faktury i zwróć WYŁĄCZNIE czysty JSON.

ZASADY:
- nie zgaduj danych,
- jeśli czegoś nie ma na fakturze, ustaw null,
- analizuj całą fakturę: nagłówek, tabelę pozycji, stopkę, sekcję płatności,
- rozpoznawaj:
  - sprzedawcę / wystawcę
  - nabywcę / odbiorcę / klienta
- numer faktury: "Faktura nr", "Nr", "Invoice no", "FV"
- data wystawienia: "Data wystawienia", "Data faktury"
- data sprzedaży: "Data sprzedaży", "Data dokonania dostawy", "Data wysyłki"
- termin płatności: "Termin płatności", "Due date"
- data zapłaty: "Data zapłaty"
- REGON: "REGON"
- seller_nip i buyer_nip zwracaj bez prefiksu kraju
- buyer_nip ma być NIP-em nabywcy, nie numerem klienta wewnętrznym
- jeśli na fakturze występuje "NIP klient", użyj go tylko wtedy, gdy dotyczy nabywcy
- jeśli występują pola "Numer nabywcy", "Nr klienta", "Customer number", nie traktuj ich jako NIP
- dla ilości zwracaj samą wartość liczbową, bez jednostki
- jednostkę zwracaj osobno
- jeśli jest informacja, że faktura zapłacona, ustaw paid=true i podaj payment_date
- jeśli jest termin płatności i brak informacji o zapłacie, ustaw paid=false
- kwoty zwracaj bez waluty
- zwróć tylko JSON, bez komentarzy i bez markdown

Zwróć JSON dokładnie w tej strukturze:
{
  "seller_nip": null,
  "seller_name": null,
  "seller_address": null,
  "seller_regon": null,
  "buyer_nip": null,
  "buyer_name": null,
  "buyer_address": null,
  "invoice_number": null,
  "issue_date": null,
  "sale_date": null,
  "net_total": null,
  "vat_total": null,
  "gross_total": null,
  "vat_rate": null,
  "item_name": null,
  "quantity": null,
  "unit": null,
  "unit_price": null,
  "payment_due_date": null,
  "payment_date": null,
  "bank_account": null,
  "paid": null
}
`;

    const content: any[] = [{ type: "input_text", text: prompt }];

    if (file.type.startsWith("image/")) {
      content.push({
        type: "input_image",
        image_url: `data:${file.type};base64,${base64}`,
      });
    } else if (file.type === "application/pdf") {
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

    const output = cleanJsonText(response.output_text || "");

    let data: InvoiceData;
    try {
      data = JSON.parse(output);
    } catch {
      return Response.json(
        {
          success: false,
          message: "Nie udało się poprawnie odczytać danych z faktury.",
          raw_response: output,
        },
        { status: 500 }
      );
    }

    data = mergeManualData(data, manualData);

    data.seller_nip = normalizeNip(data.seller_nip) || null;
    data.buyer_nip = normalizeNip(data.buyer_nip) || null;
    data.seller_regon = normalizeRegon(data.seller_regon) || null;

    data.issue_date = normalizeDate(data.issue_date) || null;
    data.sale_date = normalizeDate(data.sale_date || data.issue_date) || null;
    data.payment_due_date = normalizeDate(data.payment_due_date) || null;
    data.payment_date = normalizeDate(data.payment_date) || null;

    data.net_total = normalizeDecimal(data.net_total, 2) || null;
    data.vat_total = normalizeDecimal(data.vat_total, 2) || null;
    data.gross_total = normalizeDecimal(data.gross_total, 2) || null;
    data.quantity = normalizeQuantity(data.quantity) || "1.000000";
    data.unit_price = normalizeDecimal(data.unit_price, 2) || null;
    data.vat_rate = normalizeVatRate(data.vat_rate) || "23";
    data.bank_account = normalizeBankAccount(data.bank_account) || null;

    if (!data.sale_date && data.issue_date) {
      data.sale_date = data.issue_date;
    }

    if (!data.vat_total && data.net_total && data.vat_rate) {
      const net = Number(data.net_total);
      const rate = Number(String(data.vat_rate).replace("%", "").replace(",", "."));
      if (!Number.isNaN(net) && !Number.isNaN(rate)) {
        data.vat_total = ((net * rate) / 100).toFixed(2);
      }
    }

    if (!data.gross_total && data.net_total && data.vat_total) {
      const net = Number(data.net_total);
      const vat = Number(data.vat_total);
      if (!Number.isNaN(net) && !Number.isNaN(vat)) {
        data.gross_total = (net + vat).toFixed(2);
      }
    }

    if (!data.unit_price && data.net_total && data.quantity) {
      const net = Number(String(data.net_total).replace(",", "."));
      const qty = Number(String(data.quantity).replace(",", "."));
      if (!Number.isNaN(net) && !Number.isNaN(qty) && qty > 0) {
        data.unit_price = (net / qty).toFixed(2);
      }
    }

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
      "vat_rate",
    ];

    for (const field of requiredFields) {
      const value = data[field as keyof InvoiceData];
      if (value === null || value === "") {
        missingFields.push(field);
      }
    }

    if (data.seller_nip && !hasNipFormat(data.seller_nip)) {
      missingFields.push("seller_nip");
    }

    if (data.buyer_nip && !hasNipFormat(data.buyer_nip)) {
      missingFields.push("buyer_nip");
    }

    const uniqueMissingFields = [...new Set(missingFields)];

    if (uniqueMissingFields.length > 0) {
      return Response.json(
        {
          success: false,
          message: "Brakują wymagane dane albo część pól ma nieprawidłowy format.",
          missing_fields: uniqueMissingFields,
          extracted_data: data,
          missing_field_labels: uniqueMissingFields.map((field) => fieldLabels[field] || field),
        },
        { status: 400 }
      );
    }

    const xml = buildXml(data);

    const safeInvoiceNumber = (data.invoice_number || "faktura")
      .replace(/[^\p{L}\p{N}._/-]+/gu, "_")
      .replace(/^_+|_+$/g, "");

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeInvoiceNumber || "faktura"}.xml"`,
      },
    });
  } catch (error) {
    console.error("BŁĄD API:", error);
    return Response.json(
      {
        success: false,
        message: "Wystąpił błąd serwera podczas przetwarzania faktury.",
      },
      { status: 500 }
    );
  }
}