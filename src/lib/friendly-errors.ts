const DEFAULT_MESSAGE = "Something went wrong on our end. Please try again.";

export function getFriendlyErrorMessage(error: unknown, fallback = DEFAULT_MESSAGE): string {
  const value = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = value.toLowerCase();

  if (/too many attempts|rate.?limit|429/.test(message)) {
    return "There have been several tries. Please wait a little, then try again.";
  }
  if (/incorrect pin|invalid sign-in|invalid credentials|invalid login|401|unauthorized/.test(message)) {
    return "That phone number and PIN don’t match. Check them and try again.";
  }
  if (/notification session expired|session expired|sign in again/.test(message)) {
    return "Your sign-in has expired. Please sign in again to continue.";
  }
  if (/verified recovery|verify that you own this phone|contact support/.test(message)) {
    return "For your security, we need to verify that you own this phone before setting a PIN. Please contact our support team for account recovery.";
  }
  if (/network|fetch failed|failed to fetch|offline|timeout|timed out|connection/.test(message)) {
    return "We couldn’t connect just now. Check your connection and try again.";
  }
  if (/duplicate|already exists|23505/.test(message)) {
    return "An account with this number already exists. Sign in or use a different number.";
  }
  if (/permission|denied|403|forbidden/.test(message)) {
    return "This action isn’t available right now. Check your settings or try again later.";
  }
  if (/not supported|unsupported/.test(message)) {
    return "This feature isn’t supported on this device. You can keep using the app without it.";
  }

  return fallback;
}