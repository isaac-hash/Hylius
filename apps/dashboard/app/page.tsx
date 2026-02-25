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
      <div className="min-h-screen bg-black text-white">
        <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">H</div>
              <span className="font-bold text-xl tracking-tight">Hylius</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/deployments" className="hover:text-white transition-colors">
                Deployments
              </Link>
              <Link href="/billing" className="hover:text-white transition-colors">
                Billing
              </Link>
              <a href="https://github.com/isaac-hash/hylius" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                Documentation
              </a>
              {user?.role === 'PLATFORM_ADMIN' && (
                <Link href="/admin" className="text-red-400 font-medium hover:text-red-300 transition-colors ml-4 border-l border-gray-800 pl-4">
                  Admin
                </Link>
              )}

              <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
                <span className="text-gray-300">{user?.email}</span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white transition-colors text-xs"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-12">
          <header className="mb-12">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-gray-400">Manage your infrastructure and deployments.</p>
          </header>

          <ServerList />
        </main>
      </div>
    </AuthGuard>
  );
}
