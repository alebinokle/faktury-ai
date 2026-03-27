"use client";

import { useEffect, useMemo, useState } from "react";

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
  missing_fields?: string[];
  extracted_data?: Record<string, unknown>;
  raw_response?: string;
  credits_left?: number;
  line_missing_fields?: Array<{ line: number; fields: string[] }>;
  line_issues?: Array<{ line: number; fields: string[] }>;
  totals_mismatch?: boolean;
  totals_from_items?: {
    net_total?: string | null;
    vat_total?: string | null;
    gross_total?: string | null;
  };
  auto_repaired?: boolean;
  math_problem?: boolean;
  validation_details?: string[];
  invalid_fields?: string[];
  requires_confirmation?: boolean;
  review_token?: string;
  session_scope?: string;
};

type ManualFieldMap = Record<string, string>;

type ItemDraft = {
  item_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  unit_price_before_discount: string;
  unit_price_gross: string;
  discount_percent: string;
  discount_amount: string;
  net_total: string;
  vat_rate: string;
  vat_total: string;
  gross_total: string;
  pkwiu: string;
  gtu: string;
  code: string;
};

type MeResponse = {
  loggedIn: boolean;
  user?: {
    id: string;
    email: string;
    credits: number;
  };
};

type CreditsApiResponse = {
  success?: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    credits: number;
  };
};

const mainFieldLabels: Record<string, string> = {
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
};

const itemFieldLabels: Record<string, string> = {
  item_name: "Nazwa pozycji",
  quantity: "Ilość",
  unit: "Jednostka",
  unit_price: "Cena netto po rabacie",
  unit_price_before_discount: "Cena netto przed rabatem",
  unit_price_gross: "Cena brutto jednostkowa",
  discount_percent: "Rabat %",
  discount_amount: "Rabat kwotowy",
  net_total: "Wartość netto",
  vat_rate: "Stawka VAT",
  vat_total: "Kwota VAT",
  gross_total: "Wartość brutto",
  pkwiu: "PKWiU",
  gtu: "GTU",
  code: "Kod / indeks",
  unit_price_or_net_total: "Cena netto lub wartość netto",
  net_total_or_gross_total: "Wartość netto lub brutto",
};

const allFieldLabels: Record<string, string> = { ...mainFieldLabels, ...itemFieldLabels };

