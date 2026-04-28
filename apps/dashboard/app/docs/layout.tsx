"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { docsSections } from "@/lib/docs";

function MenuIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const Sidebar = () => (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-white/10 bg-[#050505] overflow-y-auto">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-base shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            H
          </div>
          <div>
            <div className="font-bold text-sm leading-tight text-white mb-0.5 font-display">Hylius</div>
            <div className="text-[0.65rem] text-blue-400 tracking-widest font-bold">DOCS</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {docsSections.map(section => (
          <div key={section.title} className="mb-8">
            <div className="text-[0.7rem] font-bold uppercase tracking-widest text-gray-500 px-3 mb-3">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map(item => {
                const href = `/docs/${item.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all border ${
                      active 
                        ? 'text-white bg-blue-500/10 border-blue-500/20 font-semibold shadow-inner' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent font-medium'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white hover:border-gray-500 px-3 py-2.5 rounded-lg border border-white/10 transition-colors bg-white/5"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="font-semibold">Back to Dashboard</span>
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#050505] text-gray-300 antialiased font-sans">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-xs text-white">H</div>
          <span className="font-bold text-white text-sm font-display tracking-wide">Hylius Docs</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-gray-400"
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative z-10 w-72 max-w-[80vw]">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 px-6 py-24 md:p-12 lg:p-20 overflow-x-hidden selection:bg-blue-500/30 text-base leading-loose">
        <div className="max-w-3xl mx-auto animate-reveal">
          {children}
        </div>
      </main>
    </div>
  );
}
