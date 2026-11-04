// The single page-level color gate. Lives in its own dependency-free module so
// both the pixel analyzer and the pricing lookup can agree on one number
// without dragging pdf.js into the pricing bundle.
//
// A page counts as a color page when at least this percent of its pixels pass
// the analyzer's color test AND at least PAGE_COLOR_MIN_PIXELS pixels do. On a
// full-size page the fraction is the binding half; the count floor is what
// keeps a 2-3 pixel speck from repainting a small page.
//
// The bar is deliberately about PRESENCE, not amount: a page carrying a small
// logo, a colored heading or a chart still has to come off a color press, and
// measured noise never reaches it — a page of black text, a pale hairline and a
// noisy grayscale JPEG scan all score exactly 0%. The gate runs on the value
// rounded to two decimals below 1%, so a 0.14% page is never promoted to 0.2%.
export const PAGE_COLOR_THRESHOLD_PCT = 0.15;
export const PAGE_COLOR_MIN_PIXELS = 25;
