"use client";

import React, { useState, useEffect, useRef } from "react";
import { User, UserCheck, Phone, Lock, ArrowRight, Loader2, LogIn, ImagePlus, KeyRound, ChevronLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanPhone } from "@/lib/utils";
import { SplashScreen } from "@/components/splash-screen";

export interface UserData {
  fullName: string;
  nickname: string;
  phone: string;
}

interface LoginProps {
  onSuccess: (data: UserData) => void;
  showSplash?: boolean;
}

interface CountryInfo {
  code: string;
  country: string;
  flag: string;
  prefix: string;
}

const COUNTRIES: CountryInfo[] = [
  { code: "GH", country: "Ghana", flag: "🇬🇭", prefix: "+233" },
  { code: "US", country: "United States", flag: "🇺🇸", prefix: "+1" },
  { code: "GB", country: "United Kingdom", flag: "🇬🇧", prefix: "+44" },
  { code: "NG", country: "Nigeria", flag: "🇳🇬", prefix: "+234" },
  { code: "CA", country: "Canada", flag: "🇨🇦", prefix: "+1" },
  { code: "KE", country: "Kenya", flag: "🇰🇪", prefix: "+254" },
  { code: "ZA", country: "South Africa", flag: "🇿🇦", prefix: "+27" },
  { code: "DE", country: "Germany", flag: "🇩🇪", prefix: "+49" },
  { code: "FR", country: "France", flag: "🇫🇷", prefix: "+33" },
  { code: "IN", country: "India", flag: "🇮🇳", prefix: "+91" },
  { code: "JP", country: "Japan", flag: "🇯🇵", prefix: "+81" },
  { code: "AU", country: "Australia", flag: "🇦🇺", prefix: "+61" },
  { code: "BR", country: "Brazil", flag: "🇧🇷", prefix: "+55" },
  { code: "AE", country: "UAE", flag: "🇦🇪", prefix: "+971" },
];

interface AuthProfile {
  phone: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  pin_hash: string | null;
}

const PIN_HASH_ITERATIONS = 310000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  if (!/^(?:[\da-fA-F]{2})+$/.test(hex)) return null;
  const matched = hex.match(/.{1,2}/g);
  return matched ? new Uint8Array(matched.map((pair) => Number.parseInt(pair, 16))) : null;
}

