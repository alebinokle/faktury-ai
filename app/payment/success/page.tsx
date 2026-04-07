"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [seconds, setSeconds] = useState(5);

  // opcjonalnie możesz przekazać credits w URL np ?credits=100
  const credits = params.get("credits");

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s - 1);
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
    <div className="flex justify-center items-center py-20 px-4 animate-fadeIn">
      <div className="w-full max-w-md">

        <div className="rounded-2xl bg-white border shadow-md p-6 text-center relative overflow-hidden">

          {/* zielony pasek sukcesu */}
          <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>

          {/* animowana ikonka */}
          <div className="text-5xl mb-3 animate-bounce">✅</div>

          {/* TITLE */}
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Płatność zakończona
          </h1>

          {/* SUBTEXT */}
          <p className="text-gray-600 text-sm mb-4">
            Kredyty zostały dodane do Twojego konta.
          </p>

          {/* info o kredytach */}
          {credits && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg py-2 px-3 mb-4">
              Dodano <b>{credits}</b> kredytów
            </div>
          )}

          {/* countdown */}
          <p className="text-xs text-gray-500 mb-6">
            Powrót do generatora za <b>{seconds}</b>s...
          </p>

          {/* BUTTON */}
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
          >
            Wróć do generatora
          </button>
        </div>
      </div>

      {/* animacja fade */}
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.4s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}