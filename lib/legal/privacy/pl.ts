import type { LegalSection } from "@/components/marketing/legal-doc-layout";
import { LEGAL_ENTITY } from "@/lib/brand/legal";

/**
 * Polityka Prywatności (PL). Binding version. Administrator identity and
 * contact come from lib/brand so identity changes happen in one place.
 * Retention periods mirror the security page and the actual implementation
 * (30-day invoice retention, 60-minute magic links, 90-day logs, 5-year
 * accounting records).
 */
export const PRIVACY_SECTIONS_PL: ReadonlyArray<LegalSection> = [
  {
    id: "administrator",
    title: "1. Administrator danych",
    content: `Administratorem danych osobowych przetwarzanych w serwisie tlumaczksef.pl (dalej: Serwis) jest ${LEGAL_ENTITY.name}, NIP: ${LEGAL_ENTITY.nip}, REGON: ${LEGAL_ENTITY.regon}, adres: ${LEGAL_ENTITY.address} (dalej: Administrator).
We wszystkich sprawach dotyczących danych osobowych można kontaktować się pod adresem e-mail: ${LEGAL_ENTITY.contactEmail}.
Niniejsza polityka realizuje obowiązki informacyjne wynikające z art. 13 i 14 rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).`
  },
  {
    id: "zakres-danych",
    title: "2. Jakie dane przetwarzamy",
    content: `W zależności od sposobu korzystania z Serwisu przetwarzamy następujące kategorie danych:
1. Dane Konta: adres e-mail, ustawienia Konta (język interfejsu, opcjonalna nazwa wyświetlana), saldo kredytów, historia tłumaczeń.
2. Dane wersji demonstracyjnej: adres e-mail podany do jednorazowej weryfikacji oraz przesłany plik XML faktury.
3. Dane rozliczeniowe: nazwa nabywcy, NIP, adres oraz historia zakupów. Dane kart płatniczych przetwarza wyłącznie operator płatności Stripe; nie mamy do nich dostępu i ich nie przechowujemy.
4. Treść faktur: dane zawarte w przesyłanych plikach XML zgodnych ze schematem FA(3), które mogą obejmować dane sprzedawcy i nabywcy (nazwy, numery NIP, adresy, numery rachunków bankowych, pozycje faktury).
5. Dane techniczne: adres IP, logi serwera, identyfikatory sesji oraz wynik weryfikacji antybotowej.`
  },
  {
    id: "cele-i-podstawy",
    title: "3. Cele i podstawy prawne przetwarzania",
    content: `Dane przetwarzamy w następujących celach i na następujących podstawach prawnych:
1. Świadczenie usług: prowadzenie Konta, logowanie jednorazowym linkiem, wykonywanie tłumaczeń, przechowywanie plików i historii, obsługa wersji demonstracyjnej. Podstawa: art. 6 ust. 1 lit. b RODO (wykonanie umowy lub działania przed jej zawarciem).
2. Rozliczenia i księgowość: wystawianie faktur VAT, przesyłanie ich do Krajowego Systemu e-Faktur, przechowywanie dokumentacji księgowej. Podstawa: art. 6 ust. 1 lit. c RODO (obowiązek prawny wynikający z przepisów podatkowych i ustawy o rachunkowości).
3. Bezpieczeństwo: prowadzenie logów, zapobieganie nadużyciom, ochrona przed botami, wykrywanie i obsługa incydentów. Podstawa: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora polegający na zapewnieniu bezpieczeństwa usług).
4. Obsługa zapytań, reklamacji oraz ustalenie, dochodzenie i obrona roszczeń. Podstawa: art. 6 ust. 1 lit. b oraz lit. f RODO.
5. Pomiar skuteczności reklam i anonimowe statystyki odwiedzin: wyłącznie po wyrażeniu zgody przez baner cookies. Podstawa: art. 6 ust. 1 lit. a RODO (zgoda); zgodę można wycofać w każdej chwili.
Nie wysyłamy komunikacji marketingowej bez odrębnej zgody. Wiadomości e-mail wysyłane przez Serwis mają charakter transakcyjny (link logowania, potwierdzenie zakupu, faktura, informacje o zmianach regulaminu).`
  },
  {
    id: "powierzenie",
    title: "4. Dane z faktur: rola podmiotu przetwarzającego",
    content: `Przesyłane do Serwisu faktury mogą zawierać dane osobowe osób trzecich, w szczególności kontrahentów użytkownika. W odniesieniu do tych danych administratorem jest użytkownik, a my działamy jako podmiot przetwarzający w rozumieniu art. 28 RODO, na podstawie powierzenia opisanego w § 14 Regulaminu.
Dane z faktur przetwarzamy wyłącznie w celu wykonania tłumaczenia i wygenerowania dokumentu PDF, przez okres wskazany w sekcji 7. Nie wykorzystujemy treści faktur ani tłumaczeń do trenowania modeli sztucznej inteligencji ani do żadnych własnych celów.`
  },
  {
    id: "odbiorcy",
    title: "5. Odbiorcy danych",
    content: `Korzystamy z usług następujących podmiotów przetwarzających dane w naszym imieniu:
1. Supabase: baza danych, przechowywanie plików i uwierzytelnianie; dane przechowywane we Frankfurcie (region AWS eu-central-1, Unia Europejska).
2. Vercel: hosting aplikacji i infrastruktura serwerowa.
3. OpenAI: automatyczne tłumaczenie treści faktur; siedziba w USA, zawarta umowa powierzenia przetwarzania.
4. Stripe (Stripe Payments Europe, Ltd., Irlandia): obsługa płatności.
5. Resend: wysyłka wiadomości transakcyjnych (linki logowania, potwierdzenia); siedziba w USA, zawarta umowa powierzenia przetwarzania.
6. iFirma: wystawianie faktur VAT za zakupy w Serwisie i przesyłanie ich do Krajowego Systemu e-Faktur; siedziba w Polsce.
7. Cloudflare: weryfikacja antybotowa (Turnstile) chroniąca formularze Serwisu.
8. Google (Google Ireland Limited): pomiar skuteczności reklam Google Ads, wyłącznie po wyrażeniu zgody na cookies marketingowe.
9. PostHog (PostHog EU): analityka produktowa i statystyki użycia aplikacji; dane przechowywane w Unii Europejskiej (region Frankfurt). U osób bez zgody na cookies analityczne analityka działa bez plików cookie i bez trwałych identyfikatorów w przeglądarce. Pliki cookie analityki zapisujemy wyłącznie po zaakceptowaniu kategorii "analityczne" w banerze cookies. Zdarzenia zalogowanych użytkowników łączymy z kontem w ramach prawnie uzasadnionego interesu, aby rozumieć korzystanie z produktu.
Ponadto dane mogą być udostępniane organom publicznym, gdy obowiązek taki wynika z przepisów prawa, oraz Krajowemu Systemowi e-Faktur w zakresie faktur VAT dokumentujących zakupy w Serwisie. Nie sprzedajemy danych osobowych.`
  },
  {
    id: "transfery-poza-eog",
    title: "6. Przekazywanie danych poza EOG",
    content: `Część naszych dostawców (OpenAI, Resend, Cloudflare, a w razie zgody na cookies marketingowe także Google) ma siedzibę w Stanach Zjednoczonych lub korzysta z infrastruktury w USA, co może wiązać się z przekazaniem danych poza Europejski Obszar Gospodarczy (EOG).
Przekazania odbywają się na podstawie decyzji wykonawczej Komisji Europejskiej dotyczącej ram ochrony danych UE-USA (EU-US Data Privacy Framework) w odniesieniu do podmiotów certyfikowanych, a w pozostałym zakresie na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską, wraz z dodatkowymi środkami ochrony.
Kopię stosowanych zabezpieczeń można uzyskać, kontaktując się z nami pod adresem wskazanym w sekcji 1. Pliki faktur i tłumaczenia są przechowywane wyłącznie na serwerach w Unii Europejskiej; do OpenAI przekazywana jest treść faktury na czas wykonania tłumaczenia.`
  },
  {
    id: "okresy-przechowywania",
    title: "7. Jak długo przechowujemy dane",
    content: `Stosujemy następujące okresy przechowywania:
1. Pliki XML faktur: 30 dni od przesłania, następnie są trwale usuwane.
2. Tłumaczenia: 30 dni od wykonania, następnie są trwale usuwane.
3. Jednorazowe linki logowania: 60 minut od wygenerowania.
4. Dane Konta (e-mail, ustawienia, saldo kredytów): przez czas posiadania Konta; po usunięciu Konta dane są trwale usuwane.
5. Dokumentacja księgowa i dane rozliczeniowe (faktury VAT, logi zakupów): 5 lat, licząc od końca roku podatkowego, w którym powstał obowiązek podatkowy, zgodnie z przepisami prawa.
6. Logi serwera: 90 dni.
7. Dane przetwarzane w celu obrony roszczeń: do upływu okresów przedawnienia.
Pliki przesłane w wersji demonstracyjnej podlegają tym samym zasadom co pliki przesłane z Konta.`
  },
  {
    id: "prawa",
    title: "8. Twoje prawa",
    content: `W związku z przetwarzaniem danych osobowych przysługuje Ci prawo do:
1. dostępu do danych oraz otrzymania ich kopii (art. 15 RODO),
2. sprostowania nieprawidłowych danych (art. 16 RODO),
3. usunięcia danych, tzw. prawo do bycia zapomnianym (art. 17 RODO); Konto można usunąć samodzielnie w ustawieniach Serwisu,
4. ograniczenia przetwarzania (art. 18 RODO),
5. przenoszenia danych (art. 20 RODO); eksport danych Konta w formacie JSON jest dostępny w ustawieniach Konta,
6. sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie (art. 21 RODO).
Aby skorzystać z tych praw, napisz na adres: ${LEGAL_ENTITY.contactEmail}. Odpowiadamy bez zbędnej zwłoki, najpóźniej w ciągu miesiąca.
Masz również prawo wniesienia skargi do organu nadzorczego: Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.`
  },
  {
    id: "dobrowolnosc",
    title: "9. Dobrowolność podania danych",
    content: `Podanie danych jest dobrowolne, ale niezbędne do korzystania z Serwisu:
1. adres e-mail jest konieczny do założenia Konta i logowania oraz do skorzystania z wersji demonstracyjnej,
2. dane nabywcy (nazwa, NIP, adres) są wymagane przepisami prawa do wystawienia faktury VAT za zakup,
3. przesłanie pliku faktury jest konieczne do wykonania usługi tłumaczenia.
Niepodanie tych danych uniemożliwia odpowiednio: założenie Konta, dokonanie zakupu lub wykonanie tłumaczenia.`
  },
  {
    id: "cookies",
    title: "10. Pliki cookies",
    content: `Serwis używa plików cookies w trzech kategoriach:
1. niezbędne: cookies sesji logowania (Supabase Auth), cookies weryfikacji antybotowej (Cloudflare Turnstile) oraz cookie zapamiętujące Twoją decyzję dotyczącą zgód; są zawsze aktywne, ponieważ bez nich Serwis nie może działać, i nie wymagają zgody zgodnie z przepisami ustawy Prawo komunikacji elektronicznej,
2. analityczne: statystyki korzystania z Serwisu w narzędziu PostHog (PostHog EU); uruchamiane wyłącznie po wyrażeniu zgody,
3. marketingowe: cookies usługi Google Ads (Google Ireland Limited), służące do pomiaru skuteczności reklam; uruchamiane wyłącznie po wyrażeniu zgody.
Zgodę można wyrazić lub odmówić jej wyrażenia w banerze cookies wyświetlanym przy pierwszej wizycie. Wybór można zmienić w każdej chwili przez link "Ustawienia cookies" w stopce Serwisu. Wycofanie zgody jest równie łatwe jak jej wyrażenie i nie wpływa na zgodność z prawem przetwarzania dokonanego przed wycofaniem.
Podstawą prawną przetwarzania danych w związku z cookies analitycznymi i marketingowymi jest zgoda (art. 6 ust. 1 lit. a RODO). Dopóki zgoda nie zostanie wyrażona, skrypty analityczne i marketingowe nie są ładowane.
Pliki cookies można też usuwać i blokować w ustawieniach przeglądarki, przy czym zablokowanie cookies niezbędnych uniemożliwi zalogowanie do Serwisu.`
  },
  {
    id: "bezpieczenstwo",
    title: "11. Bezpieczeństwo danych",
    content: `Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka, w szczególności:
1. szyfrowanie danych w transmisji (TLS) i w spoczynku,
2. przechowywanie plików i bazy danych na serwerach w Unii Europejskiej (Frankfurt, region AWS eu-central-1),
3. logowanie bezhasłowe, ograniczające ryzyko wycieku haseł,
4. ograniczenie dostępu do danych do osób upoważnionych,
5. automatyczne usuwanie plików po upływie okresu przechowywania.
W razie naruszenia ochrony danych osobowych, które może powodować wysokie ryzyko naruszenia praw lub wolności, zawiadamiamy osoby, których dane dotyczą, zgodnie z art. 34 RODO, a organ nadzorczy w terminie 72 godzin zgodnie z art. 33 RODO.`
  },
  {
    id: "decyzje-automatyczne",
    title: "12. Zautomatyzowane podejmowanie decyzji",
    content: `Nie podejmujemy wobec użytkowników decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, w tym profilowaniu, które wywoływałyby skutki prawne lub w podobny sposób istotnie na nich wpływały.
Automatyczne tłumaczenie dotyczy treści dokumentów i nie służy ocenie osób fizycznych.`
  },
  {
    id: "zmiany-polityki",
    title: "13. Zmiany polityki prywatności",
    content: `Polityka prywatności może być aktualizowana, w szczególności w razie zmiany zakresu usług, listy podwykonawców lub przepisów prawa.
O istotnych zmianach informujemy użytkowników posiadających Konto wiadomością e-mail oraz publikując nową wersję w Serwisie wraz z datą ostatniej aktualizacji.
Polityka sporządzona jest w języku polskim; angielskie tłumaczenie ma charakter pomocniczy, a wiążąca jest wersja polska. Niniejsza wersja obowiązuje od dnia 2026-06-11.`
  }
];
