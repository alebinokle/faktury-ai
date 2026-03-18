"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    setMessage("Przetwarzanie...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/process", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.xml) {
      const blob = new Blob([data.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "faktura.xml";
      a.click();

      setMessage("Gotowe! XML pobrany.");
    } else {
      setMessage("Błąd podczas przetwarzania");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      
      {/* 🔴 HEADER */}
      <div className="bg-red-600 text-white py-4 px-6 flex items-center justify-between shadow">
        <div className="font-bold text-lg">KSeF</div>
        <div className="text-sm opacity-90">Konwerter faktur do XML</div>
      </div>

      {/* 🧾 MAIN */}
      <div className="flex flex-col items-center py-16 px-4">

        {/* 📦 PANEL */}
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-xl mb-10">
          <h1 className="text-2xl font-bold mb-2 text-gray-800">
            Przetwarzanie faktur do KSeF XML
          </h1>

          <p className="text-gray-500 mb-6">
            Wgraj fakturę w PDF lub jako zdjęcie. System odczyta dokument i zwróci XML.
          </p>

          <input
            type="file"
            className="mb-4 w-full border p-2 rounded"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {/* 🔵 GRANATOWY BUTTON */}
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
        </div>

        {/* ℹ️ SEKCJA INFO */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-2 text-gray-800">
              Czym jest KSeF?
            </h2>
            <p className="text-gray-600 text-sm">
              Krajowy System e-Faktur (KSeF) to platforma Ministerstwa Finansów 
              umożliwiająca wystawianie, przesyłanie i przechowywanie faktur 
              w ustandaryzowanym formacie XML.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-2 text-gray-800">
              Nasza aplikacja
            </h2>
            <p className="text-gray-600 text-sm">
              Aplikacja umożliwia szybką konwersję faktur (PDF, zdjęcia, skany) 
              do formatu XML zgodnego z KSeF. Dzięki temu możesz automatycznie 
              przygotować dokumenty do systemu bez ręcznego przepisywania danych.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}