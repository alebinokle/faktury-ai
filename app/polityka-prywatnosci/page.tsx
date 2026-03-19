"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow text-sm text-gray-700 space-y-4">

        {/* 🔙 PRZYCISK POWROTU */}
        <button
          onClick={() => router.back()}
          className="mb-4 px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          ← Wróć
        </button>

        <h1 className="text-2xl font-bold text-gray-800">
          Polityka prywatności – ksefxml.pl
        </h1>

        <p>
          Niniejsza polityka prywatności określa zasady przetwarzania danych
          przez serwis ksefxml.pl.
        </p>

        <h2 className="font-bold">1. Administrator danych</h2>
        <p>Administratorem danych jest:</p>

        <div className="bg-gray-100 p-3 rounded">
          <p>Adam Porankiewicz</p>
          <p>ul. Motylewska 24</p>
          <p>64-920 Piła</p>
          <p>NIP: 7642529852</p>
          <p>Email: ksefxml@outlook.com</p>
        </div>

        <h2 className="font-bold">2. Zakres przetwarzanych danych</h2>
        <p>
          Serwis przetwarza wyłącznie dane przekazane przez użytkownika w celu
          wygenerowania pliku XML oraz obsługi kontaktu technicznego.
        </p>

        <h2 className="font-bold">3. Cel przetwarzania danych</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>generowanie pliku XML zgodnego z KSeF,</li>
          <li>obsługa zgłoszeń technicznych,</li>
          <li>zapewnienie prawidłowego działania serwisu.</li>
        </ul>

        <h2 className="font-bold">4. Okres przechowywania danych</h2>
        <p>
          Dane nie są przechowywane dłużej niż jest to niezbędne do
          przetworzenia pliku i realizacji usługi. Administrator nie archiwizuje
          przesyłanych dokumentów w celu dalszego wykorzystania.
        </p>

        <h2 className="font-bold">5. Udostępnianie danych</h2>
        <p>
          Dane nie są sprzedawane ani wykorzystywane marketingowo. Mogą być
          czasowo przetwarzane przez dostawców technologicznych i hostingowych
          wyłącznie w zakresie niezbędnym do działania usługi.
        </p>

        <h2 className="font-bold">6. Prawa użytkownika</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>prawo dostępu do danych,</li>
          <li>prawo do sprostowania danych,</li>
          <li>prawo do usunięcia danych,</li>
          <li>prawo do ograniczenia przetwarzania,</li>
          <li>prawo do wniesienia skargi do Prezesa UODO.</li>
        </ul>

        <h2 className="font-bold">7. Cookies</h2>
        <p>
          Serwis może wykorzystywać pliki cookies niezbędne do prawidłowego
          działania strony, utrzymania sesji i podstawowych funkcji technicznych.
        </p>

        <h2 className="font-bold">8. Kontakt</h2>
        <p>
          W sprawach dotyczących prywatności i danych osobowych można kontaktować
          się pod adresem: <strong>ksefxml@outlook.com</strong>
        </p>

        <h2 className="font-bold">9. Postanowienia końcowe</h2>
        <p>
          Korzystanie z serwisu oznacza akceptację niniejszej polityki
          prywatności.
        </p>
      </div>
    </div>
  );
}