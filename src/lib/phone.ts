// Auto-detect country code from browser locale or fallback globally
export function getDefaultCountryCode(): string {
  if (typeof window === "undefined") return "+1";
  
  const locale = navigator.language || "en-US";
  
  // Map common region locales to international calling codes
  const countryCodeMap: Record<string, string> = {
    "en-GH": "+233",
    "en-NG": "+234",
    "en-US": "+1",
    "en-GB": "+44",
    "en-CA": "+1",
    "en-KE": "+254",
    "en-ZA": "+27",
    "fr-FR": "+33",
    "es-ES": "+34",
    "de-DE": "+49",
  };

  if (countryCodeMap[locale]) {
    return countryCodeMap[locale];
  }

  // Fallback to checking the country region part (e.g. "en-GB" -> region "GB")
  const parts = locale.split("-");
  if (parts.length > 1) {
    const region = parts[1].toUpperCase();
    // You can add more mappings here as your user base expands globally
  }

  return "+1"; // Global default fallback
}

export function normalizePhone(phone: string, customDefaultCountry?: string): string {
  const stripped = phone.replace(/[\s\-\(\)]/g, "");
  
  // If user already typed an international plus code, keep it
  if (stripped.startsWith("+")) {
    return `+${stripped.slice(1).replace(/\D/g, "")}`;
  }

  const digits = stripped.replace(/\D/g, "");
  const defaultCountry = customDefaultCountry || getDefaultCountryCode();
  const countryDigits = defaultCountry.replace("+", "");

  // If user typed national format with leading zero (e.g., 024... or 070...)
  if (digits.startsWith("0")) {
    return `${defaultCountry}${digits.slice(1)}`;
  }

  // If digits already start with the country digits, add the plus
  if (digits.startsWith(countryDigits)) {
    return `+${digits}`;
  }

  // Otherwise, prepend the auto-detected default country code
  return `${defaultCountry}${digits}`;
}