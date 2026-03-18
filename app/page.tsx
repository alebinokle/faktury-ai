"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setMessage("Najpierw wybierz plik.");
      return;
    }

    try {
      setMessage("Przetwarzanie...");
      setResult("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();

      if (!res.ok) {
        setMessage("Błąd podczas przetwarzania");
        setResult(text);
        return;
      }

      setResult(text);
      setMessage("Gotowe! XML został wygenerowany.");

      const blob = new Blob([text], { type: "application/xml" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "faktura_ksef.xml";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error(error);
      setMessage("Wystąpił błąd podczas wysyłania pliku.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-red-600 text-white py-4 px-6 flex items-center justify-between shadow">
        <div className="font-bold text-lg">KSeF</div>
        <div className="text-sm opacity-90">Konwerter faktur do XML</div>
      </div>

      <div className="flex flex-col items-center py-16 px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-xl mb-10">
          <h1 className="text-2xl font-bold mb-2 text-gray-800">
            Przetwarzanie faktur do KSeF XML
          </h1>

          <p className="text-gray-500 mb-6">
            Wgraj fakturę w PDF lub jako zdjęcie. System odczyta dokument i zwróci XML.
          </p>

          <div className="mb-4">
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
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

          <button
            onClick={handleUpload}
            className="w-full bg-blue-900 text-white py-2 rounded hover:bg-blue-800 transition font-semibold"
          >
            Przetwórz do XML
          </button>

          {message && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-sm text-gray-700">
              {message}
            </div>
          )}

          {result && (
            <pre className="mt-4 p-3 bg-gray-50 border rounded text-xs text-gray-700 overflow-auto max-h-80 whitespace-pre-wrap">
              {result}
            </pre>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-2 text-gray-800">Czym jest KSeF?</h2>
            <p className="text-gray-600 text-sm">
              Krajowy System e-Faktur (KSeF) to platforma do wystawiania, przesyłania
              i przechowywania faktur w ustandaryzowanym formacie XML.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-2 text-gray-800">Nasza aplikacja</h2>
            <p className="text-gray-600 text-sm">
              Aplikacja umożliwia szybką konwersję faktur w różnych formatach
              do XML, bez ręcznego przepisywania danych.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}