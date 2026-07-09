export interface PhoneNormalizationResult {
  phone: string;
  error?: string;
}

export function formatNumberAsPhone(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value);
  return rounded.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
}

export function normalizePhone(raw: string | number | null | undefined): PhoneNormalizationResult {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { phone: '', error: 'Phone number is required' };
  }

  let value =
    typeof raw === 'number'
      ? formatNumberAsPhone(raw)
      : String(raw).replace(/"/g, '').trim();

  if (/^\d*\.?\d+[eE][+-]?\d+$/.test(value)) {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      value = formatNumberAsPhone(num);
    }
  }

  const hasPlus = value.startsWith('+');
  const digitsOnly = value.replace(/[^\d]/g, '');

  if (!digitsOnly) {
    return { phone: value, error: 'Phone number must contain digits' };
  }
  if (digitsOnly.length < 7) {
    return { phone: value, error: `Phone too short (${digitsOnly.length} digits). Use at least 7 digits.` };
  }
  if (digitsOnly.length > 15) {
    return { phone: value, error: `Phone too long (${digitsOnly.length} digits). Maximum is 15 digits.` };
  }

  const phone = hasPlus ? `+${digitsOnly}` : digitsOnly;
  return { phone };
}

export function formatPhoneDisplay(phone: string): string {
  if (!phone) return phone;
  const { phone: normalized, error } = normalizePhone(phone);
  if (!error) return normalized;
  if (/[eE]/.test(phone)) {
    const fixed = normalizePhone(Number(phone));
    if (!fixed.error) return fixed.phone;
  }
  return phone;
}

export function isValidEmail(raw: string): boolean {
  const value = raw.replace(/"/g, '').trim();
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
