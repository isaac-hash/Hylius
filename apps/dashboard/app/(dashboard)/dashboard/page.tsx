"use client";
export const dynamic = 'force-dynamic';

import ServerList from "@/components/ServerList";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background text-foreground selection:bg-blue-500/30">

        <main className="py-6">
          <header className="mb-12 animate-reveal">
            <h1 className="font-display text-4xl font-bold mb-2 tracking-tight text-white">Dashboard</h1>
            <p className="text-gray-400 max-w-2xl">Manage your high-performance infrastructure, cloud deployments, and runtime monitoring.</p>
          </header>

          <ServerList />
        </main>
      </div>
    </AuthGuard>
  );
}

