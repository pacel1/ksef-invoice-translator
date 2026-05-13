import Link from "next/link";

export default function AppPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Konwerter faktur zostanie tu przeniesiony w kolejnej fazie. Na razie strona publiczna pod{" "}
        <Link className="font-medium underline" href="/">/</Link> pozostaje pełnoprawnym narzędziem.
      </p>
    </section>
  );
}
