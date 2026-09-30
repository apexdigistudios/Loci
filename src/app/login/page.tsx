"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Login, UserData } from "@/components/login";

export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = (data: UserData) => {
    localStorage.setItem("loci_user_phone", data.phone);
    router.push("/main");
  };

  return <Login onSuccess={handleLoginSuccess} />;
}