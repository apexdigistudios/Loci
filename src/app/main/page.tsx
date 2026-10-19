"use client";

import React, { useEffect, useState } from "react";
import { Login, UserData } from "@/components/login";
import { MainApp } from "@/components/main-app";
import { SplashScreen } from "@/components/splash-screen";

export default function MainPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setUserPhone(window.localStorage.getItem("loci_user_phone"));
      setIsMounted(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleLoginSuccess = (data: UserData) => {
    localStorage.setItem("loci_user_phone", data.phone);
    setUserPhone(data.phone);
  };

  const handleLogout = () => {
    localStorage.removeItem("loci_user_phone");
    setUserPhone(null);
  };

  if (!isMounted) {
    return <SplashScreen />;
  }

  if (!userPhone) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return <MainApp userPhone={userPhone} onLogout={handleLogout} />;
}