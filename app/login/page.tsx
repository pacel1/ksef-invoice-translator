import { LoginForm } from "./login-form";
import { getOptionalUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/app");

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 py-20">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zaloguj się do KSeF Translator</h1>
          <p className="mt-2 text-sm text-slate-600">
            Wpisz swój adres email — wyślemy Ci jednorazowy link logowania.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
