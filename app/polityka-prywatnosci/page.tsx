export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <a
          href="/"
          className="mb-6 inline-block rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          ← Wróć
        </a>

        <h1 className="mb-4 text-3xl font-bold text-gray-900">
          Regulamin i polityka prywatności – ksefxml.pl
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          Niniejszy dokument określa zasady korzystania z serwisu ksefxml.pl oraz zasady
          przetwarzania danych przez serwis.
        </p>

        <div className="mb-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <div className="font-semibold">Administrator danych i usługodawca</div>
          <div className="mt-2">PHU Amag</div>
          <div>ul. Motylewska 24</div>
          <div>64-920 Piła</div>
          <div>NIP: 7640101529</div>
          <div>Email: ksefxml@outlook.com</div>
        </div>

        <div className="space-y-6 text-sm leading-6 text-gray-700">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">1. Zakres usługi</h2>
            <p>
              Serwis ksefxml.pl umożliwia analizę przesłanych przez użytkownika dokumentów
              oraz generowanie plików XML zgodnych z KSeF.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">2. Zasady korzystania</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Użytkownik korzysta z serwisu na własną odpowiedzialność.</li>
              <li>Użytkownik powinien sprawdzić poprawność danych przed użyciem wygenerowanego pliku XML.</li>
              <li>Serwis może odrzucić plik lub przerwać przetwarzanie w razie błędów technicznych lub braku kredytów.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">3. Kredyty i płatności</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>1 kredyt odpowiada wygenerowaniu 1 pliku XML z 1 faktury.</li>
              <li>Nowe konto startuje z saldem 0 kredytów.</li>
              <li>Użytkownik może jednorazowo skorzystać z przycisku testowego dodającego 3 kredyty.</li>
              <li>Kolejne kredyty można uzyskać wyłącznie przez zakup pakietów dostępnych w serwisie.</li>
              <li>Kredyty są przypisane do konta użytkownika i nie podlegają wymianie na środki pieniężne.</li>
              <li>Kredyty nie wygasają, o ile serwis pozostaje aktywny.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">4. Płatności i operator płatności</h2>
            <p>
              Płatności za pakiety kredytów realizowane są za pośrednictwem operatora
              płatności Przelewy24 (PayPro S.A. z siedzibą w Poznaniu).
            </p>
            <p className="mt-2">
              Dane dotyczące płatności, w szczególności dane karty lub rachunku bankowego,
              nie są przetwarzane przez serwis ksefxml.pl, lecz bezpośrednio przez operatora płatności.
            </p>
            <p className="mt-2">
              Dokonanie płatności oznacza zawarcie umowy na dostarczenie usługi cyfrowej
              w postaci kredytów do wykorzystania w serwisie.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">5. Brak prawa odstąpienia od umowy</h2>
            <p>
              Zgodnie z art. 38 pkt 13 ustawy o prawach konsumenta, użytkownikowi nie przysługuje
              prawo odstąpienia od umowy po rozpoczęciu świadczenia usługi cyfrowej.
            </p>
            <p className="mt-2">
              Zakup kredytów oznacza wyraźną zgodę na natychmiastowe rozpoczęcie świadczenia usługi
              oraz utratę prawa do odstąpienia od umowy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">6. Zakres przetwarzanych danych</h2>
            <p>
              Serwis przetwarza wyłącznie dane przekazane przez użytkownika w celu
              wykonania usługi, obsługi płatności, logowania, kontaktu technicznego oraz
              zapewnienia prawidłowego działania serwisu.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">7. Cel przetwarzania danych</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>generowanie plików XML zgodnych z KSeF,</li>
              <li>obsługa płatności i rozliczeń kredytów,</li>
              <li>obsługa logowania i sesji użytkownika,</li>
              <li>obsługa zgłoszeń technicznych,</li>
              <li>zapewnienie prawidłowego działania serwisu.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">8. Okres przechowywania danych</h2>
            <p>
              Dane są przechowywane nie dłużej, niż jest to niezbędne do wykonania usługi,
              obsługi konta użytkownika, rozliczenia płatności lub spełnienia obowiązków
              prawnych administratora.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">9. Udostępnianie danych</h2>
            <p>
              Dane nie są sprzedawane. Mogą być czasowo przetwarzane przez dostawców
              technologicznych, hostingowych oraz operatora płatności w zakresie
              niezbędnym do działania usługi.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">10. Odpowiedzialność użytkownika i serwisu</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Użytkownik ponosi odpowiedzialność za dane wprowadzone do systemu oraz za dane zawarte w przesyłanych dokumentach.</li>
              <li>Użytkownik powinien każdorazowo zweryfikować poprawność wygenerowanego pliku XML przed jego użyciem.</li>
              <li>Serwis nie ponosi odpowiedzialności za błędy wynikające z nieprawidłowych danych wejściowych lub wykorzystania pliku bez weryfikacji.</li>
              <li>Odpowiedzialność serwisu ogranicza się do wartości zakupionych przez użytkownika kredytów.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">11. Reklamacje</h2>
            <p>
              Reklamacje można zgłaszać drogą mailową na adres:
              <span className="font-semibold"> ksefxml@outlook.com</span>.
            </p>
            <p className="mt-2">
              Reklamacja powinna zawierać adres e-mail użytkownika, opis problemu oraz datę zdarzenia.
            </p>
            <p className="mt-2">
              Reklamacje rozpatrywane są w terminie do 14 dni.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">12. Prawa użytkownika</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>prawo dostępu do danych,</li>
              <li>prawo do sprostowania danych,</li>
              <li>prawo do usunięcia danych,</li>
              <li>prawo do ograniczenia przetwarzania,</li>
              <li>prawo do wniesienia skargi do Prezesa UODO.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">13. Cookies</h2>
            <p>
              Serwis może wykorzystywać pliki cookies niezbędne do prawidłowego działania
              strony, utrzymania sesji oraz podstawowych funkcji technicznych.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">14. Kontakt</h2>
            <p>
              W sprawach dotyczących serwisu, regulaminu lub prywatności można
              kontaktować się pod adresem: <span className="font-semibold">ksefxml@outlook.com</span>
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">15. Postanowienia końcowe</h2>
            <p>
              Korzystanie z serwisu oznacza akceptację niniejszego regulaminu i polityki prywatności.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
