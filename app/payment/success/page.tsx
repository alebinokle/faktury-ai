"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [seconds, setSeconds] = useState(5);

  const credits = params.get("credits");

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timer = setTimeout(() => {
      router.push("/");
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-red-600 text-white py-4 px-6 flex items-center justify-between shadow">
        <div className="font-bold text-lg">KSeF</div>
        <div className="text-sm opacity-90">Konwerter faktur do XML</div>
      </div>

      <div className="flex justify-center items-center py-20 px-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white border shadow-md p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />

            <div className="text-5xl mb-3">✅</div>

            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Płatność zakończona
            </h1>

            <p className="text-gray-600 text-sm mb-4">
              Kredyty zostały dodane do Twojego konta.
            </p>

            {credits && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg py-2 px-3 mb-4">
                Dodano <b>{credits}</b> kredytów
              </div>
            )}

            <p className="text-xs text-gray-500 mb-6">
              Powrót do generatora za <b>{seconds}</b>s...
            </p>

            <button
              onClick={() => router.push("/")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
            >
              Wróć do generatora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="rounded-xl bg-white px-6 py-4 shadow text-gray-700">
            Ładowanie...
          </div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
