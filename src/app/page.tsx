"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useSpotify } from "@/hooks/useSpotify";
import { Login } from "@/components/Login";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const { status, sdk, profile, error, login, logout, reconnect } = useSpotify();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <IconLoader2 className="animate-spin text-[#1db954]" size={32} />
      </div>
    );
  }

  if (status === "authenticated" && sdk && profile) {
    return (
      <Dashboard
        sdk={sdk}
        profile={profile}
        onLogout={logout}
        onReconnect={reconnect}
      />
    );
  }

  return <Login onLogin={login} error={status === "error" ? error : null} />;
}