function createEmptyItem(): ItemDraft {
  return {
    item_name: "",
    quantity: "",
    unit: "",
    unit_price: "",
    unit_price_before_discount: "",
    unit_price_gross: "",
    discount_percent: "",
    discount_amount: "",
    net_total: "",
    vat_rate: "",
    vat_total: "",
    gross_total: "",
    pkwiu: "",
    gtu: "",
    code: "",
  };
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function toNumber(value: string): number | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function approxEqual(a: number, b: number, tolerance = 0.2): boolean {
  return Math.abs(a - b) <= tolerance;
}

function formatSourceItem(item: ItemDraft): string {
  return [
    item.item_name || "—",
    item.quantity ? `ilość: ${item.quantity}` : "",
    item.unit ? `j.m.: ${item.unit}` : "",
    item.unit_price ? `netto po rabacie: ${item.unit_price}` : "",
    item.net_total ? `netto: ${item.net_total}` : "",
    item.vat_rate ? `VAT: ${item.vat_rate}` : "",
    item.gross_total ? `brutto: ${item.gross_total}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500">{children}</p>;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "success" | "error" | "info">("idle");
  const [generatedXml, setGeneratedXml] = useState("");
  const [generatedFilename, setGeneratedFilename] = useState("faktura.xml");

  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(true);

  const [showInstructions, setShowInstructions] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showCookies, setShowCookies] = useState(true);

  const [showFixModal, setShowFixModal] = useState(false);
  const [canReopenFixModal, setCanReopenFixModal] = useState(false);
  const [manualData, setManualData] = useState<ManualFieldMap>({});
  const [manualItems, setManualItems] = useState<ItemDraft[]>([]);
  const [sourceItems, setSourceItems] = useState<ItemDraft[]>([]);
  const [lineMissingFields, setLineMissingFields] = useState<Array<{ line: number; fields: string[] }>>([]);
  const [lineIssues, setLineIssues] = useState<Array<{ line: number; fields: string[] }>>([]);
  const [totalsMismatch, setTotalsMismatch] = useState(false);
  const [totalsFromItems, setTotalsFromItems] = useState<{
    net_total?: string | null;
    vat_total?: string | null;
    gross_total?: string | null;
  }>({});
  const [autoRepaired, setAutoRepaired] = useState(false);
  const [mathProblem, setMathProblem] = useState(false);
  const [validationDetails, setValidationDetails] = useState<string[]>([]);
  const [modalErrors, setModalErrors] = useState<string[]>([]);
  const [reviewToken, setReviewToken] = useState("");
  const [sessionScope, setSessionScope] = useState("");

  const [contactSubject, setContactSubject] = useState("Pomoc techniczna – ksefxml.pl");
  const [contactBody, setContactBody] = useState("");

  const mailtoHref = useMemo(() => {
    const to = "ksefxml@outlook.com";
    const subject = encodeURIComponent(contactSubject || "Pomoc techniczna – ksefxml.pl");
    const body = encodeURIComponent(contactBody || "");
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [contactSubject, contactBody]);

  const updateLoggedInUser = (user: { email: string; credits: number }) => {
    setLoggedIn(true);
    setUserEmail(user.email);
    setCredits(user.credits);
  };

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data: MeResponse = await res.json();
        if (data?.loggedIn && data.user) {
          updateLoggedInUser({ email: data.user.email, credits: data.user.credits });
          setUserMessage(`Zalogowano: ${data.user.email}`);
        } else {
          setLoggedIn(false);
          setUserEmail("");
          setCredits(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setCheckingLogin(false);
      }
    };
    loadMe();
  }, []);

  const downloadXml = () => {
    if (!generatedXml) return;
    const blob = new Blob([generatedXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generatedFilename || "faktura.xml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadXmlFromValues = (xml: string, filename: string) => {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "faktura.xml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const buildManualPayload = (): Record<string, unknown> => ({
    ...manualData,
    items: manualItems.map((item) => ({
      item_name: item.item_name || null,
      quantity: item.quantity || null,
      unit: item.unit || null,
      unit_price: item.unit_price || null,
      unit_price_before_discount: item.unit_price_before_discount || null,
      unit_price_gross: item.unit_price_gross || null,
      discount_percent: item.discount_percent || null,
      discount_amount: item.discount_amount || null,
      net_total: item.net_total || null,
      vat_rate: item.vat_rate || null,
      vat_total: item.vat_total || null,
      gross_total: item.gross_total || null,
      pkwiu: item.pkwiu || null,
      gtu: item.gtu || null,
      code: item.code || null,
    })),
  });

  const seedManualEditors = (missing: string[], invalid: string[], extracted: Record<string, unknown>, err?: ApiErrorResponse) => {
    const initialManualData: ManualFieldMap = {};
    const mainKeys = [
      "seller_nip",
      "seller_name",
      "seller_address",
      "seller_regon",
      "buyer_nip",
      "buyer_name",
      "buyer_address",
      "recipient_name",
      "recipient_address",
      "recipient_nip",
      "invoice_number",
      "issue_date",
      "sale_date",
      "currency",
      "place_of_issue",
      "net_total",
      "vat_total",
      "gross_total",
      "payment_due_date",
      "payment_date",
      "bank_account",
      "payment_method",
      "paid",
    ];

    for (const key of mainKeys) {
      if (key in extracted) initialManualData[key] = valueToString(extracted[key]);
    }
    for (const field of [...missing, ...invalid]) {
      if (!(field in initialManualData)) initialManualData[field] = valueToString(extracted[field]);
    }

    const rawItems = Array.isArray(extracted.items) ? extracted.items : [];
    const seededItems: ItemDraft[] = rawItems.length
      ? rawItems.map((rawItem) => {
          const item = (rawItem || {}) as Record<string, unknown>;
          return {
            item_name: valueToString(item.item_name),
            quantity: valueToString(item.quantity),
            unit: valueToString(item.unit),
            unit_price: valueToString(item.unit_price),
            unit_price_before_discount: valueToString(item.unit_price_before_discount),
            unit_price_gross: valueToString(item.unit_price_gross),
            discount_percent: valueToString(item.discount_percent),
            discount_amount: valueToString(item.discount_amount),
            net_total: valueToString(item.net_total),
            vat_rate: valueToString(item.vat_rate),
            vat_total: valueToString(item.vat_total),
            gross_total: valueToString(item.gross_total),
            pkwiu: valueToString(item.pkwiu),
            gtu: valueToString(item.gtu),
            code: valueToString(item.code),
          };
        })
      : [createEmptyItem()];

    setManualData(initialManualData);
    setManualItems(seededItems);
    setSourceItems(seededItems);
    setLineMissingFields(err?.line_missing_fields || []);
    setLineIssues(err?.line_issues || []);
    setTotalsMismatch(Boolean(err?.totals_mismatch));
    setTotalsFromItems(err?.totals_from_items || {});
    setAutoRepaired(Boolean(err?.auto_repaired));
    setMathProblem(Boolean(err?.math_problem));
    setValidationDetails(err?.validation_details || []);
    setModalErrors([]);
    setReviewToken(err?.review_token || "");
    setSessionScope(err?.session_scope || "");
    setCanReopenFixModal(true);
  };

  const validateBeforeSubmit = (): string[] => {
    const errors: string[] = [];

    if (!reviewToken) {
      errors.push("Brakuje tokenu sesji analizy. Wgraj dokument ponownie.");
    }

    if ((manualData.paid || "").toLowerCase() === "true" && !(manualData.payment_date || "").trim()) {
      errors.push("Zaznaczono fakturę jako opłaconą, ale brakuje daty zapłaty.");
    }

    if (!manualItems.length) {
      errors.push("Brakuje pozycji faktury.");
    }

    manualItems.forEach((item, index) => {
      const line = index + 1;
      if (!item.item_name.trim()) errors.push(`Pozycja ${line}: brak nazwy.`);
      if (!item.quantity.trim()) errors.push(`Pozycja ${line}: brak ilości.`);
      if (!item.unit.trim()) errors.push(`Pozycja ${line}: brak jednostki.`);
      if (!item.vat_rate.trim()) errors.push(`Pozycja ${line}: brak stawki VAT.`);

      const qty = toNumber(item.quantity);
      const unitPrice = toNumber(item.unit_price);
      const net = toNumber(item.net_total);
      const vat = toNumber(item.vat_total);
      const gross = toNumber(item.gross_total);

      if (qty !== null && unitPrice !== null && net !== null && !approxEqual(qty * unitPrice, net)) {
        errors.push(`Pozycja ${line}: ilość × cena netto po rabacie nie zgadza się z wartością netto.`);
      }
      if (net !== null && vat !== null && gross !== null && !approxEqual(net + vat, gross)) {
        errors.push(`Pozycja ${line}: netto + VAT nie zgadza się z brutto.`);
      }
    });

    const headerNet = toNumber(manualData.net_total || "");
    const headerVat = toNumber(manualData.vat_total || "");
    const headerGross = toNumber(manualData.gross_total || "");

    const sumNet = manualItems.reduce((sum, item) => sum + (toNumber(item.net_total) ?? 0), 0);
    const sumVat = manualItems.reduce((sum, item) => sum + (toNumber(item.vat_total) ?? 0), 0);
    const sumGross = manualItems.reduce((sum, item) => sum + (toNumber(item.gross_total) ?? 0), 0);

    if (headerNet !== null && !approxEqual(headerNet, sumNet)) {
      errors.push(`Suma netto pozycji (${sumNet.toFixed(2)}) nie zgadza się z netto nagłówka (${headerNet.toFixed(2)}).`);
    }
    if (headerVat !== null && !approxEqual(headerVat, sumVat)) {
      errors.push(`Suma VAT pozycji (${sumVat.toFixed(2)}) nie zgadza się z VAT nagłówka (${headerVat.toFixed(2)}).`);
    }
    if (headerGross !== null && !approxEqual(headerGross, sumGross)) {
      errors.push(`Suma brutto pozycji (${sumGross.toFixed(2)}) nie zgadza się z brutto nagłówka (${headerGross.toFixed(2)}).`);
    }

    return errors;
  };

  const handleProcessResponseError = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      setStatus("error");
      setMessage("Wystąpił błąd podczas przetwarzania.");
      setResult(text);
      return;
    }

    const err: ApiErrorResponse = await res.json();
    const missing = err.missing_fields || [];
    const invalid = err.invalid_fields || [];
    const extracted = (err.extracted_data || {}) as Record<string, unknown>;

    if (typeof err.credits_left === "number") setCredits(err.credits_left);

    if (res.status === 401) {
      setLoggedIn(false);
      setUserEmail("");
      setCredits(null);
      setStatus("error");
      setMessage(err.message || "Sesja wygasła. Zaloguj się ponownie.");
      setResult(JSON.stringify(err, null, 2));
      return;
    }

    if (res.status === 402) {
      setStatus("error");
      setMessage(err.message || "Brak środków na koncie.");
      setResult(JSON.stringify(err, null, 2));
      return;
    }

    setStatus(err.requires_confirmation ? "info" : "error");
    setMessage(err.message || "Formularz wymaga dalszej korekty. XML nie został jeszcze wygenerowany.");
    setMissingFields(missing);
    setInvalidFields(invalid);
    seedManualEditors(missing, invalid, extracted, err);
    setResult(JSON.stringify(err, null, 2));
    setShowFixModal(true);
  };

  const handleSendLoginLink = async () => {
    try {
      setUserMessage("");
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) return setUserMessage("Wpisz adres e-mail.");

      const res = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        return setUserMessage(data?.message || "Nie udało się wysłać linku logowania.");
      }

      setUserMessage("Link logowania został wysłany.");
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas wysyłania linku logowania.");
    }
  };

  const handleRefreshSession = async () => {
    try {
      setUserMessage("");
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data: MeResponse = await res.json();
      if (data?.loggedIn && data.user) {
        updateLoggedInUser({ email: data.user.email, credits: data.user.credits });
        setUserMessage(`Zalogowano: ${data.user.email}`);
      } else {
        setLoggedIn(false);
        setUserEmail("");
        setCredits(null);
        setUserMessage("Sesja nie jest aktywna.");
      }
    } catch (error) {
      console.error(error);
      setUserMessage("Nie udało się odświeżyć sesji.");
    }
  };

  const handleRefreshCredits = async () => {
    try {
      setUserMessage("");
      if (!userEmail) return setUserMessage("Brak adresu e-mail.");

      const res = await fetch("/api/user/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      const data: CreditsApiResponse = await res.json();
      if (!res.ok || !data?.success || !data.user) {
        return setUserMessage(data?.message || "Nie udało się pobrać salda.");
      }

      setCredits(data.user.credits);
      setUserMessage(`Aktualne saldo: ${data.user.credits}`);
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas pobierania salda.");
    }
  };

  const handleAddCredits = async (creditsToAdd = 30) => {
    try {
      setUserMessage("");
      if (!userEmail) return setUserMessage("Brak adresu e-mail.");

      const res = await fetch("/api/user/add-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, credits: creditsToAdd }),
      });

      const data: CreditsApiResponse = await res.json();
      if (!res.ok || !data?.success || !data.user) {
        return setUserMessage(data?.message || "Nie udało się zasilić konta.");
      }

      setCredits(data.user.credits);
      setUserMessage(`Dodano ${creditsToAdd} kredytów. Aktualne saldo: ${data.user.credits}`);
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas zasilania konta.");
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.success) return setUserMessage(data?.message || "Nie udało się wylogować.");

      setLoggedIn(false);
      setUserEmail("");
      setCredits(null);
      setEmail("");
      setUserMessage("Wylogowano.");
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas wylogowywania.");
    }
  };

  const handleUpload = async () => {
    if (!acceptedTerms) return setMessage("Wysyłka pliku wymaga akceptacji regulaminu i polityki prywatności.");
    if (!loggedIn) return setMessage("Aby kontynuować, zaloguj się.");
    if (!file) return setMessage("Wybierz plik faktury.");

    try {
      setLoading(true);
      setStatus("info");
      setMessage("Trwa analiza dokumentu. XML zostanie wygenerowany dopiero po zatwierdzeniu formularza.");
      setResult("");
      setMissingFields([]);
      setInvalidFields([]);
      setLineMissingFields([]);
      setLineIssues([]);
      setValidationDetails([]);
      setModalErrors([]);
      setShowFixModal(false);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("manualData", JSON.stringify({}));
      formData.append("manualDataConfirmed", "false");

      const res = await fetch("/api/process", { method: "POST", body: formData });

      if (!res.ok) return await handleProcessResponseError(res);

      setStatus("error");
      setMessage("Nieoczekiwana odpowiedź serwera. XML nie powinien być generowany bez akceptacji formularza.");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Wystąpił błąd podczas wysyłania pliku.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromManualData = async () => {
    if (!file) return;
    if (!loggedIn) return setMessage("Sesja wygasła. Zaloguj się ponownie.");

    const clientErrors = validateBeforeSubmit();
    setModalErrors(clientErrors);

    if (clientErrors.length) {
      setStatus("error");
      setMessage("Formularz zawiera błędy. Popraw je przed wygenerowaniem XML.");
      setShowFixModal(true);
      return;
    }

    try {
      setLoading(true);
      setStatus("info");
      setMessage("Trwa generowanie XML...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("manualData", JSON.stringify(buildManualPayload()));
      formData.append("manualDataConfirmed", "true");
      formData.append("reviewToken", reviewToken);

      const res = await fetch("/api/process", { method: "POST", body: formData });
      const disposition = res.headers.get("content-disposition") || "";
      const creditsLeftHeader = res.headers.get("x-credits-left");

      if (!res.ok) {
        setShowFixModal(true);
        return await handleProcessResponseError(res);
      }

      const text = await res.text();
      let filename = "faktura.xml";
      const match = disposition.match(/filename="([^"]+)"/i);
      if (match?.[1]) filename = match[1];

      if (creditsLeftHeader !== null) {
        const parsedCredits = Number(creditsLeftHeader);
        if (!Number.isNaN(parsedCredits)) setCredits(parsedCredits);
      }

      setGeneratedXml(text);
      setGeneratedFilename(filename);
      setResult(text);
      setStatus("success");
      setMessage("Plik XML został wygenerowany po zatwierdzeniu formularza.");
      setShowFixModal(false);
      setModalErrors([]);
      setCanReopenFixModal(false);
      setReviewToken("");
      setSessionScope("");
      downloadXmlFromValues(text, filename);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Wystąpił błąd podczas generowania XML.");
      setShowFixModal(true);
    } finally {
      setLoading(false);
    }
  };

  const updateItemField = (index: number, field: keyof ItemDraft, value: string) => {
    setManualItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addManualItem = () => {
    setManualItems((prev) => [...prev, createEmptyItem()]);
    setSourceItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeManualItem = (index: number) => {
    setManualItems((prev) => prev.filter((_, i) => i !== index));
    setSourceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const openMailClient = () => {
    window.location.href = mailtoHref;
  };

  const resetAfterFileChange = () => {
    setMessage("");
    setResult("");
    setMissingFields([]);
    setInvalidFields([]);
    setLineMissingFields([]);
    setLineIssues([]);
    setValidationDetails([]);
    setModalErrors([]);
    setStatus("idle");
    setShowFixModal(false);
    setCanReopenFixModal(false);
    setReviewToken("");
    setSessionScope("");
  };

  if (checkingLogin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="rounded-xl bg-white px-6 py-4 shadow text-gray-700">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-red-600 text-white py-4 px-6 flex items-center justify-between shadow">
        <div className="font-bold text-lg">KSeF</div>
        <div className="text-sm opacity-90">Konwerter faktur do XML</div>
      </div>

      <div className="flex flex-col items-center py-16 px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-xl mb-6">
          <h1 className="text-2xl font-bold mb-2 text-gray-800">Generowanie XML do KSeF</h1>
          <p className="text-gray-500 mb-6">
            Prześlij fakturę w PDF lub jako zdjęcie. System odczyta dokument, spróbuje naprawić typowe
            niejasności, a przy trudniejszych fakturach otworzy pełny formularz kontroli wszystkich danych
            i pozycji.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Konto</h2>

            {!loggedIn ? (
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adres e-mail"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSendLoginLink}
                    className="rounded bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Wyślij link logowania
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshSession}
                    className="rounded border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                  >
                    Sprawdź status logowania
                  </button>
                </div>

                <Hint>Po kliknięciu przycisku wyślemy link logowania na podany adres e-mail.</Hint>

                {userMessage && (
                  <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                    {userMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  Konto aktywne: <span className="font-semibold">{userEmail}</span>
                </div>

                {credits !== null && (
                  <div className="text-sm font-medium text-gray-700">
                    Saldo kredytów: <span className="text-blue-900">{credits}</span>
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-sm font-semibold text-blue-900 mb-2">Kredyty</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRefreshCredits}
                      className="rounded border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                    >
                      Odśwież saldo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCredits(30)}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Zasil konto
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshSession}
                    className="rounded border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                  >
                    Odśwież konto
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded border border-red-700 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Wyloguj
                  </button>
                </div>

                {userMessage && (
                  <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                    {userMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                resetAfterFileChange();
              }}
            />
            <div className="flex items-center gap-3">
              <label
                htmlFor="file-upload"
                className="inline-block cursor-pointer rounded border border-gray-400 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
              >
                Wybierz plik
              </label>
              <span className="text-sm text-gray-700 break-all">{file ? file.name : "Nie wybrano pliku"}</span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1"
              />
              <span>
                Akceptuję{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-blue-700 underline hover:text-blue-900"
                >
                  regulamin i politykę prywatności
                </button>
                .
              </span>
            </label>

            <p className="text-xs text-gray-500 mt-2">
              Bez akceptacji regulaminu nie można przesłać pliku do przetworzenia.
            </p>

            <div className="mt-3">
              <a
                href="/polityka-prywatnosci"
                className="text-sm text-blue-700 underline hover:text-blue-900"
              >
                Polityka prywatności
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleUpload}
              disabled={loading || !acceptedTerms || !loggedIn}
              className="flex-1 min-w-[180px] bg-blue-900 text-white py-2 rounded hover:bg-blue-800 transition font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Analiza..." : "Analizuj dokument"}
            </button>

            <button
              onClick={downloadXml}
              disabled={!generatedXml}
              className="px-4 py-2 rounded border border-blue-900 text-blue-900 bg-white hover:bg-blue-50 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pobierz XML
            </button>

            <button
              onClick={() => setShowInstructions(true)}
              type="button"
              className="px-4 py-2 rounded border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 transition font-semibold"
            >
              Instrukcja
            </button>

            <button
              onClick={() => setShowContact(true)}
              type="button"
              className="px-4 py-2 rounded border border-red-300 text-red-700 bg-white hover:bg-red-50 transition font-semibold"
            >
              Kontakt
            </button>
          </div>
        </div>

        {(message || missingFields.length > 0 || lineMissingFields.length > 0 || lineIssues.length > 0 || validationDetails.length > 0 || canReopenFixModal) && (
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xl mb-10 border">
            <h2 className="font-bold text-lg mb-3 text-gray-800">Status</h2>

            <div
              className={`rounded-lg px-4 py-3 text-sm mb-4 ${
                status === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : status === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {message}
            </div>

            {sessionScope && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 mb-4">
                Bieżąca sesja analizy: <span className="font-semibold">{sessionScope}</span>
              </div>
            )}

            {(autoRepaired || mathProblem || totalsMismatch) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 space-y-1 mb-4">
                {autoRepaired && <div>System automatycznie uzupełnił część brakujących wartości.</div>}
                {mathProblem && <div>Co najmniej jedna pozycja wymaga sprawdzenia matematyki lub rabatu.</div>}
                {totalsMismatch && (
                  <div>
                    Sumy pozycji różnią się od sum faktury. Obliczone z pozycji: netto {totalsFromItems.net_total ?? "-"},
                    VAT {totalsFromItems.vat_total ?? "-"}, brutto {totalsFromItems.gross_total ?? "-"}.
                  </div>
                )}
              </div>
            )}

            {validationDetails.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4">
                <div className="font-semibold text-red-800 mb-2">Dokładne przyczyny blokady:</div>
                <ul className="list-disc pl-5 text-sm text-red-900 space-y-1">
                  {validationDetails.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}

            {missingFields.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <div className="font-semibold text-amber-800 mb-2">Brakujące pola główne:</div>
                <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                  {missingFields.map((field) => (
                    <li key={field}>{allFieldLabels[field] || field}</li>
                  ))}
                </ul>
              </div>
            )}

            {invalidFields.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 mb-4">
                <div className="font-semibold text-orange-800 mb-2">Pola z nieprawidłowym formatem:</div>
                <ul className="list-disc pl-5 text-sm text-orange-900 space-y-1">
                  {invalidFields.map((field) => (
                    <li key={field}>{allFieldLabels[field] || field}</li>
                  ))}
                </ul>
              </div>
            )}

            {(lineMissingFields.length > 0 || lineIssues.length > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <div className="font-semibold text-amber-800 mb-2">Pozycje do ręcznej korekty:</div>
                <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                  {lineMissingFields.map((entry) => (
                    <li key={`missing-${entry.line}`}>
                      Linia {entry.line}: {entry.fields.map((field) => allFieldLabels[field] || field).join(", ")}
                    </li>
                  ))}
                  {lineIssues.map((entry) => (
                    <li key={`issue-${entry.line}`}>Linia {entry.line}: sprawdź zgodność ilości, rabatu, cen i sum.</li>
                  ))}
                </ul>
              </div>
            )}

            {canReopenFixModal && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="font-semibold text-amber-800 mb-2">Korekta danych</div>
                <p className="text-sm text-amber-900">Możesz wrócić do formularza i kontynuować edycję danych faktury.</p>
                <button
                  type="button"
                  onClick={() => setShowFixModal(true)}
                  className="mt-3 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Wróć do formularza korekty
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-2 text-gray-800">Czym jest KSeF?</h2>
            <p className="text-gray-600 text-sm">
              Krajowy System e-Faktur to system do wystawiania, przesyłania i przechowywania faktur w ustandaryzowanym formacie XML.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-2 text-gray-800">ksefxml.pl</h2>
            <p className="text-gray-600 text-sm">
              Serwis umożliwia generowanie XML z różnych typów faktur i daje pełny edytor wszystkich pól, w tym pozycji, rabatów, VAT, kontrahentów i płatności.
            </p>
          </div>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl mt-10">
            <h2 className="font-bold text-lg mb-3 text-gray-800">Odpowiedź systemu</h2>
            <pre className="mt-2 p-3 bg-gray-50 border rounded text-xs text-gray-700 overflow-auto max-h-96 whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}
      </div>

      {showFixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl max-h-[94vh] overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">Kontrola i korekta danych faktury</h2>
              <button
                type="button"
                onClick={() => setShowFixModal(false)}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Zamknij
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6 max-h-[76vh]">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                XML zostanie wygenerowany dopiero po ręcznym sprawdzeniu i zatwierdzeniu wszystkich danych.
              </div>

              {sessionScope && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Sesja analizy: <span className="font-semibold">{sessionScope}</span>
                </div>
              )}

              {(missingFields.length > 0 || invalidFields.length > 0 || lineMissingFields.length > 0 || lineIssues.length > 0 || validationDetails.length > 0 || totalsMismatch || autoRepaired || mathProblem || modalErrors.length > 0) && (
                <div className="space-y-4">
                  {modalErrors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <div className="font-semibold text-red-800 mb-2">Popraw przed generowaniem:</div>
                      <ul className="list-disc pl-5 text-sm text-red-900 space-y-1">
                        {modalErrors.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sessionScope && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 mb-4">
                Bieżąca sesja analizy: <span className="font-semibold">{sessionScope}</span>
              </div>
            )}

            {(autoRepaired || mathProblem || totalsMismatch) && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 space-y-1">
                      {autoRepaired && <div>System automatycznie uzupełnił część brakujących wartości.</div>}
                      {mathProblem && <div>Co najmniej jedna pozycja wymaga sprawdzenia matematyki lub rabatu.</div>}
                      {totalsMismatch && (
                        <div>
                          Sumy pozycji różnią się od sum faktury. Obliczone z pozycji: netto {totalsFromItems.net_total ?? "-"},
                          VAT {totalsFromItems.vat_total ?? "-"}, brutto {totalsFromItems.gross_total ?? "-"}.
                        </div>
                      )}
                    </div>
                  )}

                  {validationDetails.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <div className="font-semibold text-red-800 mb-2">Dokładne przyczyny blokady:</div>
                      <ul className="list-disc pl-5 text-sm text-red-900 space-y-1">
                        {validationDetails.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {missingFields.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="font-semibold text-amber-800 mb-2">Brakujące pola główne:</div>
                      <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                        {missingFields.map((field) => (
                          <li key={field}>{allFieldLabels[field] || field}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {invalidFields.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 mb-4">
                <div className="font-semibold text-orange-800 mb-2">Pola z nieprawidłowym formatem:</div>
                <ul className="list-disc pl-5 text-sm text-orange-900 space-y-1">
                  {invalidFields.map((field) => (
                    <li key={field}>{allFieldLabels[field] || field}</li>
                  ))}
                </ul>
              </div>
            )}

            {(lineMissingFields.length > 0 || lineIssues.length > 0) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="font-semibold text-amber-800 mb-2">Pozycje do ręcznej korekty:</div>
                      <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                        {lineMissingFields.map((entry) => (
                          <li key={`modal-missing-${entry.line}`}>
                            Linia {entry.line}: {entry.fields.map((field) => allFieldLabels[field] || field).join(", ")}
                          </li>
                        ))}
                        {lineIssues.map((entry) => (
                          <li key={`modal-issue-${entry.line}`}>
                            Linia {entry.line}: sprawdź zgodność ilości, rabatu, cen netto/brutto i sum tej pozycji.
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Dane główne faktury</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    "seller_name",
                    "seller_nip",
                    "seller_address",
                    "seller_regon",
                    "buyer_name",
                    "buyer_nip",
                    "buyer_address",
                    "recipient_name",
                    "recipient_nip",
                    "recipient_address",
                    "invoice_number",
                    "issue_date",
                    "sale_date",
                    "place_of_issue",
                    "currency",
                    "payment_method",
                    "payment_due_date",
                    "payment_date",
                    "bank_account",
                    "net_total",
                    "vat_total",
                    "gross_total",
                    "paid",
                  ].map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{mainFieldLabels[field] || field}</label>
                      <input
                        type="text"
                        value={manualData[field] || ""}
                        onChange={(e) =>
                          setManualData((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">Pozycje faktury</h3>
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="rounded border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                  >
                    Dodaj pozycję
                  </button>
                </div>

                <div className="space-y-5">
                  {manualItems.map((item, index) => {
                    const missingForLine = lineMissingFields.find((entry) => entry.line === index + 1)?.fields || [];
                    const issueForLine = lineIssues.find((entry) => entry.line === index + 1);
                    const sourceItem = sourceItems[index];

                    return (
                      <div key={index} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="font-semibold text-gray-800">Pozycja {index + 1}</div>
                          {manualItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeManualItem(index)}
                              className="rounded border border-red-300 bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              Usuń
                            </button>
                          )}
                        </div>

                        {sourceItem && (
                          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                            <div className="font-semibold mb-1">Odczyt źródłowy</div>
                            <div>{formatSourceItem(sourceItem)}</div>
                          </div>
                        )}

                        {(missingForLine.length > 0 || issueForLine) && (
                          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {missingForLine.length > 0 && (
                              <div>
                                Brakujące pola: {missingForLine.map((field) => allFieldLabels[field] || field).join(", ")}
                              </div>
                            )}
                            {issueForLine && <div>Sprawdź zgodność ilości, rabatu, cen netto/brutto i sum tej pozycji.</div>}
                          </div>
                        )}

                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {([
                            ["item_name", "Nazwa pozycji"],
                            ["quantity", "Ilość"],
                            ["unit", "Jednostka"],
                            ["unit_price", "Cena netto po rabacie"],
                            ["unit_price_before_discount", "Cena netto przed rabatem"],
                            ["unit_price_gross", "Cena brutto jednostkowa"],
                            ["discount_percent", "Rabat %"],
                            ["discount_amount", "Rabat kwotowy"],
                            ["net_total", "Wartość netto"],
                            ["vat_rate", "Stawka VAT"],
                            ["vat_total", "Kwota VAT"],
                            ["gross_total", "Wartość brutto"],
                            ["pkwiu", "PKWiU"],
                            ["gtu", "GTU"],
                            ["code", "Kod / indeks"],
                          ] as Array<[keyof ItemDraft, string]>).map(([field, label]) => (
                            <div key={field}>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
                              <input
                                type="text"
                                value={item[field] || ""}
                                onChange={(e) => updateItemField(index, field, e.target.value)}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateFromManualData}
                className="rounded bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                disabled={loading}
              >
                {loading ? "Generowanie..." : "Akceptuję dane i generuję XML"}
              </button>
              <button
                type="button"
                onClick={() => setShowFixModal(false)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">Instrukcja</h2>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Zamknij
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 text-sm text-gray-700 space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Co potrafi formularz korekty?</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>pełna edycja danych sprzedawcy, nabywcy i odbiorcy,</li>
                  <li>edycja rachunku, dat, płatności, waluty i numeru faktury,</li>
                  <li>edycja każdej pozycji faktury,</li>
                  <li>obsługa rabatu procentowego i kwotowego,</li>
                  <li>kontrola cen netto przed i po rabacie,</li>
                  <li>pokazanie odczytu źródłowego obok danych edytowanych.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Kiedy popup się otwiera?</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>gdy brakuje danych głównych,</li>
                  <li>gdy co najmniej jedna pozycja ma niepełne pola,</li>
                  <li>gdy matematyka pozycji lub sum wymaga korekty,</li>
                  <li>gdy backend zwraca dokładne przyczyny blokady.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">Kontakt</h2>
              <button
                type="button"
                onClick={() => setShowContact(false)}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Zamknij
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Adres</label>
                <input
                  type="text"
                  value="ksefxml@outlook.com"
                  readOnly
                  className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Temat</label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Wiadomość</label>
                <textarea
                  value={contactBody}
                  onChange={(e) => setContactBody(e.target.value)}
                  rows={10}
                  placeholder="Treść wiadomości"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={openMailClient}
                  className="rounded bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Otwórz wiadomość
                </button>
                <button
                  type="button"
                  onClick={() => setShowContact(false)}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">Regulamin i polityka prywatności</h2>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Zamknij
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 text-sm text-gray-700 space-y-4">
              <p>Generator jest narzędziem pomocniczym i może być w fazie rozwoju.</p>
              <p>Każdy wygenerowany XML należy sprawdzić przed użyciem.</p>
              <p>Dane są przetwarzane wyłącznie w celu wygenerowania pliku XML i obsługi technicznej.</p>
              <p className="font-medium">Podstawa prawna przetwarzania danych:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>art. 6 ust. 1 lit. b RODO – realizacja usługi generowania XML</li>
                <li>art. 6 ust. 1 lit. f RODO – uzasadniony interes administratora</li>
              </ul>
              <p>
                Dane mogą być przetwarzane przez zewnętrznych dostawców technologicznych, w tym OpenAI,
                w celu analizy dokumentów i wygenerowania danych XML.
              </p>
              <p>
                Dane mogą być przekazywane poza Europejski Obszar Gospodarczy z zastosowaniem odpowiednich zabezpieczeń.
              </p>
              <p>Dane nie są przechowywane dłużej niż to konieczne do realizacji usługi i nie są archiwizowane.</p>
              <p className="font-medium text-red-600">
                Administrator nie ponosi odpowiedzialności za błędy w wygenerowanych danych XML.
              </p>
            </div>

            <div className="border-t px-6 py-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTerms(false);
                }}
                className="rounded bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Akceptuję
              </button>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {showCookies && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-black text-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <p className="text-sm text-white/90">
              Strona wykorzystuje pliki cookies niezbędne do prawidłowego działania serwisu.
            </p>
            <button
              type="button"
              onClick={() => setShowCookies(false)}
              className="rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
