"use client";

import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <MailCheck className="mb-2 h-5 w-5" />
        Wysłaliśmy link logowania na <strong>{email}</strong>. Sprawdź skrzynkę.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-md border border-input bg-white px-3 outline-none focus:ring-2 focus:ring-ring"
          placeholder="ty@firma.pl"
          autoComplete="email"
        />
      </label>
      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Wyślij link logowania
      </Button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
