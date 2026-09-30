"use client";

import React, { useState, useEffect } from "react";
import { User, UserCheck, Phone, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface UserData {
  fullName: string;
  nickname: string;
  phone: string;
}

interface LoginProps {
  onSuccess: (data: UserData) => void;
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

export function Login({ onSuccess }: LoginProps) {
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [detectedCountry, setDetectedCountry] = useState<CountryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
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
      } else {
        setDetectedCountry(COUNTRIES[0]);
      }
    } catch {
      setDetectedCountry(COUNTRIES[0]);
    }
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhone(val);

    const cleanVal = val.trim();
    if (cleanVal.startsWith("+") || cleanVal.length >= 2) {
      const match = COUNTRIES.find((c) => cleanVal.startsWith(c.prefix));
      if (match) {
        setDetectedCountry(match);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedFullName = fullName.trim();
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    let formattedPhone = phone.trim();
    if (detectedCountry && !formattedPhone.startsWith("+")) {
      const digitsOnly = formattedPhone.replace(/^0+/, "");
      formattedPhone = `${detectedCountry.prefix}${digitsOnly}`;
    }

    if (!trimmedFullName || !trimmedNickname || !trimmedEmail || !password || !formattedPhone) return;

    setLoading(true);

    // 1. Authenticate with Supabase Auth (creates user in auth.users)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: password,
      options: {
        data: {
          full_name: trimmedFullName,
          nickname: trimmedNickname,
          phone: formattedPhone,
        },
      },
    });

    let authUser = authData?.user;

    // If existing account, attempt login with password
    if (signUpError && signUpError.message.toLowerCase().includes("already registered")) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (signInError) {
        setLoading(false);
        setErrorMessage(signInError.message);
        return;
      }
      authUser = signInData?.user;
    } else if (signUpError) {
      setLoading(false);
      setErrorMessage(signUpError.message);
      return;
    }

    // 2. Save/Update user profile in public.users table
    const { error: dbError } = await supabase.from("users").upsert(
      {
        id: authUser?.id,
        full_name: trimmedFullName,
        nickname: trimmedNickname,
        email: trimmedEmail,
        phone: formattedPhone,
      },
      { onConflict: "email" }
    );

    setLoading(false);

    if (dbError) {
      setErrorMessage(dbError.message);
      return;
    }

    onSuccess({
      fullName: trimmedFullName,
      nickname: trimmedNickname,
      phone: formattedPhone,
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between p-6 max-w-md mx-auto w-full select-none">
      {/* Brand Header */}
      <div className="pt-6">
        <img src="/logo.png" alt="Loci Logo" className="h-10 w-auto object-contain mb-4" />
        <h1 className="text-2xl font-extrabold tracking-tight text-black dark:text-white">
          Create Your Loci Profile
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
          Set up your identity before starting safety check-ins.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="my-auto py-4 space-y-4">
        {errorMessage && (
          <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* 1. Full Name */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Full Name
          </label>
          <div className="relative flex items-center">
            <User className="w-4 h-4 absolute left-4 text-zinc-400" />
            <input
              type="text"
              required
              disabled={loading}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* 2. Nickname */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Nickname (Known to contacts)
          </label>
          <div className="relative flex items-center">
            <UserCheck className="w-4 h-4 absolute left-4 text-zinc-400" />
            <input
              type="text"
              required
              disabled={loading}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* 3. Email Address (Auth Login) */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Email Address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 absolute left-4 text-zinc-400" />
            <input
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* 4. Password */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
            Password
          </label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 absolute left-4 text-zinc-400" />
            <input
              type="password"
              required
              minLength={6}
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm text-black dark:text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* 5. Phone Number */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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

        {/* Yellow Action Button */}
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

      <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center pb-2">
        Loci safety check-ins require explicit consent. No continuous tracking.
      </p>
    </div>
  );
}