import type { LanguageCode } from "@/types/invoice";

export type TranslationNoticeConfig = {
  translationNotice: string;
  footerNotice: string;
};

export type TranslationNoticePlaceholderData = {
  reviewedBy?: string | null;
  generatedAt: string;
  visualisationSystem?: string | null;
};

const DEFAULT_REVIEWED_BY = "User";
export const DEFAULT_VISUALISATION_SYSTEM = "tlumaczksef.pl";
export const POLISH_TRANSLATION_NOTICE = `Informacja o tłumaczeniu

Niniejszy dokument został wygenerowany jako pomocnicze polskie tłumaczenie wizualnego przedstawienia faktury ustrukturyzowanej wystawionej w Krajowym Systemie e-Faktur (KSeF). Tłumaczenie ma na celu wyłącznie ułatwienie odbiorcy zrozumienia treści faktury.

Oryginalną i prawnie wiążącą fakturą jest faktura ustrukturyzowana w formacie XML dostępna w KSeF. Niniejszy przetłumaczony dokument nie stanowi odrębnej faktury, duplikatu faktury, tłumaczenia poświadczonego ani samodzielnego dokumentu księgowego.

Zweryfikowane i zatwierdzone przez: {reviewedBy}
Wygenerowano dnia: {generatedAt}
Źródło: dane faktury ustrukturyzowanej KSeF
System wizualizacji: {visualisationSystem}
Język: polski
Metoda tłumaczenia: tłumaczenie automatyczne zweryfikowane przez użytkownika`;

