/**
 * Formats a number with comma separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a number as Philippine Peso currency (whole numbers only)
 * @param value - The number to format
 * @returns Formatted currency string with ₱ symbol (rounded to whole number)
 */
export function formatCurrency(value: number): string {
  return '₱' + formatInteger(Math.round(value));
}

/**
 * Formats an integer with comma separators (no decimals)
 * @param value - The number to format
 * @returns Formatted string with commas
 */
export function formatInteger(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
