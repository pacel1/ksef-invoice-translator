import type { LegalSection } from "@/components/marketing/legal-doc-layout";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { FOUNDER } from "@/lib/brand/founder";

/**
 * Regulamin (PL). Binding version of the terms of service.
 * Operator identity and contact come from lib/brand so the
 * REPLACE_BEFORE_LAUNCH swap happens in one place.
 */
export const TERMS_SECTIONS_PL: ReadonlyArray<LegalSection> = [
  {
    id: "postanowienia-ogolne",
    title: "§ 1. Postanowienia ogólne",
    content: `1. Niniejszy Regulamin określa zasady świadczenia usług drogą elektroniczną za pośrednictwem serwisu internetowego tlumaczksef.pl (dalej: Serwis), zgodnie z art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.
2. Usługodawcą i operatorem Serwisu jest ${LEGAL_ENTITY.name}, NIP: ${LEGAL_ENTITY.nip}, REGON: ${LEGAL_ENTITY.regon}, adres: ${LEGAL_ENTITY.address} (dalej: Usługodawca).
3. Kontakt z Usługodawcą jest możliwy pod adresem e-mail: ${FOUNDER.contactEmail}.
4. Regulamin jest udostępniany nieodpłatnie w Serwisie przed zawarciem umowy, w formie umożliwiającej jego pozyskanie, odtwarzanie, utrwalanie i wydrukowanie.
5. Zasady przetwarzania danych osobowych opisuje Polityka Prywatności dostępna w Serwisie. Polityka Prywatności stanowi odrębny dokument informacyjny.`
  },
  {
    id: "definicje",
    title: "§ 2. Definicje",
    content: `Na potrzeby Regulaminu przyjmuje się następujące znaczenie pojęć:
1. Serwis: serwis internetowy dostępny pod adresem tlumaczksef.pl wraz z podstronami.
2. Użytkownik: osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna lub jednostka organizacyjna posiadająca zdolność prawną, korzystająca z Serwisu.
3. Konsument: Użytkownik będący osobą fizyczną, korzystający z Serwisu w celach niezwiązanych bezpośrednio z działalnością gospodarczą lub zawodową.
4. Przedsiębiorca na prawach konsumenta: osoba fizyczna zawierająca umowę bezpośrednio związaną z jej działalnością gospodarczą, gdy z treści umowy wynika, że nie ma ona dla niej charakteru zawodowego.
5. Konto: zbiór zasobów w Serwisie przypisany do adresu e-mail Użytkownika, tworzony przy pierwszym zalogowaniu.
6. Faktura źródłowa: ustrukturyzowana faktura w formacie XML zgodnym ze schematem FA(3) Ministerstwa Finansów, wystawiona lub otrzymana w Krajowym Systemie e-Faktur (KSeF), przesłana przez Użytkownika do Serwisu.
7. Tłumaczenie: wygenerowany przez Serwis dokument PDF zawierający treść Faktury źródłowej przetłumaczoną na wybrany język, w tym w wersji dwujęzycznej.
8. Kredyt: jednostka rozliczeniowa uprawniająca do wykonania jednego Tłumaczenia.
9. Pakiet: zestaw Kredytów nabywany odpłatnie zgodnie z cennikiem dostępnym w Serwisie.
10. Cennik: informacja o aktualnych cenach Pakietów dostępna w Serwisie na stronie z cennikiem.`
  },
  {
    id: "rodzaje-uslug",
    title: "§ 3. Rodzaje i zakres usług",
    content: `1. Usługodawca świadczy drogą elektroniczną następujące usługi:
a) automatyczne tłumaczenie treści Faktur źródłowych na wybrane języki obce wraz z generowaniem dokumentu PDF, w tym w wersji dwujęzycznej (język polski i język docelowy), z zachowaniem kodu QR KSeF,
b) prowadzenie Konta, w tym historii Tłumaczeń i salda Kredytów,
c) przechowywanie Faktur źródłowych i Tłumaczeń przez 30 dni,
d) eksport danych Konta w formacie JSON,
e) bezpłatną wersję demonstracyjną dostępną bez zakładania Konta, wymagającą jednorazowej weryfikacji adresu e-mail.
2. Serwis przyjmuje wyłącznie pliki XML zgodne ze schematem FA(3). Serwis nie przetwarza plików PDF ani innych formatów jako danych wejściowych.
3. Serwis nie łączy się z kontem Użytkownika w KSeF i nie pobiera faktur z KSeF w imieniu Użytkownika. Użytkownik samodzielnie dostarcza pliki XML do Serwisu.
4. Układ pól wygenerowanego PDF odpowiada schematowi FA(3) Ministerstwa Finansów w wersji 2025-06-25, a kod QR KSeF z Faktury źródłowej zostaje zachowany.`
  },
  {
    id: "wymagania-techniczne",
    title: "§ 4. Wymagania techniczne",
    content: `1. Do korzystania z Serwisu niezbędne są:
a) urządzenie z dostępem do internetu,
b) aktualna wersja przeglądarki internetowej z włączoną obsługą JavaScript i plików cookies,
c) aktywny adres e-mail.
2. Logowanie do Serwisu odbywa się bez hasła, poprzez jednorazowy link wysyłany na adres e-mail Użytkownika. Link logowania jest ważny 60 minut i może zostać użyty tylko raz.
3. Usługodawca dokłada starań, aby Serwis działał poprawnie w aktualnych wersjach popularnych przeglądarek. Usługodawca nie gwarantuje poprawnego działania w przeglądarkach przestarzałych lub niestandardowych.`
  },
  {
    id: "konto",
    title: "§ 5. Konto i zawarcie umowy",
    content: `1. Umowa o świadczenie usług drogą elektroniczną w zakresie prowadzenia Konta zostaje zawarta z chwilą pierwszego zalogowania do Serwisu, co jest równoznaczne z założeniem Konta.
2. Warunkiem założenia Konta jest akceptacja Regulaminu oraz zapoznanie się z Polityką Prywatności. Informacja o tym jest wyświetlana na stronie logowania wraz z odnośnikami do obu dokumentów.
3. Umowa o prowadzenie Konta jest zawierana na czas nieoznaczony. Prowadzenie Konta jest bezpłatne.
4. Jedno Konto jest przypisane do jednego adresu e-mail. Użytkownik zobowiązany jest do nieudostępniania dostępu do swojej skrzynki e-mail osobom nieuprawnionym, ponieważ dostęp do skrzynki umożliwia zalogowanie do Konta.
5. Użytkownik zobowiązany jest do podawania danych prawdziwych i aktualnych.`
  },
  {
    id: "cennik",
    title: "§ 6. Bezpłatny limit i Pakiety",
    content: `1. Każdemu Użytkownikowi posiadającemu Konto przysługuje jedno bezpłatne Tłumaczenie w każdym miesiącu kalendarzowym. Niewykorzystany bezpłatny limit nie przechodzi na kolejny miesiąc.
2. Dalsze Tłumaczenia wykonywane są w ramach odpłatnych Pakietów Kredytów. Ceny Pakietów określa Cennik. Ceny podane są w kwotach netto; do ceny doliczany jest podatek VAT w stawce 23%.
3. Kredyty nabyte w ramach Pakietów nie tracą ważności i sumują się przy kolejnych zakupach.
4. Kredyt jest zużywany wyłącznie po pomyślnym wykonaniu Tłumaczenia. Jeżeli Tłumaczenie nie powiedzie się z przyczyn leżących po stronie Serwisu, Kredyt nie zostaje zużyty.
5. Zmiany Cennika nie wpływają na Pakiety już opłacone.`
  },
  {
    id: "platnosci",
    title: "§ 7. Płatności i faktury",
    content: `1. Płatności za Pakiety obsługuje zewnętrzny operator płatności Stripe (Stripe Payments Europe, Ltd. z siedzibą w Irlandii). Usługodawca nie przechowuje danych kart płatniczych.
2. Umowa o dostarczenie Pakietu zostaje zawarta z chwilą potwierdzenia płatności przez operatora płatności. Kredyty są dopisywane do Konta niezwłocznie po potwierdzeniu płatności.
3. Za każdy zakup Pakietu wystawiana jest faktura VAT. Faktura jest wystawiana w formie elektronicznej, przesyłana do Krajowego Systemu e-Faktur oraz udostępniana Użytkownikowi poprzez link wysyłany na adres e-mail. Akceptując Regulamin Użytkownik wyraża zgodę na otrzymywanie faktur w formie elektronicznej.
4. W celu wystawienia faktury Użytkownik podaje dane nabywcy: nazwę, NIP oraz adres. Użytkownik odpowiada za poprawność tych danych.`
  },
  {
    id: "charakter-tlumaczen",
    title: "§ 8. Charakter Tłumaczeń i zastrzeżenia",
    content: `1. Tłumaczenia są wykonywane automatycznie, z wykorzystaniem modeli sztucznej inteligencji dostarczanych przez OpenAI, oraz słowników pojęć zgodnych ze schematem FA(3).
2. Tłumaczenie jest dokumentem pomocniczym o charakterze informacyjnym. Tłumaczenie nie jest tłumaczeniem przysięgłym ani uwierzytelnionym i nie zastępuje go tam, gdzie przepisy wymagają tłumaczenia przysięgłego.
3. Tłumaczenie nie modyfikuje Faktury źródłowej wystawionej w KSeF. Dokumentem księgowym pozostaje wyłącznie oryginalna faktura ustrukturyzowana w KSeF.
4. Usługa nie stanowi doradztwa podatkowego, prawnego ani księgowego.
5. Użytkownik zobowiązany jest zweryfikować poprawność Tłumaczenia przed jego użyciem w obrocie, w szczególności przed przekazaniem kontrahentowi. Tłumaczenia automatyczne mogą zawierać błędy lub nieścisłości.
6. Serwis umożliwia ręczną edycję wybranych pól Tłumaczenia przed wygenerowaniem ostatecznego PDF. Za treść wprowadzonych zmian odpowiada Użytkownik.`
  },
  {
    id: "obowiazki",
    title: "§ 9. Obowiązki Użytkownika i zakaz treści bezprawnych",
    content: `1. Zakazane jest dostarczanie przez Użytkownika treści o charakterze bezprawnym.
2. Użytkownik może przesyłać do Serwisu wyłącznie faktury, do których przetwarzania jest uprawniony, w szczególności faktury własne lub otrzymane w ramach prowadzonej działalności.
3. Zakazane są działania mogące zakłócić działanie Serwisu, w tym: próby nieuprawnionego dostępu, automatyczne masowe pobieranie treści, obchodzenie limitów wersji demonstracyjnej lub bezpłatnego limitu, a także wykorzystywanie Serwisu do przetwarzania danych w sposób naruszający prawa osób trzecich.
4. W przypadku istotnego naruszenia Regulaminu Usługodawca może zawiesić lub zablokować Konto, po uprzednim wezwaniu Użytkownika do zaniechania naruszeń, chyba że charakter naruszenia wymaga natychmiastowej reakcji. Użytkownik może odwołać się od decyzji, pisząc na adres e-mail wskazany w § 1.`
  },
  {
    id: "reklamacje",
    title: "§ 10. Reklamacje",
    content: `1. Reklamacje dotyczące działania Serwisu, w tym jakości Tłumaczeń i rozliczeń, można składać na adres e-mail: ${FOUNDER.contactEmail}.
2. Reklamacja powinna zawierać: adres e-mail przypisany do Konta, opis problemu oraz, w miarę możliwości, datę zdarzenia i identyfikator Tłumaczenia, którego dotyczy.
3. Usługodawca rozpatruje reklamacje w terminie 14 dni od dnia ich otrzymania i udziela odpowiedzi na adres e-mail, z którego wysłano reklamację.
4. W odniesieniu do Konsumentów oraz Przedsiębiorców na prawach konsumenta do odpowiedzialności za zgodność usługi cyfrowej z umową stosuje się przepisy rozdziału 5b ustawy z dnia 30 maja 2014 r. o prawach konsumenta. W przypadku niezgodności usługi z umową Użytkownik może żądać doprowadzenia do zgodności, a w dalszej kolejności złożyć oświadczenie o obniżeniu ceny albo odstąpieniu od umowy.`
  },
  {
    id: "odstapienie",
    title: "§ 11. Odstąpienie od umowy i zwroty",
    content: `1. Konsument oraz Przedsiębiorca na prawach konsumenta może odstąpić od umowy o dostarczenie Pakietu w terminie 14 dni od dnia jej zawarcia, bez podania przyczyny. Do zachowania terminu wystarczy wysłanie oświadczenia przed jego upływem na adres e-mail wskazany w § 1.
2. Rozpoczęcie korzystania z Kredytów przed upływem terminu odstąpienia nie pozbawia prawa odstąpienia. W takim przypadku zwracana kwota zostaje pomniejszona proporcjonalnie o wartość Kredytów wykorzystanych do chwili złożenia oświadczenia.
3. Niezależnie od uprawnień ustawowych, każdy Użytkownik, w tym przedsiębiorca, może w terminie 14 dni od zakupu Pakietu zażądać zwrotu części ceny proporcjonalnej do liczby niewykorzystanych Kredytów.
4. Zwrot następuje w terminie 14 dni od otrzymania oświadczenia, przy użyciu tej samej metody płatności, którą opłacono zakup, chyba że Użytkownik wyraźnie zgodzi się na inną metodę.
5. Oświadczenie o odstąpieniu można złożyć w dowolnej formie, na przykład: "Odstępuję od umowy o dostarczenie Pakietu zakupionego dnia [data]. Adres e-mail Konta: [adres]". Można także skorzystać z wzoru stanowiącego załącznik nr 2 do ustawy o prawach konsumenta.
6. Umowę o prowadzenie bezpłatnego Konta Użytkownik może rozwiązać w każdym czasie zgodnie z § 12, co obejmuje także uprawnienie Konsumenta do odstąpienia od tej umowy w terminie 14 dni od jej zawarcia.`
  },
  {
    id: "rozwiazanie",
    title: "§ 12. Czas trwania i rozwiązanie umowy",
    content: `1. Użytkownik może w każdej chwili, bez podania przyczyny, rozwiązać umowę o prowadzenie Konta poprzez usunięcie Konta w ustawieniach Serwisu albo poprzez wysłanie żądania na adres e-mail wskazany w § 1.
2. Usunięcie Konta powoduje trwałe usunięcie danych zgodnie z Polityką Prywatności, w tym przepadek niewykorzystanego bezpłatnego limitu. Jeżeli na Koncie pozostają niewykorzystane Kredyty z Pakietu zakupionego w ciągu ostatnich 14 dni, przed usunięciem Konta Użytkownik może skorzystać ze zwrotu zgodnie z § 11. Usunięcie Konta z pozostałymi Kredytami po tym terminie oznacza rezygnację z ich wykorzystania.
3. Usługodawca może wypowiedzieć umowę o prowadzenie Konta z ważnych przyczyn, takich jak: zakończenie działalności Serwisu, zmiana przepisów uniemożliwiająca dalsze świadczenie usług albo istotne naruszenie Regulaminu przez Użytkownika, z zachowaniem 14-dniowego okresu wypowiedzenia przesłanego na adres e-mail Użytkownika.
4. W przypadku wypowiedzenia umowy przez Usługodawcę z przyczyn nieleżących po stronie Użytkownika, Użytkownikowi przysługuje zwrot ceny proporcjonalnej do niewykorzystanych Kredytów, niezależnie od daty ich zakupu.`
  },
  {
    id: "odpowiedzialnosc",
    title: "§ 13. Odpowiedzialność",
    content: `1. Usługodawca świadczy usługi z należytą starannością, nie gwarantuje jednak nieprzerwanej dostępności Serwisu. O planowanych przerwach technicznych Usługodawca informuje z wyprzedzeniem, jeżeli jest to możliwe.
2. Usługodawca nie odpowiada za treść Faktur źródłowych dostarczanych przez Użytkownika ani za skutki użycia Tłumaczenia, którego Użytkownik nie zweryfikował zgodnie z § 8 ust. 5.
3. Wobec Użytkowników niebędących Konsumentami ani Przedsiębiorcami na prawach konsumenta odpowiedzialność Usługodawcy jest ograniczona do wysokości kwoty zapłaconej przez Użytkownika za usługi w okresie 12 miesięcy poprzedzających zdarzenie wywołujące szkodę i nie obejmuje utraconych korzyści.
4. Ograniczenia odpowiedzialności nie mają zastosowania do Konsumentów i Przedsiębiorców na prawach konsumenta w zakresie, w jakim przepisy prawa nie pozwalają na takie ograniczenie, ani do szkód wyrządzonych umyślnie.`
  },
  {
    id: "dane-osobowe",
    title: "§ 14. Dane osobowe i powierzenie przetwarzania",
    content: `1. Administratorem danych osobowych Użytkownika (adres e-mail, dane rozliczeniowe, dane techniczne) jest Usługodawca. Szczegółowe informacje zawiera Polityka Prywatności.
2. Faktury źródłowe mogą zawierać dane osobowe osób trzecich, w szczególności kontrahentów Użytkownika (nazwy, numery NIP, adresy, numery rachunków bankowych). W odniesieniu do tych danych administratorem pozostaje Użytkownik, a Usługodawca działa jako podmiot przetwarzający w rozumieniu art. 28 RODO.
3. Z chwilą akceptacji Regulaminu Użytkownik powierza Usługodawcy przetwarzanie danych osobowych zawartych w Fakturach źródłowych wyłącznie w celu i w zakresie niezbędnym do wykonania usług opisanych w § 3, na czas przechowywania plików określony w § 3 ust. 1 lit. c.
4. Usługodawca zobowiązuje się: przetwarzać powierzone dane wyłącznie na udokumentowane polecenie Użytkownika wynikające z Regulaminu, zapewnić poufność osobom upoważnionym, stosować odpowiednie środki techniczne i organizacyjne (w tym szyfrowanie w transmisji i w spoczynku oraz przechowywanie danych na serwerach na terenie Unii Europejskiej), wspierać Użytkownika w realizacji obowiązków z art. 32-36 RODO oraz usunąć powierzone dane po upływie okresu przechowywania.
5. Użytkownik wyraża ogólną zgodę na dalsze powierzenie przetwarzania podwykonawcom wskazanym w Polityce Prywatności (w szczególności: Supabase, Vercel, OpenAI, Stripe, Resend, iFirma, Cloudflare). O zamiarze zmiany listy podwykonawców Usługodawca informuje z wyprzedzeniem, umożliwiając zgłoszenie sprzeciwu.
6. Usługodawca nie wykorzystuje treści Faktur źródłowych ani Tłumaczeń do trenowania modeli sztucznej inteligencji i nie udostępnia ich osobom trzecim poza podwykonawcami niezbędnymi do wykonania usługi.`
  },
  {
    id: "zmiany",
    title: "§ 15. Zmiany Regulaminu",
    content: `1. Usługodawca może zmienić Regulamin z ważnych przyczyn, takich jak: zmiana przepisów prawa, zmiana zakresu lub sposobu świadczenia usług, względy bezpieczeństwa albo konieczność doprecyzowania postanowień.
2. O zmianie Regulaminu Usługodawca informuje Użytkowników posiadających Konto co najmniej 14 dni przed wejściem zmian w życie, wysyłając wiadomość na adres e-mail przypisany do Konta oraz publikując nową wersję w Serwisie.
3. Użytkownik, który nie akceptuje zmian, może rozwiązać umowę zgodnie z § 12 przed dniem wejścia zmian w życie. Korzystanie z Serwisu po tym dniu oznacza akceptację nowej wersji Regulaminu.
4. Zmiany Regulaminu nie naruszają praw nabytych, w szczególności nie wpływają na Kredyty już opłacone.`
  },
  {
    id: "postanowienia-koncowe",
    title: "§ 16. Postanowienia końcowe",
    content: `1. Prawem właściwym dla umów zawieranych na podstawie Regulaminu jest prawo polskie. Wybór prawa nie pozbawia Konsumenta ochrony wynikającej z bezwzględnie obowiązujących przepisów państwa jego zwykłego pobytu.
2. Spory z Użytkownikami niebędącymi Konsumentami rozstrzyga sąd właściwy dla siedziby Usługodawcy. Spory z Konsumentami rozstrzyga sąd właściwy według przepisów ogólnych.
3. Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w tym z pomocy powiatowego (miejskiego) rzecznika konsumentów lub wojewódzkiego inspektora Inspekcji Handlowej. Szczegółowe informacje dostępne są na stronie internetowej Urzędu Ochrony Konkurencji i Konsumentów: uokik.gov.pl.
4. Jeżeli poszczególne postanowienia Regulaminu okażą się nieważne lub bezskuteczne, pozostałe postanowienia pozostają w mocy.
5. Regulamin sporządzono w języku polskim. Angielskie tłumaczenie Regulaminu udostępniane w Serwisie ma charakter pomocniczy; wiążąca jest wersja polska.
6. Regulamin obowiązuje od dnia 2026-06-11.`
  }
];
