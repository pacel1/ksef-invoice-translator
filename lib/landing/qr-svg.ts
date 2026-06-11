/**
 * Builds a single SVG path drawing one unit square per dark ("1") module of a
 * QR matrix. Rendered inside an `<svg viewBox="0 0 size size">`, so the path
 * stays resolution-independent and crisp at any display size.
 */
export function qrSvgPath(rows: readonly string[]): string {
  return rows
    .flatMap((row, y) =>
      [...row].map((cell, x) => (cell === "1" ? `M${x} ${y}h1v1h-1z` : ""))
    )
    .join("");
}