async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PIN_HASH_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${PIN_HASH_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`;
}

async function verifyPin(pin: string, storedHash: string) {
  if (!storedHash) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 4) return false;

  const [algorithm, iterationText, saltHex, expectedHex] = parts;
  const iterations = Number(iterationText);
  if (
    algorithm !== "pbkdf2" ||
    !/^\d+$/.test(iterationText) ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100000 ||
    !/^[\da-fA-F]{32}$/.test(saltHex) ||
    !/^[\da-fA-F]{64}$/.test(expectedHex)
  ) return false;

  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(expectedHex);
  if (!salt || !expected) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  ));
  if (derived.length !== expected.length || derived.length === 0) return false;
  return derived.reduce((difference, byte, index) => difference | (byte ^ expected[index]), 0) === 0;
}

export function Login({ onSuccess, showSplash = true }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "pin" | "legacy-pin">("phone");
  const [existingProfile, setExistingProfile] = useState<AuthProfile | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Signup fields
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loginPin, setLoginPin] = useState("");

  // Phone field
  const [phone, setPhone] = useState("");
  const [detectedCountry, setDetectedCountry] = useState<CountryInfo>(COUNTRIES[0]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileCheckComplete, setProfileCheckComplete] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(!showSplash);

  // Revoke preview Object URLs on change/unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (!showSplash) {
      setMinimumSplashElapsed(true);
      return;
    }
    const timer = window.setTimeout(() => setMinimumSplashElapsed(true), 800);
    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    let cancelled = false;
    const savedUser = typeof window !== "undefined" ? localStorage.getItem("loci_user_profile") : null;
    let cachedPhone = "";
    if (savedUser) {
      try {
        cachedPhone = JSON.parse(savedUser).phone || "";
      } catch {
        localStorage.removeItem("loci_user_profile");
      }
    }
    const savedPhone = typeof window !== "undefined" ? localStorage.getItem("loci_saved_phone") : null;
    const phoneToVerify = cachedPhone || savedPhone || "";

    if (!phoneToVerify) {
      setProfileCheckComplete(true);
    } else {
      setPhone(phoneToVerify);
      supabase
        .from("users")
        .select("phone, full_name, nickname, avatar_url, pin_hash")
        .eq("phone", phoneToVerify)
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error("Profile verification error:", error);
            setErrorMessage("Could not verify saved profile. Enter your phone number.");
            setProfileCheckComplete(true);
            return;
          }
          if (data) {
            setExistingProfile(data);
            setPhone(data.phone);
            setAuthStep("pin");
            if (!data.pin_hash) {
              setErrorMessage("This profile has no security PIN set.");
            }
          } else {
            localStorage.removeItem("loci_user_profile");
            localStorage.removeItem("loci_saved_phone");
            setPhone(phoneToVerify);
            setIsSignUp(true);
          }
          setProfileCheckComplete(true);
        }, () => {
          if (!cancelled) setProfileCheckComplete(true);
        });
    }

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.includes("Accra") || tz.includes("Ghana")) {
        setDetectedCountry(COUNTRIES.find((c) => c.code === "GH") || COUNTRIES[0]);
      } else if (tz.includes("London") || tz.includes("Europe/London")) {
        setDetectedCountry(COUNTRIES.find((c) => c.code === "GB") || COUNTRIES[0]);
      } else if (tz.includes("Lagos")) {
        setDetectedCountry(COUNTRIES.find((c) => c.code === "NG") || COUNTRIES[0]);
      } else if (tz.includes("America")) {
        setDetectedCountry(COUNTRIES.find((c) => c.code === "US") || COUNTRIES[1]);
      }
    } catch {
      setDetectedCountry(COUNTRIES[0]);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const resetFormState = () => {
    setErrorMessage(null);
    setFullName("");
    setNickname("");
    setPin("");
    setConfirmPin("");
    setLoginPin("");
    setAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);

    const cleanVal = val.trim();
    if (cleanVal.length >= 2) {
      const match = COUNTRIES.find((c) => cleanVal.startsWith(c.prefix) || (cleanVal.startsWith("+") && cleanVal.startsWith(c.prefix)));
      if (match) {
        setDetectedCountry(match);
      }
    }
  };

  const formatPhoneNumber = (inputPhone: string): string => {
    let cleaned = inputPhone.trim();
    if (detectedCountry && !cleaned.startsWith("+")) {
      const digitsOnly = cleaned.replace(/^0+/, "");
      cleaned = `${detectedCountry.prefix}${digitsOnly}`;
    }
    return cleaned;
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMessage(null);
    const formattedPhone = formatPhoneNumber(phone);

    if (!cleanPhone(formattedPhone)) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("users")
        .select("phone, full_name, nickname, avatar_url, pin_hash")
        .eq("phone", formattedPhone)
        .maybeSingle();

      if (error) {
        setErrorMessage("Authentication failed. Please check your connection.");
        setLoading(false);
        return;
      }

      if (!data) {
        setExistingProfile(null);
        setAuthStep("phone");
        setPin("");
        setConfirmPin("");
        setPhone(formattedPhone);
        setIsSignUp(true);
        setLoading(false);
        return;
      }

      setExistingProfile(data);
      setPhone(data.phone);

      if (!data.pin_hash) {
        setAuthStep("legacy-pin");
      } else {
        setAuthStep("pin");
      }
    } catch {
      setErrorMessage("Failed to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!existingProfile?.pin_hash || !/^\d{4}$/.test(loginPin)) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const valid = await verifyPin(loginPin, existingProfile.pin_hash);
      if (!valid) {
        setErrorMessage("Incorrect PIN. Please try again.");
        setLoginPin("");
        setLoading(false);
        return;
      }

      const userData: UserData = {
        fullName: existingProfile.full_name || "",
        nickname: existingProfile.nickname || "",
        phone: existingProfile.phone,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("loci_user_profile", JSON.stringify(userData));
        localStorage.setItem("loci_saved_phone", existingProfile.phone);
      }

      onSuccess(userData);
    } catch {
      setErrorMessage("Could not verify PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLegacyPinSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!existingProfile?.phone) return;

    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setErrorMessage("Enter and confirm a 4-digit Security PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage("PINs do not match. Please try again.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const pinHash = await hashPin(pin);
      const { error } = await supabase
        .from("users")
        .update({ pin_hash: pinHash })
        .eq("phone", existingProfile.phone);

      if (error) throw error;

      const userData: UserData = {
        fullName: existingProfile.full_name || "",
        nickname: existingProfile.nickname || "",
        phone: existingProfile.phone,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("loci_user_profile", JSON.stringify(userData));
        localStorage.setItem("loci_saved_phone", existingProfile.phone);
      }

      onSuccess(userData);
    } catch {
      setErrorMessage("Could not save Security PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMessage(null);
    const trimmedFullName = fullName.trim();
    const trimmedNickname = nickname.trim();
    const formattedPhone = formatPhoneNumber(phone);

    if (!trimmedFullName || !trimmedNickname || !cleanPhone(formattedPhone)) {
      setErrorMessage("Please fill in all required fields accurately.");
      return;
    }
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setErrorMessage("Enter and confirm a 4-digit Security PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage("PINs do not match. Please try again.");
      return;
    }
    if (!avatarFile) {
      setErrorMessage("Upload a profile avatar to finish creating your profile.");
      return;
    }

    setLoading(true);

    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("phone, full_name, nickname, avatar_url, pin_hash")
        .eq("phone", formattedPhone)
        .maybeSingle();

      if (existingUser) {
        setPhone(existingUser.phone);
        setIsSignUp(false);
        setExistingProfile(existingUser);
        setAuthStep("pin");
        setLoginPin("");
        setErrorMessage("An account with this phone already exists. Please log in.");
        setLoading(false);
        return;
      }

      // Process & aspect-ratio crop avatar image
      let avatarUrl = "";
      const bitmap = await createImageBitmap(avatarFile);
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const minDim = Math.min(bitmap.width, bitmap.height);
        const sx = (bitmap.width - minDim) / 2;
        const sy = (bitmap.height - minDim) / 2;
        ctx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, 300, 300);
      }
      bitmap.close();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (!blob) throw new Error("Avatar processing failed.");

      const fileName = `${formattedPhone.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      avatarUrl = publicUrlData.publicUrl;

      const pinHash = await hashPin(pin);

      const { error: dbError } = await supabase.from("users").upsert(
        {
          full_name: trimmedFullName,
          nickname: trimmedNickname,
          phone: formattedPhone,
          avatar_url: avatarUrl,
          pin_hash: pinHash,
        },
        { onConflict: "phone" }
      );

      if (dbError) throw dbError;

      const userData: UserData = {
        fullName: trimmedFullName,
        nickname: trimmedNickname,
        phone: formattedPhone,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("loci_user_profile", JSON.stringify(userData));
        localStorage.setItem("loci_saved_phone", formattedPhone);
      }

      onSuccess(userData);
    } catch (err) {
      console.error("Profile registration failed:", err);
      setErrorMessage("Registration failed. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (showSplash && (!minimumSplashElapsed || !profileCheckComplete)) {
    return <SplashScreen />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between p-6 max-w-md mx-auto w-full select-none">
      <div className="pt-6">
        <img src="/loci-light.png" alt="Déloci Logo" width={160} height={48} className="h-12 w-auto object-contain shrink-0 mb-4 dark:hidden" />
        <img src="/loci-dark.png" alt="Déloci Logo" width={160} height={48} className="hidden h-12 w-auto object-contain shrink-0 mb-4 dark:block" />
        <h1 className="text-2xl font-extrabold tracking-tight text-black dark:text-white">
          {isSignUp ? "Create Your Déloci Profile" : "Welcome Back"}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          {isSignUp ? "Set up your identity before starting safety check-ins." : "Enter your phone number to sign in instantly."}
        </p>
      </div>

      {isSignUp ? (
        <form onSubmit={handleSignUpSubmit} className="my-auto py-4 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
              {errorMessage}
            </div>
          )}

          <input
            ref={avatarInputRef}
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onClick={(e) => {
              (e.target as HTMLInputElement).value = "";
            }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setAvatarFile(file);
              setAvatarPreview(URL.createObjectURL(file));
              setErrorMessage(null);
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => avatarInputRef.current?.click()}
            className="w-full flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-left disabled:opacity-50"
          >
            <span className="w-12 h-12 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
              {avatarPreview ? <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-zinc-400" />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-extrabold text-black dark:text-white">Profile Avatar</span>
              <span className="block text-[10px] text-zinc-500">{avatarFile ? avatarFile.name : "Choose an image to continue"}</span>
            </span>
          </button>

          <div>
            <label htmlFor="full-name-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Full Name
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="full-name-input"
                type="text"
                required
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nickname-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Nickname (Known to contacts)
            </label>
            <div className="relative flex items-center">
              <UserCheck className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="nickname-input"
                type="text"
                required
                disabled={loading}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pin-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              4-Digit Security PIN
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="pin-input"
                type="password"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                disabled={loading}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm tracking-[0.5em] text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm-pin-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Confirm Security PIN
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="confirm-pin-input"
                type="password"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                disabled={loading}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm tracking-[0.5em] text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="signup-phone-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Mobile Phone Number
              </label>
              {detectedCountry && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold bg-yellow-400 text-black px-2 py-0.5 rounded-md">
                  <span>{detectedCountry.flag}</span>
                  <span>{detectedCountry.country}</span>
                  <span>({detectedCountry.prefix})</span>
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <Phone className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="signup-phone-input"
                type="tel"
                required
                disabled={loading}
                value={phone}
                onChange={handlePhoneChange}
                placeholder={detectedCountry ? `${detectedCountry.prefix} ...` : "+..."}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-md shadow-yellow-400/20 disabled:opacity-50 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <><span>Save Profile &amp; Continue</span><ArrowRight className="w-4 h-4 text-black" /></>}
          </button>
        </form>
      ) : authStep === "legacy-pin" && existingProfile ? (
        <form onSubmit={handleLegacyPinSetup} className="my-auto py-4 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
              {errorMessage}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-yellow-400 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-xl font-black text-yellow-500">
              {existingProfile.avatar_url ? (
                <img src={existingProfile.avatar_url} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                (existingProfile.nickname || existingProfile.full_name || "U").slice(0, 2)
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-extrabold text-black dark:text-white">{existingProfile.nickname || existingProfile.full_name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Welcome Back! Set Your 4-Digit Security PIN</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="legacy-pin-input"
                type="password"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                disabled={loading}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm tracking-[0.5em] text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="confirm-legacy-pin-input"
                type="password"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                disabled={loading}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Confirm PIN"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm tracking-[0.5em] text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-md shadow-yellow-400/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /><span>Save Security PIN</span></>}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthStep("phone");
              setExistingProfile(null);
              resetFormState();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Use a different phone number
          </button>
        </form>
      ) : authStep === "pin" && existingProfile ? (
        <form onSubmit={handlePinLogin} className="my-auto py-4 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
              {errorMessage}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-yellow-400 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-xl font-black text-yellow-500">
              {existingProfile.avatar_url ? (
                <img src={existingProfile.avatar_url} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                (existingProfile.nickname || existingProfile.full_name || "U").slice(0, 2)
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-extrabold text-black dark:text-white">{existingProfile.nickname || existingProfile.full_name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Enter 4-Digit Security PIN</p>
            </div>
          </div>
          <div className="relative flex items-center">
            <KeyRound className="w-4 h-4 absolute left-4 text-zinc-400" />
            <input
              id="pin-login-input"
              type="password"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4}"
              maxLength={4}
              disabled={loading}
              value={loginPin}
              onChange={(event) => setLoginPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              aria-label="4-digit Security PIN"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-center text-lg tracking-[0.6em] text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || loginPin.length !== 4}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-md shadow-yellow-400/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogIn className="w-4 h-4" /><span>Unlock Déloci</span></>}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthStep("phone");
              setExistingProfile(null);
              resetFormState();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Use a different phone number
          </button>
        </form>
      ) : (
        <form onSubmit={handlePhoneLogin} className="my-auto py-4 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
              {errorMessage}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-phone-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Mobile Phone Number
              </label>
              {detectedCountry && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold bg-yellow-400 text-black px-2 py-0.5 rounded-md">
                  <span>{detectedCountry.flag}</span>
                  <span>{detectedCountry.country}</span>
                  <span>({detectedCountry.prefix})</span>
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <Phone className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="login-phone-input"
                type="tel"
                required
                disabled={loading}
                value={phone}
                onChange={handlePhoneChange}
                placeholder={detectedCountry ? `${detectedCountry.prefix} ...` : "+..."}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-md shadow-yellow-400/20 disabled:opacity-50 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <><LogIn className="w-4 h-4 text-black" /><span>Log In</span></>}
          </button>
        </form>
      )}

      {authStep !== "pin" && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              resetFormState();
              setIsSignUp(!isSignUp);
            }}
            className="text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
          >
            {isSignUp ? (
              <span>Already have an account? <strong className="text-yellow-500 underline">Log In</strong></span>
            ) : (
              <span>Don't have an account? <strong className="text-yellow-500 underline">Create Profile</strong></span>
            )}
          </button>
        </div>
      )}

      <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center pb-2 mt-2">
        Déloci safety check-ins require explicit consent. No continuous tracking.
      </p>
    </div>
  );
}