"use client";

import { useEffect, useMemo, useState } from "react";

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
  missing_fields?: string[];
  extracted_data?: Record<string, unknown>;
  raw_response?: string;
  credits_left?: number;
};

type ManualFieldMap = Record<string, string>;

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
  paid: "Czy opłacono",
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
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
  const [manualData, setManualData] = useState<ManualFieldMap>({});
  const [extractedData, setExtractedData] = useState<Record<string, unknown>>({});

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

        let data: MeResponse | null = null;
        try {
          data = await res.json();
        } catch (error) {
          console.error("Błąd /api/auth/me:", error);
          return;
        }

        if (data?.loggedIn && data.user) {
          updateLoggedInUser({
            email: data.user.email,
            credits: data.user.credits,
          });
          setUserMessage(`Zalogowano jako ${data.user.email}`);
        } else {
          setLoggedIn(false);
          setUserEmail("");
          setCredits(null);
        }
      } catch (error) {
        console.error(error);
        setLoggedIn(false);
        setUserEmail("");
        setCredits(null);
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

  const handleSendLoginLink = async () => {
    try {
      setUserMessage("");

      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        setUserMessage("Podaj adres e-mail.");
        return;
      }

      const res = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setUserMessage(data?.message || "Nie udało się wysłać linku logowania.");
        return;
      }

      setUserMessage("Link logowania został wysłany na podany adres e-mail.");
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas wysyłania linku logowania.");
    }
  };

  const handleRefreshSession = async () => {
    try {
      setUserMessage("");

      const res = await fetch("/api/auth/me", { cache: "no-store" });

      let data: MeResponse | null = null;
      try {
        data = await res.json();
      } catch (error) {
        console.error("Błąd /api/auth/me:", error);
        return;
      }

      if (data?.loggedIn && data.user) {
        updateLoggedInUser({
          email: data.user.email,
          credits: data.user.credits,
        });
        setUserMessage(`Zalogowano jako ${data.user.email}`);
      } else {
        setLoggedIn(false);
        setUserEmail("");
        setCredits(null);
        setUserMessage("Nie jesteś zalogowany.");
      }
    } catch (error) {
      console.error(error);
      setUserMessage("Nie udało się odświeżyć sesji.");
    }
  };

  const handleRefreshCredits = async () => {
    try {
      setUserMessage("");

      if (!userEmail) {
        setUserMessage("Brak adresu e-mail zalogowanego użytkownika.");
        return;
      }

      const res = await fetch("/api/user/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail }),
      });

      const data: CreditsApiResponse = await res.json();

      if (!res.ok || !data?.success || !data.user) {
        setUserMessage(data?.message || "Nie udało się pobrać kredytów.");
        return;
      }

      setCredits(data.user.credits);
      setUserMessage(`Aktualny stan kredytów: ${data.user.credits}`);
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas pobierania kredytów.");
    }
  };

  const handleAddTestCredits = async (creditsToAdd = 30) => {
    try {
      setUserMessage("");

      if (!userEmail) {
        setUserMessage("Brak adresu e-mail zalogowanego użytkownika.");
        return;
      }

      const res = await fetch("/api/user/add-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          credits: creditsToAdd,
        }),
      });

      const data: CreditsApiResponse = await res.json();

      if (!res.ok || !data?.success || !data.user) {
        setUserMessage(data?.message || "Nie udało się dodać kredytów.");
        return;
      }

      setCredits(data.user.credits);
      setUserMessage(`Dodano ${creditsToAdd} kredytów. Aktualny stan: ${data.user.credits}`);
    } catch (error) {
      console.error(error);
      setUserMessage("Wystąpił błąd podczas dodawania kredytów.");
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setUserMessage(data?.message || "Nie udało się wylogować.");
        return;
      }

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
    if (!acceptedTerms) {
      setStatus("error");
      setMessage("Aby wysłać plik, musisz zaakceptować regulamin i politykę prywatności.");
      setMissingFields([]);
      setResult("");
      return;
    }

    if (!loggedIn) {
      setStatus("error");
      setMessage("Najpierw zaloguj się linkiem wysłanym na e-mail.");
      setMissingFields([]);
      setResult("");
      return;
    }

    if (!file) {
      setStatus("error");
      setMessage("Najpierw wybierz plik faktury.");
      setMissingFields([]);
      setResult("");
      return;
    }

    try {
      setLoading(true);
      setStatus("info");
      setMessage("Trwa przetwarzanie faktury...");
      setResult("");
      setMissingFields([]);
      setManualData({});
      setExtractedData({});
      setShowFixModal(false);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("manualData", JSON.stringify(manualData));

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      const disposition = res.headers.get("content-disposition") || "";
      const creditsLeftHeader = res.headers.get("x-credits-left");

      if (!res.ok) {
        if (contentType.includes("application/json")) {
          const err: ApiErrorResponse = await res.json();
          const missing = err.missing_fields || [];
          const extracted = (err.extracted_data || {}) as Record<string, unknown>;

          if (typeof err.credits_left === "number") {
            setCredits(err.credits_left);
          }

          if (res.status === 401) {
            setLoggedIn(false);
            setUserEmail("");
            setCredits(null);
            setStatus("error");
            setMessage(err.message || "Sesja wygasła. Zaloguj się ponownie.");
            setMissingFields([]);
            setResult(JSON.stringify(err, null, 2));
            return;
          }

          if (res.status === 402) {
            setStatus("error");
            setMessage(err.message || "Brak kredytów. Dokup pakiet, aby wygenerować XML.");
            setMissingFields([]);
            setResult(JSON.stringify(err, null, 2));
            return;
          }

          setStatus("error");
          setMessage(err.message || "Wystąpił błąd podczas przetwarzania.");
          setMissingFields(missing);
          setExtractedData(extracted);

          const initialManualData: ManualFieldMap = {};
          for (const field of missing) {
            const raw = extracted[field];
            initialManualData[field] = raw === null || raw === undefined ? "" : String(raw);
          }
          setManualData(initialManualData);

          setResult(
            JSON.stringify(
              {
                message: err.message,
                missing_fields: err.missing_fields,
                extracted_data: err.extracted_data,
                raw_response: err.raw_response,
                credits_left: err.credits_left,
              },
              null,
              2
            )
          );

          if (missing.length > 0) {
            setShowFixModal(true);
          }
        } else {
          const text = await res.text();
          setStatus("error");
          setMessage("Wystąpił błąd podczas przetwarzania.");
          setMissingFields([]);
          setResult(text);
        }
        return;
      }

      const text = await res.text();

      let filename = "faktura.xml";
      const match = disposition.match(/filename="([^"]+)"/i);
      if (match?.[1]) {
        filename = match[1];
      }

      if (creditsLeftHeader !== null) {
        const parsedCredits = Number(creditsLeftHeader);
        if (!Number.isNaN(parsedCredits)) {
          setCredits(parsedCredits);
        }
      }

      setGeneratedXml(text);
      setGeneratedFilename(filename);
      setResult(text);
      setStatus("success");
      setMessage("Gotowe. Plik XML został wygenerowany.");
      setMissingFields([]);

      downloadXmlFromValues(text, filename);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Wystąpił błąd podczas wysyłania pliku.");
      setMissingFields([]);
      setResult("");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromManualData = async () => {
    if (!file) return;

    if (!loggedIn) {
      setStatus("error");
      setMessage("Sesja wygasła. Zaloguj się ponownie.");
      return;
    }

    try {
      setLoading(true);
      setStatus("info");
      setMessage("Generowanie XML po uzupełnieniu danych...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("manualData", JSON.stringify(manualData));

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      const disposition = res.headers.get("content-disposition") || "";
      const creditsLeftHeader = res.headers.get("x-credits-left");

      if (!res.ok) {
        if (contentType.includes("application/json")) {
          const err: ApiErrorResponse = await res.json();

          if (typeof err.credits_left === "number") {
            setCredits(err.credits_left);
          }

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
            setMessage(err.message || "Brak kredytów. Dokup pakiet, aby wygenerować XML.");
            setResult(JSON.stringify(err, null, 2));
            return;
          }

          setStatus("error");
          setMessage(err.message || "Nie udało się wygenerować XML po uzupełnieniu danych.");
          setResult(JSON.stringify(err, null, 2));
          return;
        }

        const errText = await res.text();
        setStatus("error");
        setMessage("Nie udało się wygenerować XML po uzupełnieniu danych.");
        setResult(errText);
        return;
      }

      const text = await res.text();

      let filename = "faktura.xml";
      const match = disposition.match(/filename="([^"]+)"/i);
      if (match?.[1]) {
        filename = match[1];
      }

      if (creditsLeftHeader !== null) {
        const parsedCredits = Number(creditsLeftHeader);
        if (!Number.isNaN(parsedCredits)) {
          setCredits(parsedCredits);
        }
      }

      setGeneratedXml(text);
      setGeneratedFilename(filename);
      setResult(text);
      setStatus("success");
      setMessage("Gotowe. XML został wygenerowany po uzupełnieniu danych.");
      setShowFixModal(false);
      setMissingFields([]);

      downloadXmlFromValues(text, filename);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Wystąpił błąd podczas generowania XML.");
    } finally {
      setLoading(false);
    }
  };

  const openMailClient = () => {
    window.location.href = mailtoHref;
  };

  if (checkingLogin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="rounded-xl bg-white px-6 py-4 shadow text-gray-700">
          Ładowanie...
        </div>
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
          <h1 className="text-2xl font-bold mb-2 text-gray-800">
            Przetwarzanie faktur do KSeF XML
          </h1>

          <p className="text-gray-500 mb-6">
            Wgraj fakturę w PDF lub jako zdjęcie. System odczyta dokument i wygeneruje XML albo pokaże, jakich danych brakuje.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Logowanie i konto</h2>

            {!loggedIn ? (
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Podaj swój e-mail"
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
                    Sprawdź logowanie
                  </button>
                </div>

                <div className="text-xs text-gray-500">
                  Po kliknięciu przycisku wyślemy link logowania na podany adres e-mail.
                </div>

                {userMessage && (
                  <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                    {userMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  Zalogowano jako: <span className="font-semibold">{userEmail}</span>
                </div>

                {credits !== null && (
                  <div className="text-sm font-medium text-gray-700">
                    Aktualna liczba kredytów: <span className="text-blue-900">{credits}</span>
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-sm font-semibold text-blue-900 mb-2">
                    Zarządzanie kredytami
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRefreshCredits}
                      className="rounded border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                    >
                      Sprawdź kredyty
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddTestCredits(30)}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Dodaj 30 kredytów
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
                setMessage("");
                setResult("");
                setMissingFields([]);
                setStatus("idle");
                setShowFixModal(false);
              }}
            />

            <div className="flex items-center gap-3">
              <label
                htmlFor="file-upload"
                className="inline-block cursor-pointer rounded border border-gray-400 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
              >
                Wybierz plik
              </label>

              <span className="text-sm text-gray-700 break-all">
                {file ? file.name : "Nie wybrano pliku"}
              </span>
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
                <span className="block mt-1 text-xs text-gray-500">
                  Bez akceptacji regulaminu nie można przesłać pliku do przetworzenia.
                </span>
              </span>
            </label>

            <div className="mt-3">
              <a
                href="/polityka-prywatnosci"
                className="text-sm text-blue-700 underline hover:text-blue-900"
              >
                Zobacz pełną politykę prywatności
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleUpload}
              disabled={loading || !acceptedTerms || !loggedIn}
              className="flex-1 min-w-[180px] bg-blue-900 text-white py-2 rounded hover:bg-blue-800 transition font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Przetwarzanie..." : "Przetwórz do XML"}
            </button>

            <button
              onClick={downloadXml}
              disabled={!generatedXml}
              className="px-4 py-2 rounded border border-blue-900 text-blue-900 bg-white hover:bg-blue-50 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pobierz ponownie XML
            </button>

            <button
              onClick={() => setShowInstructions(true)}
              type="button"
              className="px-4 py-2 rounded border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 transition font-semibold"
            >
              Instrukcja KSeF
            </button>

            <button
              onClick={() => setShowContact(true)}
              type="button"
              className="px-4 py-2 rounded border border-red-300 text-red-700 bg-white hover:bg-red-50 transition font-semibold"
            >
              Kontakt z działem technicznym
            </button>
          </div>
        </div>

        {(message || missingFields.length > 0) && (
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xl mb-10 border">
            <h2 className="font-bold text-lg mb-3 text-gray-800">
              Informacje zwrotne
            </h2>

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

            {missingFields.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="font-semibold text-amber-800 mb-2">
                  Brakuje następujących danych:
                </div>
                <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                  {missingFields.map((field) => (
                    <li key={field}>{fieldLabels[field] || field}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setShowFixModal(true)}
                  className="mt-3 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Uzupełnij brakujące dane
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
            <h2 className="font-bold text-lg mb-2 text-gray-800">Nasza aplikacja</h2>
            <p className="text-gray-600 text-sm">
              Aplikacja umożliwia szybkie generowanie plików XML z faktur wgranych jako PDF lub pliki graficzne, bez ręcznego przepisywania danych.
            </p>
          </div>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl mt-10">
            <h2 className="font-bold text-lg mb-3 text-gray-800">
              Zawartość odpowiedzi
            </h2>
            <pre className="mt-2 p-3 bg-gray-50 border rounded text-xs text-gray-700 overflow-auto max-h-96 whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}
      </div>

      {showFixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">
                Uzupełnij brakujące lub nieczytelne dane
              </h2>
              <button
                type="button"
                onClick={() => setShowFixModal(false)}
                className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Zamknij
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4 max-h-[65vh]">
              {missingFields.map((field) => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {fieldLabels[field] || field}
                  </label>
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

            <div className="border-t px-6 py-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateFromManualData}
                className="rounded bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                disabled={loading}
              >
                {loading ? "Generowanie..." : "Generuj XML"}
              </button>

              <button
                type="button"
                onClick={() => setShowFixModal(false)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-800">
                Instrukcja – co powinna zawierać faktura
              </h2>
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
                <h3 className="font-semibold text-gray-900 mb-2">
                  Aby XML przeszedł bez błędów, faktura powinna zawierać:
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>dane sprzedawcy: nazwa i NIP,</li>
                  <li>dane nabywcy: nazwa i NIP,</li>
                  <li>numer faktury,</li>
                  <li>datę wystawienia,</li>
                  <li>datę sprzedaży,</li>
                  <li>kwotę netto, VAT i brutto,</li>
                  <li>stawkę VAT,</li>
                  <li>nazwę towaru lub usługi,</li>
                  <li>ilość i jednostkę miary,</li>
                  <li>cenę jednostkową,</li>
                  <li>termin płatności lub informację, że faktura została opłacona,</li>
                  <li>opcjonalnie numer rachunku bankowego,</li>
                  <li>opcjonalnie REGON.</li>
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
              <h2 className="text-xl font-bold text-gray-800">
                Kontakt z działem technicznym
              </h2>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Do
                </label>
                <input
                  type="text"
                  value="ksefxml@outlook.com"
                  readOnly
                  className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Temat
                </label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Wiadomość
                </label>
                <textarea
                  value={contactBody}
                  onChange={(e) => setContactBody(e.target.value)}
                  rows={10}
                  placeholder="Opisz problem..."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={openMailClient}
                  className="rounded bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Otwórz wiadomość e-mail
                </button>

                <button
                  type="button"
                  onClick={() => setShowContact(false)}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Anuluj
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
              <h2 className="text-xl font-bold text-gray-800">
                Regulamin i polityka prywatności
              </h2>
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
              <p>Użytkownik ma obowiązek sprawdzić poprawność danych przed użyciem XML.</p>
              <p>Dane są przetwarzane wyłącznie w celu wygenerowania pliku XML i obsługi technicznej.</p>

              <p className="font-medium">Podstawa prawna przetwarzania danych:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>art. 6 ust. 1 lit. b RODO – realizacja usługi generowania XML</li>
                <li>art. 6 ust. 1 lit. f RODO – uzasadniony interes administratora</li>
              </ul>

              <p>
                Dane mogą być przetwarzane przez zewnętrznych dostawców technologicznych,
                w tym OpenAI, w celu analizy dokumentów i wygenerowania danych XML.
              </p>

              <p>
                Dane mogą być przekazywane poza Europejski Obszar Gospodarczy (np. do USA)
                z zastosowaniem odpowiednich zabezpieczeń.
              </p>

              <p>
                Dane nie są przechowywane dłużej niż to konieczne do realizacji usługi
                i nie są archiwizowane.
              </p>

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
              Ta strona wykorzystuje pliki cookies niezbędne do prawidłowego działania serwisu. Korzystając ze strony, akceptujesz ich użycie.
            </p>

            <button
              type="button"
              onClick={() => setShowCookies(false)}
              className="rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
