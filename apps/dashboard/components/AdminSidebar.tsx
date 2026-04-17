"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth.provider";

const navItems = [
    { name: 'Users', path: '/admin/users', icon: '👥' },
    { name: 'Organizations', path: '/admin/organizations', icon: '🏢' },
    { name: 'Servers', path: '/admin/servers', icon: '🖥️' },
    { name: 'Deployments', path: '/admin/deployments', icon: '🚀' },
    { name: 'Billing Plans', path: '/admin/plans', icon: '💳' },
    { name: 'Transactions', path: '/admin/transactions', icon: '💰' },
    { name: 'Activity Log', path: '/admin/activity', icon: '📋' }
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside 
            className={`fixed top-0 left-0 h-full glass border-r transition-all duration-300 z-50 flex flex-col ${
                isCollapsed ? "w-20" : "w-64"
            } md:relative md:flex`}
        >
            {/* Logo Section */}
            <div className="p-6 flex items-center justify-between mb-4">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] group-hover:scale-105 transition-transform shrink-0">
                        <span className="text-white text-lg">A</span>
                    </div>
                    {!isCollapsed && (
                        <span className="font-display font-bold text-xl tracking-tight text-blue-400 animate-reveal">Platform Admin</span>
                    )}
                </Link>
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden md:block p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? "→" : "←"}
                </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                                isActive 
                                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                            }`}
                        >
                            <span className="text-xl shrink-0">{item.icon}</span>
                            {!isCollapsed && (
                                <span className={`font-medium text-sm transition-opacity duration-200 ${isCollapsed ? "opacity-0" : "opacity-100"}`}>
                                    {item.name}
                                </span>
                            )}
                            {isActive && !isCollapsed && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                            )}
                        </Link>
                    );
                })}

                <div className="pt-4 mt-4 border-t border-white/10">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all group text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    >
                        <span className="text-xl shrink-0">←</span>
                        {!isCollapsed && (
                            <span className="font-medium text-sm">Back to App</span>
                        )}
                    </Link>
                </div>
            </nav>

            {/* User Profile / Logout */}
            <div className="p-4 mt-auto border-t border-white/5">
                <div className={`flex items-center gap-3 px-2 py-3 rounded-2xl ${isCollapsed ? "justify-center" : "bg-white/5"}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {user?.email?.[0].toUpperCase() || 'A'}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate text-white">{user?.email}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">{user?.role}</p>
                        </div>
                    )}
                </div>
                {!isCollapsed && (
                    <button
                        onClick={logout}
                        className="w-full mt-3 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                    >
                        Logout
                    </button>
                )}
                {isCollapsed && (
                    <button
                        onClick={logout}
                        className="w-full mt-3 flex justify-center text-gray-500 hover:text-red-400 transition-colors"
                        title="Logout"
                    >
                        🚪
                    </button>
                )}
            </div>
        </aside>
    );
}
