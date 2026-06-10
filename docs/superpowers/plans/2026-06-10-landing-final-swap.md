# Landing Final Swap (+ showcase animation fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the two showcase animation bugs (purple scan artifact, language-cycle box resize), then swap the rebuilt landing onto `/` and `/en` and retire the old marketing landing.

**Architecture:** The scan overlay divs (hero `invoice-showcase.tsx` and demo `invoice-stage.tsx`) get an `opacity-0` base state so the gradient is only visible while the keyframes drive it (the keyframes animate opacity 0 -> 1 -> 0, but with the default fill mode the element reverted to a fully visible gradient at rest, and under reduced motion it was permanently visible). The hero strip gets a language-independent layout (status pinned to its own line below 480px viewports). Then `/` and `/en` render `LandingRebuild`, `app/landing-preview/` is deleted, the old-landing-exclusive components and their copy/tests are removed, and the e2e spec retargets `/`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, Vitest + Testing Library, Playwright.

**Branch:** `claude/landing-swap` (created off `main`). One PR.

**Measured evidence (controller, 375px viewport):** card heights cycle 434/435/457px; the language strip is 73px for EN/DE/ES (status wraps to a second line) vs 50px for PL/FR/IT — the body rows are constant 31px. The scan overlay's computed opacity at rest is ~1 with the gradient visible.

---

## Task 1: Animation fixes (artifact + box resize)

**Files:**
- Modify: `components/landing/invoice-showcase.tsx`, `components/landing/demo/invoice-stage.tsx`
- Test: extend `tests/components/landing/invoice-showcase.test.tsx`, `tests/components/landing/invoice-stage.test.tsx`

- [ ] **Step 1: Add the failing tests.** In `invoice-showcase.test.tsx` (follow its existing render conventions):

```tsx
  it("keeps the scan overlay invisible at rest (no purple artifact)", () => {
    const { container } = render(<InvoiceShowcase />);
    const scan = container.querySelector('[class*="showcase-scan"]');
    expect(scan).not.toBeNull();
    expect(scan!.className).toContain("opacity-0");
  });

  it("pins the status to a stable layout so the strip height never depends on the language", () => {
    render(<InvoiceShowcase />);
    const status = screen.getByText("Gotowe").closest("span.inline-flex");
    expect(status).not.toBeNull();
    expect(status!.className).toContain("w-full");
    expect(status!.className).toContain("min-[480px]:w-auto");
  });
```

