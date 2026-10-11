import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with clsx utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes any phone input into a canonical E.164 format with leading '+'.
 * Preserves full country codes worldwide without stripping digits.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";

  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";

  // Always output canonical E.164 string (+CountryCodeNumber)
  return `+${digits}`;
}

/**
 * Validates worldwide E.164 international phone numbers (8 to 15 digits)
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+\d{8,15}$/.test(normalized);
}

// Retain cleanPhone as an alias so existing imports across the project do not break
export const cleanPhone = normalizePhone;