"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { docsSections } from "@/lib/nav";

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

function SearchIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const Sidebar = () => (
    <aside style={{
      width: "272px",
      flexShrink: 0,
      height: "100vh",
      position: "sticky",
      top: 0,
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid var(--border)",
      background: "var(--bg-2)",
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32,
            background: "linear-gradient(135deg,#2563eb,#7c3aed)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 16, color: "white",
            boxShadow: "0 0 16px rgba(37,99,235,0.4)",
          }}>H</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", lineHeight: 1.1 }}>Hylius</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.05em" }}>DOCS</div>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0.45rem 0.75rem",
          cursor: "text",
          color: "var(--text-muted)",
          fontSize: "0.82rem",
        }}>
          <SearchIcon />
          <span>Search docs…</span>
          <span style={{ marginLeft: "auto", fontSize: "0.72rem", background: "var(--bg-3)", padding: "0.1rem 0.35rem", borderRadius: 4, border: "1px solid var(--border)" }}>⌘K</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "1rem 0.75rem", overflowY: "auto" }}>
        {docsSections.map(section => (
          <div key={section.title} style={{ marginBottom: "1.5rem" }}>
            <div style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-dim)",
              padding: "0 0.75rem",
              marginBottom: "0.35rem",
            }}>
              {section.title}
            </div>
            {section.items.map(item => {
              const href = `/${item.slug}`;
              const active = pathname === href;
              return (
                <Link
                  key={item.slug}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    padding: "0.45rem 0.75rem",
                    borderRadius: 7,
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 400,
                    color: active ? "#fff" : "var(--text-muted)",
                    background: active ? "rgba(47,129,247,0.12)" : "transparent",
                    border: `1px solid ${active ? "rgba(47,129,247,0.25)" : "transparent"}`,
                    textDecoration: "none",
                    transition: "all 0.15s",
                    marginBottom: "0.1rem",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ fontSize: "0.85rem" }}>{item.icon}</span>
                  {item.label}
                  {active && (
                    <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#2f81f7", boxShadow: "0 0 8px #2f81f7" }} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
        <a
          href="http://localhost:3000"
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            fontSize: "0.8rem", color: "var(--text-muted)", textDecoration: "none",
            padding: "0.5rem 0.75rem", borderRadius: 7,
            border: "1px solid var(--border)",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Back to Dashboard
        </a>
      </div>
    </aside>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      <div className="desktop-sidebar">
        <Sidebar />
      </div>

      {/* Mobile header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(8,12,20,0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
      }} className="mobile-header">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#2563eb,#7c3aed)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff" }}>H</div>
          <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>Hylius Docs</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem" }}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }} className="mobile-sidebar">
          <div onClick={() => setMobileOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", zIndex: 1, width: 280 }}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, padding: "3rem 3rem 6rem" }}>
        <div className="fade-up">
          {children}
        </div>
      </main>

      <style>{`
        .desktop-sidebar { display: flex; }
        .mobile-header { display: none; }
        .mobile-sidebar { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .mobile-header { display: flex; }
          .mobile-sidebar { display: flex; }
          main { padding: 5rem 1.25rem 4rem !important; }
        }
      `}</style>
    </div>
  );
}