export const TRANSLATION_NOTICE_BY_LANGUAGE = {
  "en": {
    "translationNotice": "Translation notice\n\nThis document has been generated as an auxiliary English translation of the visual representation of a structured invoice issued in the Polish National e-Invoicing System (KSeF). The translation is intended solely to help the recipient understand the invoice content.\n\nThe original and legally binding invoice is the structured XML invoice available in KSeF. This translated document does not constitute a separate invoice, duplicate invoice, certified translation or independent accounting document.\n\nReviewed and approved by: {reviewedBy}\nGenerated on: {generatedAt}\nSource: KSeF structured invoice data\nVisualisation system: {visualisationSystem}\nLanguage: English\nTranslation method: automatic translation reviewed by user",
    "footerNotice": "Auxiliary English translation only. Reviewed and approved by the user. The original KSeF XML invoice shall prevail."
  },
  "de": {
    "translationNotice": "Hinweis zur Übersetzung\n\nDieses Dokument wurde als unterstützende deutsche Übersetzung der visuellen Darstellung einer strukturierten Rechnung erstellt, die im polnischen Nationalen E-Rechnungssystem (KSeF) ausgestellt wurde. Die Übersetzung dient ausschließlich dazu, dem Empfänger das Verständnis des Rechnungsinhalts zu erleichtern.\n\nDie ursprüngliche und rechtlich verbindliche Rechnung ist die strukturierte XML-Rechnung, die im KSeF verfügbar ist. Dieses übersetzte Dokument stellt keine separate Rechnung, keine Rechnungskopie, keine beglaubigte Übersetzung und kein eigenständiges Buchhaltungsdokument dar.\n\nGeprüft und genehmigt durch: {reviewedBy}\nErstellt am: {generatedAt}\nQuelle: strukturierte KSeF-Rechnungsdaten\nVisualisierungssystem: {visualisationSystem}\nSprache: Deutsch\nÜbersetzungsmethode: automatische Übersetzung, vom Benutzer geprüft",
    "footerNotice": "Nur unterstützende deutsche Übersetzung. Vom Benutzer geprüft und genehmigt. Maßgeblich ist die ursprüngliche KSeF-XML-Rechnung."
  },
  "fr": {
    "translationNotice": "Note relative à la traduction\n\nCe document a été généré en tant que traduction française auxiliaire de la représentation visuelle d’une facture structurée émise dans le Système national polonais de facturation électronique (KSeF). Cette traduction est destinée uniquement à aider le destinataire à comprendre le contenu de la facture.\n\nLa facture originale et juridiquement contraignante est la facture structurée au format XML disponible dans KSeF. Le présent document traduit ne constitue ni une facture distincte, ni un duplicata de facture, ni une traduction certifiée, ni un document comptable autonome.\n\nRévisé et approuvé par : {reviewedBy}\nGénéré le : {generatedAt}\nSource : données de facture structurée KSeF\nSystème de visualisation : {visualisationSystem}\nLangue : français\nMéthode de traduction : traduction automatique révisée par l’utilisateur",
    "footerNotice": "Traduction française auxiliaire uniquement. Révisée et approuvée par l’utilisateur. La facture XML originale KSeF prévaut."
  },
  "es": {
    "translationNotice": "Aviso de traducción\n\nEste documento se ha generado como una traducción auxiliar al español de la representación visual de una factura estructurada emitida en el Sistema Nacional Polaco de Facturación Electrónica (KSeF). La traducción tiene como único fin ayudar al destinatario a comprender el contenido de la factura.\n\nLa factura original y jurídicamente vinculante es la factura estructurada XML disponible en KSeF. Este documento traducido no constituye una factura independiente, un duplicado de factura, una traducción certificada ni un documento contable autónomo.\n\nRevisado y aprobado por: {reviewedBy}\nGenerado el: {generatedAt}\nFuente: datos de factura estructurada KSeF\nSistema de visualización: {visualisationSystem}\nIdioma: español\nMétodo de traducción: traducción automática revisada por el usuario",
    "footerNotice": "Traducción auxiliar al español únicamente. Revisada y aprobada por el usuario. Prevalece la factura XML original de KSeF."
  },
  "it": {
    "translationNotice": "Nota sulla traduzione\n\nIl presente documento è stato generato come traduzione ausiliaria in italiano della rappresentazione visiva di una fattura strutturata emessa nel Sistema nazionale polacco di fatturazione elettronica (KSeF). La traduzione ha il solo scopo di aiutare il destinatario a comprendere il contenuto della fattura.\n\nLa fattura originale e giuridicamente vincolante è la fattura strutturata XML disponibile in KSeF. Il presente documento tradotto non costituisce una fattura separata, un duplicato della fattura, una traduzione certificata né un documento contabile autonomo.\n\nRevisionato e approvato da: {reviewedBy}\nGenerato il: {generatedAt}\nFonte: dati della fattura strutturata KSeF\nSistema di visualizzazione: {visualisationSystem}\nLingua: italiano\nMetodo di traduzione: traduzione automatica revisionata dall’utente",
    "footerNotice": "Solo traduzione ausiliaria in italiano. Revisionata e approvata dall’utente. Prevale la fattura XML originale KSeF."
  },
  "nl": {
    "translationNotice": "Vertaalmelding\n\nDit document is gegenereerd als een ondersteunende Nederlandse vertaling van de visuele weergave van een gestructureerde factuur die is uitgegeven in het Poolse Nationale E-facturatiesysteem (KSeF). De vertaling is uitsluitend bedoeld om de ontvanger te helpen de inhoud van de factuur te begrijpen.\n\nDe originele en juridisch bindende factuur is de gestructureerde XML-factuur die beschikbaar is in KSeF. Dit vertaalde document vormt geen afzonderlijke factuur, geen duplicaatfactuur, geen beëdigde vertaling en geen zelfstandig boekhoudkundig document.\n\nGecontroleerd en goedgekeurd door: {reviewedBy}\nGegenereerd op: {generatedAt}\nBron: gestructureerde KSeF-factuurgegevens\nVisualisatiesysteem: {visualisationSystem}\nTaal: Nederlands\nVertaalmethode: automatische vertaling gecontroleerd door de gebruiker",
    "footerNotice": "Uitsluitend ondersteunende Nederlandse vertaling. Gecontroleerd en goedgekeurd door de gebruiker. De originele KSeF XML-factuur is leidend."
  },
  "pt": {
    "translationNotice": "Aviso de tradução\n\nEste documento foi gerado como uma tradução auxiliar em português da representação visual de uma fatura estruturada emitida no Sistema Nacional Polaco de Faturação Eletrónica (KSeF). A tradução destina-se exclusivamente a ajudar o destinatário a compreender o conteúdo da fatura.\n\nA fatura original e juridicamente vinculativa é a fatura estruturada em XML disponível no KSeF. Este documento traduzido não constitui uma fatura separada, uma segunda via da fatura, uma tradução certificada nem um documento contabilístico autónomo.\n\nRevisto e aprovado por: {reviewedBy}\nGerado em: {generatedAt}\nFonte: dados da fatura estruturada KSeF\nSistema de visualização: {visualisationSystem}\nIdioma: português\nMétodo de tradução: tradução automática revista pelo utilizador",
    "footerNotice": "Apenas tradução auxiliar em português. Revista e aprovada pelo utilizador. A fatura XML original do KSeF prevalece."
  },
  "cs": {
    "translationNotice": "Upozornění k překladu\n\nTento dokument byl vygenerován jako pomocný český překlad vizuálního zobrazení strukturované faktury vystavené v polském Národním systému elektronické fakturace (KSeF). Překlad slouží výhradně k tomu, aby příjemci usnadnil porozumění obsahu faktury.\n\nPůvodní a právně závaznou fakturou je strukturovaná XML faktura dostupná v systému KSeF. Tento přeložený dokument nepředstavuje samostatnou fakturu, duplikát faktury, úředně ověřený překlad ani samostatný účetní doklad.\n\nZkontroloval/a a schválil/a: {reviewedBy}\nVygenerováno dne: {generatedAt}\nZdroj: strukturovaná fakturační data KSeF\nSystém vizualizace: {visualisationSystem}\nJazyk: čeština\nMetoda překladu: automatický překlad zkontrolovaný uživatelem",
    "footerNotice": "Pouze pomocný český překlad. Zkontrolováno a schváleno uživatelem. Rozhodující je původní XML faktura KSeF."
  },
  "sk": {
    "translationNotice": "Upozornenie k prekladu\n\nTento dokument bol vygenerovaný ako pomocný slovenský preklad vizuálneho zobrazenia štruktúrovanej faktúry vystavenej v poľskom Národnom systéme elektronickej fakturácie (KSeF). Preklad slúži výlučne na uľahčenie porozumenia obsahu faktúry príjemcom.\n\nPôvodnou a právne záväznou faktúrou je štruktúrovaná XML faktúra dostupná v systéme KSeF. Tento preložený dokument nepredstavuje samostatnú faktúru, duplikát faktúry, úradne overený preklad ani samostatný účtovný doklad.\n\nSkontroloval/a a schválil/a: {reviewedBy}\nVygenerované dňa: {generatedAt}\nZdroj: štruktúrované fakturačné údaje KSeF\nSystém vizualizácie: {visualisationSystem}\nJazyk: slovenčina\nMetóda prekladu: automatický preklad skontrolovaný používateľom",
    "footerNotice": "Iba pomocný slovenský preklad. Skontrolované a schválené používateľom. Rozhodujúca je pôvodná XML faktúra KSeF."
  },
  "hu": {
    "translationNotice": "Fordítási tájékoztató\n\nEz a dokumentum a Lengyel Nemzeti Elektronikus Számlázási Rendszerben (KSeF) kiállított strukturált számla vizuális megjelenítésének kiegészítő magyar fordításaként készült. A fordítás kizárólag azt a célt szolgálja, hogy segítse a címzettet a számla tartalmának megértésében.\n\nAz eredeti és jogilag kötelező érvényű számla a KSeF-ben elérhető strukturált XML-számla. Ez a lefordított dokumentum nem minősül külön számlának, számlamásolatnak, hiteles fordításnak vagy önálló számviteli dokumentumnak.\n\nEllenőrizte és jóváhagyta: {reviewedBy}\nLétrehozva: {generatedAt}\nForrás: KSeF strukturált számlaadatok\nVizualizációs rendszer: {visualisationSystem}\nNyelv: magyar\nFordítás módja: felhasználó által ellenőrzött automatikus fordítás",
    "footerNotice": "Kizárólag kiegészítő magyar fordítás. A felhasználó ellenőrizte és jóváhagyta. Az eredeti KSeF XML-számla az irányadó."
  },
  "ro": {
    "translationNotice": "Notificare privind traducerea\n\nAcest document a fost generat ca traducere auxiliară în limba română a reprezentării vizuale a unei facturi structurate emise în Sistemul Național Polonez de Facturare Electronică (KSeF). Traducerea este destinată exclusiv să ajute destinatarul să înțeleagă conținutul facturii.\n\nFactura originală și obligatorie din punct de vedere juridic este factura structurată XML disponibilă în KSeF. Acest document tradus nu constituie o factură separată, un duplicat al facturii, o traducere certificată sau un document contabil independent.\n\nRevizuit și aprobat de: {reviewedBy}\nGenerat la: {generatedAt}\nSursă: datele facturii structurate KSeF\nSistem de vizualizare: {visualisationSystem}\nLimbă: română\nMetodă de traducere: traducere automată revizuită de utilizator",
    "footerNotice": "Doar traducere auxiliară în limba română. Revizuită și aprobată de utilizator. Factura XML originală KSeF prevalează."
  },
  "bg": {
    "translationNotice": "Уведомление относно превода\n\nТози документ е генериран като помощен превод на български език на визуалното представяне на структурирана фактура, издадена в Полската национална система за електронно фактуриране (KSeF). Преводът има за цел единствено да помогне на получателя да разбере съдържанието на фактурата.\n\nОригиналната и правно обвързваща фактура е структурираната XML фактура, налична в KSeF. Настоящият преведен документ не представлява отделна фактура, дубликат на фактура, заверен превод или самостоятелен счетоводен документ.\n\nПрегледано и одобрено от: {reviewedBy}\nГенерирано на: {generatedAt}\nИзточник: структурирани данни на фактура KSeF\nСистема за визуализация: {visualisationSystem}\nЕзик: български\nМетод на превод: автоматичен превод, прегледан от потребителя",
    "footerNotice": "Само помощен превод на български език. Прегледано и одобрено от потребителя. Оригиналната XML фактура KSeF има предимство."
  },
  "hr": {
    "translationNotice": "Obavijest o prijevodu\n\nOvaj je dokument generiran kao pomoćni prijevod na hrvatski jezik vizualnog prikaza strukturiranog računa izdanog u Poljskom nacionalnom sustavu za elektroničko izdavanje računa (KSeF). Prijevod je namijenjen isključivo tome da primatelju olakša razumijevanje sadržaja računa.\n\nIzvorni i pravno obvezujući račun jest strukturirani XML račun dostupan u sustavu KSeF. Ovaj prevedeni dokument ne predstavlja zaseban račun, duplikat računa, ovjereni prijevod ni samostalan računovodstveni dokument.\n\nPregledao/la i odobrio/la: {reviewedBy}\nGenerirano dana: {generatedAt}\nIzvor: strukturirani podaci računa KSeF\nSustav vizualizacije: {visualisationSystem}\nJezik: hrvatski\nMetoda prijevoda: automatski prijevod koji je pregledao korisnik",
    "footerNotice": "Samo pomoćni prijevod na hrvatski jezik. Pregledao i odobrio korisnik. Izvorni KSeF XML račun ima prednost."
  },
  "sl": {
    "translationNotice": "Obvestilo o prevodu\n\nTa dokument je bil ustvarjen kot pomožni slovenski prevod vizualnega prikaza strukturiranega računa, izdanega v poljskem Nacionalnem sistemu za elektronsko izdajanje računov (KSeF). Prevod je namenjen izključno temu, da prejemniku olajša razumevanje vsebine računa.\n\nIzvirni in pravno zavezujoči račun je strukturirani XML račun, ki je na voljo v sistemu KSeF. Ta prevedeni dokument ne predstavlja ločenega računa, dvojnika računa, overjenega prevoda ali samostojnega računovodskega dokumenta.\n\nPregledal/a in odobril/a: {reviewedBy}\nUstvarjeno dne: {generatedAt}\nVir: strukturirani podatki računa KSeF\nSistem za vizualizacijo: {visualisationSystem}\nJezik: slovenščina\nNačin prevoda: samodejni prevod, ki ga je pregledal uporabnik",
    "footerNotice": "Samo pomožni slovenski prevod. Pregledal in odobril uporabnik. Izvirni XML račun KSeF prevlada."
  },
  "lt": {
    "translationNotice": "Pranešimas apie vertimą\n\nŠis dokumentas buvo sugeneruotas kaip pagalbinis lietuviškas struktūrizuotos sąskaitos faktūros, išrašytos Lenkijos nacionalinėje elektroninių sąskaitų sistemoje (KSeF), vizualinio atvaizdavimo vertimas. Vertimas skirtas tik padėti gavėjui suprasti sąskaitos faktūros turinį.\n\nOriginali ir teisiškai privaloma sąskaita faktūra yra struktūrizuota XML sąskaita faktūra, prieinama KSeF sistemoje. Šis išverstas dokumentas nėra atskira sąskaita faktūra, sąskaitos faktūros dublikatas, patvirtintas vertimas ar savarankiškas apskaitos dokumentas.\n\nPeržiūrėjo ir patvirtino: {reviewedBy}\nSugeneruota: {generatedAt}\nŠaltinis: KSeF struktūrizuoti sąskaitos faktūros duomenys\nVizualizavimo sistema: {visualisationSystem}\nKalba: lietuvių\nVertimo metodas: automatinis vertimas, peržiūrėtas naudotojo",
    "footerNotice": "Tik pagalbinis lietuviškas vertimas. Peržiūrėta ir patvirtinta naudotojo. Viršenybę turi originali KSeF XML sąskaita faktūra."
  },
  "lv": {
    "translationNotice": "Paziņojums par tulkojumu\n\nŠis dokuments ir ģenerēts kā strukturēta rēķina, kas izsniegts Polijas Nacionālajā elektronisko rēķinu sistēmā (KSeF), vizuālā attēlojuma palīgtulkojums latviešu valodā. Tulkojums ir paredzēts tikai tam, lai palīdzētu saņēmējam saprast rēķina saturu.\n\nOriģinālais un juridiski saistošais rēķins ir strukturētais XML rēķins, kas pieejams KSeF sistēmā. Šis tulkotais dokuments nav atsevišķs rēķins, rēķina dublikāts, apliecināts tulkojums vai patstāvīgs grāmatvedības dokuments.\n\nPārskatīja un apstiprināja: {reviewedBy}\nĢenerēts: {generatedAt}\nAvots: KSeF strukturētie rēķina dati\nVizualizācijas sistēma: {visualisationSystem}\nValoda: latviešu\nTulkošanas metode: automātisks tulkojums, ko pārskatījis lietotājs",
    "footerNotice": "Tikai palīgtulkojums latviešu valodā. Lietotājs to ir pārskatījis un apstiprinājis. Noteicošais ir oriģinālais KSeF XML rēķins."
  },
  "et": {
    "translationNotice": "Tõlketeade\n\nSee dokument on loodud Poola riiklikus e-arvete süsteemis (KSeF) väljastatud struktureeritud arve visuaalse esituse abistava eestikeelse tõlkena. Tõlge on mõeldud üksnes selleks, et aidata saajal arve sisust aru saada.\n\nAlgne ja õiguslikult siduv arve on KSeF-is kättesaadav struktureeritud XML-arve. Käesolev tõlgitud dokument ei ole eraldi arve, arve duplikaat, kinnitatud tõlge ega iseseisev raamatupidamisdokument.\n\nÜle vaadanud ja kinnitanud: {reviewedBy}\nLoodud: {generatedAt}\nAllikas: KSeF struktureeritud arveandmed\nVisualiseerimissüsteem: {visualisationSystem}\nKeel: eesti\nTõlkemeetod: automaattõlge, mille kasutaja on üle vaadanud",
    "footerNotice": "Ainult abistav eestikeelne tõlge. Kasutaja on selle üle vaadanud ja kinnitanud. Ülimuslik on algne KSeF XML-arve."
  },
  "da": {
    "translationNotice": "Meddelelse om oversættelse\n\nDette dokument er genereret som en supplerende dansk oversættelse af den visuelle gengivelse af en struktureret faktura udstedt i det polske nationale e-faktureringssystem (KSeF). Oversættelsen har udelukkende til formål at hjælpe modtageren med at forstå fakturaens indhold.\n\nDen originale og juridisk bindende faktura er den strukturerede XML-faktura, der er tilgængelig i KSeF. Dette oversatte dokument udgør ikke en separat faktura, en fakturakopi, en certificeret oversættelse eller et selvstændigt regnskabsdokument.\n\nGennemgået og godkendt af: {reviewedBy}\nGenereret den: {generatedAt}\nKilde: KSeF-strukturerede fakturadata\nVisualiseringssystem: {visualisationSystem}\nSprog: dansk\nOversættelsesmetode: automatisk oversættelse gennemgået af brugeren",
    "footerNotice": "Kun supplerende dansk oversættelse. Gennemgået og godkendt af brugeren. Den originale KSeF XML-faktura har forrang."
  },
  "sv": {
    "translationNotice": "Meddelande om översättning\n\nDetta dokument har genererats som en kompletterande svensk översättning av den visuella återgivningen av en strukturerad faktura utfärdad i Polens nationella e-faktureringssystem (KSeF). Översättningen är endast avsedd att hjälpa mottagaren att förstå fakturans innehåll.\n\nDen ursprungliga och juridiskt bindande fakturan är den strukturerade XML-faktura som finns tillgänglig i KSeF. Detta översatta dokument utgör inte en separat faktura, en fakturadubblett, en auktoriserad översättning eller ett fristående bokföringsdokument.\n\nGranskad och godkänd av: {reviewedBy}\nGenererad den: {generatedAt}\nKälla: KSeF-strukturerade fakturauppgifter\nVisualiseringssystem: {visualisationSystem}\nSpråk: svenska\nÖversättningsmetod: automatisk översättning granskad av användaren",
    "footerNotice": "Endast kompletterande svensk översättning. Granskad och godkänd av användaren. Den ursprungliga KSeF XML-fakturan gäller."
  },
  "fi": {
    "translationNotice": "Käännösilmoitus\n\nTämä asiakirja on luotu avustavana suomenkielisenä käännöksenä Puolan kansallisessa sähköisessä laskutusjärjestelmässä (KSeF) annetun rakenteisen laskun visuaalisesta esityksestä. Käännöksen tarkoituksena on ainoastaan auttaa vastaanottajaa ymmärtämään laskun sisältö.\n\nAlkuperäinen ja oikeudellisesti sitova lasku on KSeF-järjestelmässä saatavilla oleva rakenteinen XML-lasku. Tämä käännetty asiakirja ei ole erillinen lasku, laskun kaksoiskappale, virallinen käännös eikä itsenäinen kirjanpitoasiakirja.\n\nTarkistanut ja hyväksynyt: {reviewedBy}\nLuotu: {generatedAt}\nLähde: KSeF:n rakenteiset laskutiedot\nVisualisointijärjestelmä: {visualisationSystem}\nKieli: suomi\nKäännösmenetelmä: käyttäjän tarkistama automaattinen käännös",
    "footerNotice": "Vain avustava suomenkielinen käännös. Käyttäjä on tarkistanut ja hyväksynyt sen. Alkuperäinen KSeF XML-lasku on ensisijainen."
  },
  "no": {
    "translationNotice": "Merknad om oversettelse\n\nDette dokumentet er generert som en supplerende norsk oversettelse av den visuelle fremstillingen av en strukturert faktura utstedt i det polske nasjonale e-faktureringssystemet (KSeF). Oversettelsen er kun ment å hjelpe mottakeren med å forstå fakturainnholdet.\n\nDen opprinnelige og juridisk bindende fakturaen er den strukturerte XML-fakturaen som er tilgjengelig i KSeF. Dette oversatte dokumentet utgjør ikke en separat faktura, en fakturakopi, en sertifisert oversettelse eller et selvstendig regnskapsdokument.\n\nGjennomgått og godkjent av: {reviewedBy}\nGenerert den: {generatedAt}\nKilde: KSeF-strukturerte fakturadata\nVisualiseringssystem: {visualisationSystem}\nSpråk: norsk\nOversettelsesmetode: automatisk oversettelse gjennomgått av brukeren",
    "footerNotice": "Kun supplerende norsk oversettelse. Gjennomgått og godkjent av brukeren. Den opprinnelige KSeF XML-fakturaen gjelder."
  },
  "el": {
    "translationNotice": "Σημείωση μετάφρασης\n\nΤο παρόν έγγραφο δημιουργήθηκε ως βοηθητική ελληνική μετάφραση της οπτικής απεικόνισης ενός δομημένου τιμολογίου που εκδόθηκε στο Πολωνικό Εθνικό Σύστημα Ηλεκτρονικής Τιμολόγησης (KSeF). Η μετάφραση προορίζεται αποκλειστικά για να βοηθήσει τον παραλήπτη να κατανοήσει το περιεχόμενο του τιμολογίου.\n\nΤο πρωτότυπο και νομικά δεσμευτικό τιμολόγιο είναι το δομημένο τιμολόγιο XML που είναι διαθέσιμο στο KSeF. Το παρόν μεταφρασμένο έγγραφο δεν αποτελεί ξεχωριστό τιμολόγιο, αντίγραφο τιμολογίου, πιστοποιημένη μετάφραση ή αυτοτελές λογιστικό έγγραφο.\n\nΕλέγχθηκε και εγκρίθηκε από: {reviewedBy}\nΔημιουργήθηκε στις: {generatedAt}\nΠηγή: δομημένα δεδομένα τιμολογίου KSeF\nΣύστημα οπτικοποίησης: {visualisationSystem}\nΓλώσσα: ελληνικά\nΜέθοδος μετάφρασης: αυτόματη μετάφραση που ελέγχθηκε από τον χρήστη",
    "footerNotice": "Μόνο βοηθητική ελληνική μετάφραση. Ελέγχθηκε και εγκρίθηκε από τον χρήστη. Υπερισχύει το πρωτότυπο τιμολόγιο XML του KSeF."
  }
} as const satisfies Record<LanguageCode, TranslationNoticeConfig>;

