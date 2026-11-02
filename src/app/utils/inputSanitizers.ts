/**
 * Input sanitization utilities for system-wide field restrictions
 * Used across all create/update operations for Customer, Staff, and Admin roles
 */

export function digitsOnly(value: string, maxLen?: number): string {
  if (!value) return '';
  let v = String(value).replace(/\D/g, '');
  if (maxLen && maxLen > 0) {
    v = v.slice(0, maxLen);
  }
  return v;
}

export function alphaSpaces(value: string, maxLen?: number): string {
  if (!value) return '';
  let v = String(value).replace(/[^A-Za-z\s.\-']/g, '');
  if (maxLen && maxLen > 0) {
    v = v.slice(0, maxLen);
  }
  return v;
}

export function alphaNumericOnly(value: string, maxLen?: number): string {
  if (!value) return '';
  let v = String(value).replace(/[^A-Za-z0-9]/g, '');
  if (maxLen && maxLen > 0) {
    v = v.slice(0, maxLen);
  }
  return v;
}

export function alphaNumericSpaces(value: string, maxLen?: number): string {
  if (!value) return '';
  let v = String(value).replace(/[^A-Za-z0-9\s.\-']/g, '');
  if (maxLen && maxLen > 0) {
    v = v.slice(0, maxLen);
  }
  return v;
}

export function moneyInput(value: string, maxDecimal = 2): string {
  if (!value) return '';
  let v = String(value).replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) {
    v = parts[0] + '.' + parts.slice(1).join('');
  }
  const p = v.split('.');
  if (p[1] && p[1].length > maxDecimal) {
    v = p[0] + '.' + p[1].slice(0, maxDecimal);
  }
  if (v.startsWith('00') && v.indexOf('.') !== 1) {
    v = v.replace(/^0+/, v.startsWith('0.') ? '0' : '');
  }
  return v;
}

export function integersOnly(value: string, allowNegative = false): string {
  if (!value) return '';
  const pattern = allowNegative ? /[^0-9-]/g : /[^0-9]/g;
  let v = String(value).replace(pattern, '');
  if (!allowNegative && v.startsWith('-')) {
    v = v.replace('-', '');
  }
  if (allowNegative && v.indexOf('-') > 0) {
    v = '-' + v.replace(/-/g, '');
  }
  return v;
}

export function trimValue(value: string): string {
  if (!value) return '';
  return String(value).trim();
}

export function sanitizePhone(value: string): string {
  return digitsOnly(value, 11);
}

export function sanitizeReference(value: string): string {
  return alphaNumericOnly(value, 20);
}

export function sanitizeName(value: string): string {
  return alphaSpaces(value, 60);
}

export function sanitizeAccountName(value: string): string {
  return alphaSpaces(value, 80);
}

export function sanitizeAccountNumber(value: string): string {
  return digitsOnly(value, 30);
}

export function sanitizeEmail(value: string): string {
  if (!value) return '';
  return String(value).replace(/\s/g, '').toLowerCase();
}

export function sanitizeText(value: string, maxLen?: number): string {
  if (!value) return '';
  let v = String(value).trim();
  if (maxLen && maxLen > 0) {
    v = v.slice(0, maxLen);
  }
  return v;
}

export function normalizePhoneForSave(value: string): string {
  return digitsOnly(value, 11);
}

export function normalizeNameForSave(value: string): string {
  return alphaSpaces(trimValue(value), 60);
}

export function normalizeEmailForSave(value: string): string {
  return sanitizeEmail(value);
}
