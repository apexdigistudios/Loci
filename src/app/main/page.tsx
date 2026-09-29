"use client";

import React, { useState, useEffect } from "react";
import { Login, UserData } from "@/components/login";
import { MainApp } from "@/components/main-app";
import { Loader2 } from "lucide-react";

export default function MainPage() {
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedPhone = localStorage.getItem("loci_user_phone");
    if (savedPhone) {
      setUserPhone(savedPhone);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (data: UserData) => {
    localStorage.setItem("loci_user_phone", data.phone);
    setUserPhone(data.phone);
  };

  const handleLogout = () => {
    localStorage.removeItem("loci_user_phone");
    setUserPhone(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!userPhone) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return <MainApp userPhone={userPhone} onLogout={handleLogout} />;
}