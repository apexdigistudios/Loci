import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface PublicProfile {
  id: string;
  phone: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export interface PhoneAuthInput {
  phone: string;
  fullName: string;
  nickname: string;
  pin: string;
  referrerCode?: string | null;
}

export function proxyEmailForPhone(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.deloci.app`;
}

function passwordForPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Enter a valid 4-digit PIN.");
  return pin + pin;
}

async function getProfileForAuthUser(user: User): Promise<PublicProfile> {
  const { data, error } = await supabase
    .from("users")
    .select("id, phone, full_name, nickname, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new Error("Your account profile could not be loaded. Please try again.");
  }
  return data;
}

export async function signUpWithPhone(input: PhoneAuthInput): Promise<PublicProfile> {
  const phone = input.phone.trim();
  const email = proxyEmailForPhone(phone);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: passwordForPin(input.pin),
    options: {
      data: {
        full_name: input.fullName.trim(),
        nickname: input.nickname.trim(),
        phone,
        ...(input.referrerCode ? { referrer_code: input.referrerCode.trim().slice(0, 120) } : {}),
      },
    },
  });

  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error("Phone-based accounts require email confirmation to be disabled in Supabase Auth.");
  }

  return getProfileForAuthUser(data.user);
}

export async function signInWithPhone(phone: string, pin: string): Promise<PublicProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: proxyEmailForPhone(phone.trim()),
    password: passwordForPin(pin),
  });

  if (error) throw error;
  if (!data.user) throw new Error("We couldn’t finish signing you in. Please try again.");
  return getProfileForAuthUser(data.user);
}

export async function getCurrentProfile(): Promise<PublicProfile | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return getProfileForAuthUser(data.user);
}

export async function lookupReferrer(code: string): Promise<{ full_name: string | null; nickname: string | null } | null> {
  const { data, error } = await supabase.rpc("lookup_referrer", { ref_code: code.trim().slice(0, 120) });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return result && typeof result === "object"
    ? { full_name: result.full_name ?? null, nickname: result.nickname ?? null }
    : null;
}