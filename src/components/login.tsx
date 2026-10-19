"use client";

import React, { useState, useEffect, useRef } from "react";
import { User, UserCheck, Phone, Lock, ArrowRight, Loader2, LogIn, ImagePlus, KeyRound, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { normalizePhone, isValidPhone } from "@/lib/utils";
import { getCurrentProfile, signInWithPhone, signUpWithPhone } from "@/lib/auth";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
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
  id: string;
  phone: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export function Login({ onSuccess, showSplash = true }: LoginProps) {
  const onSuccessRef = useRef(onSuccess);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "password">("phone");
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

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = window.setTimeout(() => setMinimumSplashElapsed(true), 800);
    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    let cancelled = false;
    const restoreProfile = () => {
      void getCurrentProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) onSuccessRef.current({
          fullName: profile.full_name || "",
          nickname: profile.nickname || "",
          phone: profile.phone,
        });
      })
      .catch((error: unknown) => console.error("Could not restore Supabase Auth profile:", error))
      .finally(() => {
        if (!cancelled) setProfileCheckComplete(true);
      });
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.session) {
        setProfileCheckComplete(true);
        return;
      }
      restoreProfile();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        queueMicrotask(restoreProfile);
      }
    });

    const countryFrameId = window.requestAnimationFrame(() => {
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone.includes("Accra") || timezone.includes("Ghana")) {
          setDetectedCountry(COUNTRIES.find((country) => country.code === "GH") || COUNTRIES[0]);
        } else if (timezone.includes("London") || timezone.includes("Europe/London")) {
          setDetectedCountry(COUNTRIES.find((country) => country.code === "GB") || COUNTRIES[0]);
        } else if (timezone.includes("Lagos")) {
          setDetectedCountry(COUNTRIES.find((country) => country.code === "NG") || COUNTRIES[0]);
        } else if (timezone.includes("America")) {
          setDetectedCountry(COUNTRIES.find((country) => country.code === "US") || COUNTRIES[1]);
        }
      } catch {
        setDetectedCountry(COUNTRIES[0]);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(countryFrameId);
      authListener.subscription.unsubscribe();
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
    setErrorMessage(null);

    const cleanVal = val.trim();
    if (!cleanVal) return;

    const match = COUNTRIES.find((country) => {
      const withoutPlus = country.prefix.replace("+", "");
      return cleanVal.startsWith(country.prefix) || cleanVal.startsWith(withoutPlus);
    });

    if (match) {
      setDetectedCountry(match);
    }
  };

  const formatPhoneNumber = (inputPhone: string): string => {
    let cleaned = inputPhone.trim();
    if (detectedCountry && !cleaned.startsWith("+")) {
      const digitsOnly = cleaned.replace(/^0+/, "");
      cleaned = `${detectedCountry.prefix}${digitsOnly}`;
    }
    return normalizePhone(cleaned);
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMessage(null);
    const formattedPhone = formatPhoneNumber(phone);

    if (!isValidPhone(formattedPhone)) {
      setErrorMessage("Enter a complete phone number with its country code, such as +1 or +44.");
      return;
    }

    setPhone(formattedPhone);
    setExistingProfile({ id: "", phone: formattedPhone, full_name: null, nickname: null, avatar_url: null });
    setLoginPin("");
    setAuthStep("password");
  };

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (!existingProfile || !/^\d{4}$/.test(loginPin)) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const verifiedProfile = await signInWithPhone(existingProfile.phone, loginPin);

      const userData: UserData = {
        fullName: verifiedProfile.full_name || "",
        nickname: verifiedProfile.nickname || "",
        phone: verifiedProfile.phone,
      };

      onSuccessRef.current(userData);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, "We couldn’t sign you in. Check your PIN and try again."));
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

    if (!trimmedFullName || !trimmedNickname || !isValidPhone(formattedPhone)) {
      setErrorMessage("Please fill in all required fields accurately.");
      return;
    }
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setErrorMessage("Enter and confirm a 4-digit PIN.");
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
      let avatarBlob: Blob | null = null;
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

      avatarBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));

      const savedProfile = await signUpWithPhone({
        fullName: trimmedFullName,
        nickname: trimmedNickname,
        phone: formattedPhone,
        pin,
      });

      if (avatarBlob) {
        const fileName = `${formattedPhone.replace(/[^a-zA-Z0-9]/g, "")}.jpg`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarBlob, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "3600",
        });
        if (uploadError) {
          console.warn("Account created, but profile photo could not be uploaded:", uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
          const avatarUrl = publicUrlData.publicUrl;
          const { error: profileUpdateError } = await supabase
            .from("users")
            .update({ avatar_url: avatarUrl })
            .eq("id", savedProfile.id);
          if (profileUpdateError) console.warn("Account created, but profile photo could not be saved:", profileUpdateError);
          else savedProfile.avatar_url = avatarUrl;
        }
      }

      if (typeof window !== "undefined") {
        const referrerNickname = localStorage.getItem("loci_referrer_nickname");
        if (referrerNickname) {
          try {
            await supabase.rpc("handle_referral_signup", {
              p_referrer_phone: referrerNickname,
              p_new_user_phone: formattedPhone,
            });
            localStorage.removeItem("loci_referrer_nickname");
          } catch (refErr) {
            console.error("Referral linking failed:", refErr);
          }
        }
      }

      const userData: UserData = {
        fullName: savedProfile.full_name || trimmedFullName,
        nickname: savedProfile.nickname || trimmedNickname,
        phone: savedProfile.phone,
      };

      onSuccessRef.current(userData);
    } catch (err) {
      console.error("Profile registration failed:", err);
      setErrorMessage(getFriendlyErrorMessage(err, "We couldn’t create your account just now. Check your details and try again."));
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
          {isSignUp ? "Set up your identity before starting safety check-ins." : "Sign in securely with your phone number and password."}
        </p>
      </div>

      {isSignUp ? (
        <form onSubmit={handleSignUpSubmit} className="my-auto py-4 space-y-4">
          {errorMessage && (
            <div role="alert" className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
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
              4-Digit PIN
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="pin-input"
                type="password"
                required
                inputMode="numeric"
                autoComplete="new-password"
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
              Confirm PIN
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
              <input
                id="confirm-pin-input"
                type="password"
                required
                inputMode="numeric"
                autoComplete="new-password"
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
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <>
                <span>Save Profile &amp; Continue</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </>
            )}
          </button>
        </form>
      ) : authStep === "password" && existingProfile ? (
        <form onSubmit={handlePasswordLogin} className="my-auto py-4 space-y-4">
          {errorMessage && (
            <div role="alert" className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Sign in to {existingProfile.phone} with your PIN</p>
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
              autoComplete="current-password"
              pattern="[0-9]{4}"
              maxLength={4}
              disabled={loading}
              value={loginPin}
              onChange={(event) => setLoginPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              aria-label="4-digit PIN"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-center text-lg tracking-[0.6em] text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || loginPin.length !== 4}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-md shadow-yellow-400/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
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
            <div role="alert" className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
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
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <>
                <LogIn className="w-4 h-4 text-black" />
                <span>Log In</span>
              </>
            )}
          </button>
        </form>
      )}

      {authStep === "phone" && (
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
              <span>
                Already have an account? <strong className="text-yellow-500 underline">Log In</strong>
              </span>
            ) : (
              <span>
                Don&apos;t have an account? <strong className="text-yellow-500 underline">Create Profile</strong>
              </span>
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