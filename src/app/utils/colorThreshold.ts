// The single page-level color gate. Lives in its own dependency-free module so
// both the pixel analyzer and the pricing lookup can agree on one number
// without dragging pdf.js into the pricing bundle.
//
// A page counts as a color page only when at least this percent of its pixels
// pass the analyzer's color test. The gate is applied to the un-rounded
// fraction, so a 0.6% page is never promoted to "1% color".
export const PAGE_COLOR_THRESHOLD_PCT = 2;
