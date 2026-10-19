"use client";

import React, { useState } from "react";
import { Login, UserData } from "@/components/login";
import { MainApp } from "@/components/main-app";
import { SplashScreen } from "@/components/splash-screen";
import { endNotificationSession } from "@/lib/notification-session";

export default function MainPage() {
  const [userPhone, setUserPhone] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("loci_user_phone");
  });

  const loading = false;

  const handleLoginSuccess = (data: UserData) => {
    localStorage.setItem("loci_user_phone", data.phone);
    setUserPhone(data.phone);
  };

  const handleLogout = () => {
    void endNotificationSession();
    localStorage.removeItem("loci_user_phone");
    setUserPhone(null);
  };

  if (loading) {
    return <SplashScreen />;
  }

  if (!userPhone) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return <MainApp userPhone={userPhone} onLogout={handleLogout} />;
}