export function getTranslationNoticeConfig(language: string): TranslationNoticeConfig {
  return TRANSLATION_NOTICE_BY_LANGUAGE[isNoticeLanguage(language) ? language : "en"];
}

export function fillTranslationNoticePlaceholders(text: string, data: TranslationNoticePlaceholderData) {
  const reviewedBy = data.reviewedBy?.trim() || DEFAULT_REVIEWED_BY;
  const visualisationSystem = data.visualisationSystem?.trim() || DEFAULT_VISUALISATION_SYSTEM;

  return text
    .replaceAll("{reviewedBy}", reviewedBy)
    .replaceAll("{generatedAt}", data.generatedAt)
    .replaceAll("{visualisationSystem}", visualisationSystem);
}

export function createTranslationNotices(language: string, data: TranslationNoticePlaceholderData): TranslationNoticeConfig {
  const config = getTranslationNoticeConfig(language);
  const targetNotice = fillTranslationNoticePlaceholders(config.translationNotice, data);
  const polishNotice = fillTranslationNoticePlaceholders(POLISH_TRANSLATION_NOTICE, data);
  return {
    translationNotice: `${targetNotice}\n\n${polishNotice}`,
    footerNotice: fillTranslationNoticePlaceholders(createFooterNotice(config), data)
  };
}

function isNoticeLanguage(language: string): language is LanguageCode {
  return language in TRANSLATION_NOTICE_BY_LANGUAGE;
}

function createFooterNotice(config: TranslationNoticeConfig) {
  const approvalLine = config.translationNotice
    .split("\n")
    .find((line) => line.includes("{reviewedBy}"))
    ?.trim();
  if (!approvalLine) return config.footerNotice;

  const sentences = config.footerNotice.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) ?? [];
  if (sentences.length < 2) {
    return `${config.footerNotice.trim()} ${approvalLine}.`;
  }

  return [sentences[0], `${approvalLine}.`, ...sentences.slice(2)].join(" ");
}
