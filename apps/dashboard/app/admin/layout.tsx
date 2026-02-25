"use client";

import { useAuth } from "@/providers/auth.provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'PLATFORM_ADMIN') {
                router.push('/');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading || !user || user.role !== 'PLATFORM_ADMIN') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const navItems = [
        { name: 'Users', path: '/admin/users' },
        { name: 'Organizations', path: '/admin/organizations' },
        { name: 'Billing Plans', path: '/admin/plans' },
        { name: 'Transactions', path: '/admin/transactions' },
        { name: 'Activity Log', path: '/admin/activity' }
    ];

    return (
        <div className="min-h-screen bg-black text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-gray-800 bg-gray-950 p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-10">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold">A</div>
                    <span className="font-bold text-xl tracking-tight text-red-500">Platform Admin</span>
                </div>

                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`block px-4 py-2 rounded-md transition-colors ${pathname.startsWith(item.path)
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-gray-900'
                                }`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="mt-8 pt-6 border-t border-gray-800">
                    <Link href="/" className="text-sm text-gray-500 hover:text-white transition-colors">
                        ← Back to App
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
