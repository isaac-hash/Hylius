"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth.provider";

// Lined SVG icon components
const DashboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
);

const DeploymentsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>
);

const BillingIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
);

const AdminIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
);

const TemplatesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M2 15h10" />
        <path d="m9 18 3-3-3-3" />
    </svg>
);

const LogoutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
);

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> },
    { name: "Templates", href: "/dashboard/templates", icon: <TemplatesIcon />, badge: "✨" },
    { name: "Deployments", href: "/deployments", icon: <DeploymentsIcon /> },
    { name: "Billing", href: "/billing", icon: <BillingIcon /> },
];

export default function Sidebar({ 
    isOpen, 
    onClose 
}: { 
    isOpen?: boolean, 
    onClose?: () => void 
}) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
                    onClick={onClose}
                />
            )}

            <aside 
                className={`fixed top-0 left-0 h-screen glass border-r transition-all duration-300 z-50 flex flex-col ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                } ${
                    isCollapsed ? "md:w-20" : "md:w-64"
                } md:translate-x-0 md:static md:flex md:h-screen md:shrink-0`}
            >
                {/* Logo Section */}
                <div className="p-6 flex items-center justify-between mb-4">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] group-hover:scale-105 transition-transform shrink-0">
                            <span className="text-white text-lg">H</span>
                        </div>
                        <span className={`font-display font-bold text-xl tracking-tight animate-reveal ${isCollapsed ? "md:hidden" : "block"}`}>
                            Hylius
                        </span>
                    </Link>
                    
                    {/* Desktop Collapse Button */}
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:block p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? "→" : "←"}
                    </button>

                    {/* Mobile Close Button */}
                    <button 
                        onClick={onClose}
                        className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-gray-500"
                    >
                        ✕
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                                    isActive 
                                        ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                                }`}
                                onClick={onClose}
                            >
                                <span className="shrink-0 flex items-center justify-center">{item.icon}</span>
                                <span className={`font-medium text-sm transition-opacity duration-200 ${isCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : "opacity-100"}`}>
                                    {item.name}
                                </span>
                                {(item as any).badge && !isCollapsed ? (
                                    <span className="ml-auto text-xs">{(item as any).badge}</span>
                                ) : isActive && !isCollapsed ? (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] md:block hidden"></div>
                                ) : null}
                            </Link>
                        );
                    })}

                    {user?.role === 'PLATFORM_ADMIN' && (
                        <div className="pt-4 mt-4 border-t border-white/10">
                            <Link
                                href="/admin"
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                                    pathname.startsWith("/admin")
                                        ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                                }`}
                                onClick={onClose}
                            >
                                <span className="shrink-0 flex items-center justify-center"><AdminIcon /></span>
                                <span className={`font-medium text-sm ${isCollapsed ? "md:hidden" : "block"}`}>Admin Panel</span>
                            </Link>
                        </div>
                    )}
                </nav>

                {/* User Profile / Logout */}
                <div className="p-4 mt-auto border-t border-white/5">
                    <div className={`flex items-center gap-3 px-2 py-3 rounded-2xl ${isCollapsed ? "md:justify-center" : "bg-white/5"}`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        <div className={`flex-1 min-w-0 ${isCollapsed ? "md:hidden" : "block"}`}>
                                <p className="text-xs font-semibold truncate text-white">{user?.email}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{user?.role}</p>
                        </div>
                    </div>
                    
                    <button
                        onClick={logout}
                        className={`w-full mt-3 flex items-center gap-3 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 ${isCollapsed ? "md:justify-center" : ""}`}
                    >
                        <span className="flex items-center justify-center"><LogoutIcon /></span>
                        <span className={`${isCollapsed ? "md:hidden" : "block"}`}>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