(Reduced-motion mock shows the static EN card in some tests; "Gotowe" is the PL status shown at index 0 without reduced motion — check the file's existing matchMedia setup and use the status string that the default test path renders; if the file mocks reduced motion to true, use "Translated" instead.)

In `invoice-stage.test.tsx`:

```tsx
  it("keeps the scan overlay invisible at rest (no purple artifact)", () => {
    const { container } = render(<InvoiceStage lang="en" watermark="PODGLĄD" />);
    const scan = container.querySelector('[class*="showcase-scan"]');
    expect(scan).not.toBeNull();
    expect(scan!.className).toContain("opacity-0");
  });
```

- [ ] **Step 2: Run -> FAIL** (both files).

- [ ] **Step 3: Implement.**

`components/landing/invoice-showcase.tsx` line ~69, add `opacity-0` to the scan div:

```tsx
          <div aria-hidden="true" key={index} className="pointer-events-none absolute inset-x-0 top-0 h-3/5 opacity-0 motion-safe:animate-showcase-scan" style={{ background: "linear-gradient(180deg, transparent, rgba(79,70,229,0.10) 60%, rgba(139,92,246,0.18))" }} />
```

`components/landing/demo/invoice-stage.tsx`, same change on its scan div: className becomes `"pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-0 motion-safe:animate-showcase-scan"`.

(The keyframes already animate opacity at 0%/30%/100%; CSS animations override the base declaration while running, and at rest or under reduced motion the overlay is now invisible.)

`components/landing/invoice-showcase.tsx` line ~61, the status span: replace `ml-auto` so the status sits on its own right-aligned line below 480px viewports (constant strip height per breakpoint, regardless of language):

```tsx
          <span className="inline-flex w-full items-center justify-end gap-1.5 text-[11px] font-semibold text-mint min-[480px]:ml-auto min-[480px]:w-auto">
```

- [ ] **Step 4: Run -> PASS** (whole files; pre-existing tests stay green). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add components/landing/invoice-showcase.tsx components/landing/demo/invoice-stage.tsx tests/components/landing/invoice-showcase.test.tsx tests/components/landing/invoice-stage.test.tsx
git commit -m "fix(landing): scan overlay invisible at rest + stable showcase strip height"
```

---

## Task 2: The swap

**Files:**
- Modify: `app/page.tsx`, `app/en/page.tsx`, `lib/marketing/copy.ts`, `tests/integration/lib/marketing-copy.test.ts`
- Delete: `app/landing-preview/` (dir), `components/marketing/landing-page.tsx`, `components/marketing/how-it-works.tsx`, `components/marketing/risk-reversal.tsx`, `components/ui/hero-section-9.tsx`, `components/ui/features-section.tsx`, `components/trust/trust-strip.tsx` (verify zero consumers first), `tests/components/marketing/landing-page.test.tsx`, `tests/components/marketing/how-it-works.test.tsx`, `tests/components/marketing/risk-reversal.test.tsx`, `tests/e2e/landing-refresh.spec.ts`
- Rename + retarget: `tests/e2e/landing-rebuild-preview.spec.ts` -> `tests/e2e/landing.spec.ts`

- [ ] **Step 1: Swap the pages.**

`app/page.tsx` becomes exactly:

```tsx
import { LandingRebuild } from "@/components/landing/landing-rebuild";

export default function HomePage() {
  return <LandingRebuild locale="pl" />;
}
```

`app/en/page.tsx` becomes exactly:

```tsx
import { LandingRebuild } from "@/components/landing/landing-rebuild";

export default function EnHomePage() {
  return <LandingRebuild locale="en" />;
}
```

Delete `app/landing-preview/` entirely (the rebuilt landing is no longer a preview; SEO metadata for `/` comes from `app/layout.tsx` and must NOT be noindex — deleting the preview page removes the only noindex robots rule).

- [ ] **Step 2: Retire the old-landing-exclusive code.** Before each deletion, verify the file has no remaining importers (`grep -rn "<name>" app components lib tests --include='*.ts*'`). Consumers map (verified at planning time): `hero-section-9`, `features-section`, `how-it-works`, `risk-reversal` are imported ONLY by `components/marketing/landing-page.tsx`; `trust-strip` has no importers at all; KEEP `public-pricing-slider` (pricing page), `marketing-faq` (faq + pricing pages), `data-flow-diagram` (security page), `PublicHeader`/`LegalFooter` (many pages), and the rest of `components/marketing/**`. If any test files exist for the deleted ui components (grep `hero-section-9\|features-section\|trust-strip` under tests/), delete those too.

- [ ] **Step 3: Prune the dead copy.** In `lib/marketing/copy.ts` remove the `landing: { ... }` group from BOTH locales (the only consumer was `landing-page.tsx`). In `tests/integration/lib/marketing-copy.test.ts` remove the landing-group assertions (the `heroEyebrow`/`heroProofLine`/`howItWorks`/`riskReversal` blocks). Keep everything else (pricing/faq/security/legal copy is live).

- [ ] **Step 4: Retarget the e2e.** `git mv tests/e2e/landing-rebuild-preview.spec.ts tests/e2e/landing.spec.ts`, replace every `page.goto("/landing-preview")` with `page.goto("/")`, and append:

```typescript
test("english landing renders at /en with the live demo", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Still retyping your KSeF invoice");
  await expect(
    page.locator("#demo").getByRole("heading", { level: 2, name: "See your invoice in another language" })
  ).toBeVisible();
});

test("the live landing is indexable (no noindex robots meta)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});
```

- [ ] **Step 5: Sweep for stragglers.** `grep -rn "landing-preview\|landing-page\|LandingPage\b" app components lib tests --include='*.ts*'` — fix or remove any remaining references (do NOT touch docs/ or memory files). Also confirm `tests/e2e/smoke.spec.ts` still passes (it only asserts `/` has a title).

- [ ] **Step 6: Full verification.**

```bash
npx vitest run
npx tsc --noEmit
npx playwright test tests/e2e/landing.spec.ts tests/e2e/smoke.spec.ts
npx next build 2>&1 | tail -5
```

Expected: vitest green except the known pre-existing `tests/integration/sql/invoices.test.ts` live-DB failure; tsc clean; e2e 10/10 + smoke; the production build succeeds (catches any broken imports from the deletions).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(landing): swap the rebuilt landing onto / and /en, retire the old one"
```

---

## Controller verification after both tasks

- Live RWD pass on `/` (not the preview route): hero shows no purple artifact after the scan completes; card height constant across the full 6-language cycle (re-measure with the same sampling script); demo stage shows no artifact; 375/768/1280 no overflow; no console errors.
- Final whole-branch review, then PR.

## Self-review notes
- Hero CTAs already point at `#demo` (both buttons, verified in `components/landing/hero.tsx`), which is the real demo after Sprint C — the spec's "repoint" step is already satisfied; no change needed.
- `marketingCopy` keeps every group that live pages still consume; only `.landing` dies with its sole consumer.
- The strip fix changes mobile layout deliberately: below 480px the "Translated" status sits on its own right-aligned line for every language (constant 2-line strip), at >=480px inline (constant 1-line; worst-case widths verified to fit at the 420px card max).
