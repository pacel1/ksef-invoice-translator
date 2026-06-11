import type { ConsentLocale } from "./types";

interface CategoryCopy {
  label: string;
  description: string;
}

export interface ConsentCopy {
  banner: {
    ariaLabel: string;
    body: string;
    acceptAll: string;
    rejectAll: string;
    settings: string;
    privacyPrefix: string;
    privacyLinkLabel: string;
    privacySuffix: string;
  };
  modal: {
    title: string;
    description: string;
    save: string;
    acceptAll: string;
    rejectAll: string;
    close: string;
    alwaysOn: string;
    categories: {
      necessary: CategoryCopy;
      analytics: CategoryCopy;
      marketing: CategoryCopy;
    };
  };
  footerLink: string;
}

export const consentCopy: Record<ConsentLocale, ConsentCopy> = {
  pl: {
    banner: {
      ariaLabel: "Zgoda na pliki cookies",
      body: "Używamy plików cookies, aby serwis działał poprawnie, a za Twoją zgodą także do anonimowych statystyk i pomiaru skuteczności reklam.",
      acceptAll: "Akceptuję wszystkie",
      rejectAll: "Odrzucam wszystkie",
      settings: "Ustawienia",
      privacyPrefix: "Szczegóły znajdziesz w ",
      privacyLinkLabel: "polityce prywatności",
      privacySuffix: "."
    },
    modal: {
      title: "Ustawienia plików cookies",
      description: "Wybierz, na które kategorie plików cookies wyrażasz zgodę. Wybór możesz zmienić w każdej chwili przez link w stopce serwisu.",
      save: "Zapisz wybór",
      acceptAll: "Akceptuję wszystkie",
      rejectAll: "Odrzucam wszystkie",
      close: "Zamknij",
      alwaysOn: "Zawsze aktywne",
      categories: {
        necessary: {
          label: "Niezbędne",
          description: "Utrzymują sesję logowania i chronią formularze przed nadużyciami (Supabase Auth, Cloudflare Turnstile). Bez nich serwis nie może działać."
        },
        analytics: {
          label: "Analityczne",
          description: "Pomagają nam zrozumieć, jak używany jest serwis, dzięki anonimowym statystykom odwiedzin."
        },
        marketing: {
          label: "Marketingowe",
          description: "Pozwalają mierzyć skuteczność reklam Google Ads i lepiej dopasować je do odbiorców."
        }
      }
    },
    footerLink: "Ustawienia cookies"
  },
  en: {
    banner: {
      ariaLabel: "Cookie consent",
      body: "We use cookies to keep the service running and, with your consent, for anonymous usage statistics and ad performance measurement.",
      acceptAll: "Accept all",
      rejectAll: "Reject all",
      settings: "Settings",
      privacyPrefix: "See our ",
      privacyLinkLabel: "privacy policy",
      privacySuffix: " for details."
    },
    modal: {
      title: "Cookie settings",
      description: "Choose which cookie categories you consent to. You can change your choice at any time using the link in the site footer.",
      save: "Save choices",
      acceptAll: "Accept all",
      rejectAll: "Reject all",
      close: "Close",
      alwaysOn: "Always active",
      categories: {
        necessary: {
          label: "Necessary",
          description: "They keep your sign-in session alive and protect forms from abuse (Supabase Auth, Cloudflare Turnstile). The service cannot work without them."
        },
        analytics: {
          label: "Analytics",
          description: "They help us understand how the service is used through anonymous visit statistics."
        },
        marketing: {
          label: "Marketing",
          description: "They let us measure the performance of Google Ads campaigns and target them better."
        }
      }
    },
    footerLink: "Cookie settings"
  }
};
