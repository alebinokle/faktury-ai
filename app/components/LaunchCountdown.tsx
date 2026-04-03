"use client";

import { useEffect, useMemo, useState } from "react";

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));

  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

export default function LaunchCountdown() {
  const targetDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 4);
    return date.getTime();
  }, []);

  const [timeLeft, setTimeLeft] = useState(targetDate - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(targetDate - Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const { days, hours, minutes, seconds } = formatTime(timeLeft);

  return (
    <div className="w-full rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-red-50 p-5 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="mb-2 inline-block rounded-full bg-red-600 px-4 py-1 text-sm font-semibold text-white">
          Strona w trakcie budowy
        </div>

        <h2 className="text-2xl font-bold text-zinc-900 md:text-3xl">
          Pełna funkcjonalność pojawi się za:
        </h2>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="min-w-[80px] rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow">
            <div className="text-3xl font-bold">{days}</div>
            <div className="text-xs uppercase tracking-wider text-zinc-300">dni</div>
          </div>

          <div className="min-w-[80px] rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow">
            <div className="text-3xl font-bold">{hours}</div>
            <div className="text-xs uppercase tracking-wider text-zinc-300">godz</div>
          </div>

          <div className="min-w-[80px] rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow">
            <div className="text-3xl font-bold">{minutes}</div>
            <div className="text-xs uppercase tracking-wider text-zinc-300">min</div>
          </div>

          <div className="min-w-[80px] rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow">
            <div className="text-3xl font-bold">{seconds}</div>
            <div className="text-xs uppercase tracking-wider text-zinc-300">sek</div>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-sm text-zinc-600 md:text-base">
          Aplikacja już działa, ale niektóre elementy są jeszcze dopracowywane.
          Dziękujemy za cierpliwość.
        </p>
      </div>
    </div>
  );
}