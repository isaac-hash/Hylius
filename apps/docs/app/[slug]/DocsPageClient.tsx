"use client";

import Link from "next/link";

interface NavItem {
  slug: string;
  label: string;
  icon: string;
}

interface Props {
  html: string;
  label: string;
  prev: NavItem | null;
  next: NavItem | null;
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function DocsPageClient({ html, label, prev, next }: Props) {
  return (
    <article style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Prose content */}
      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ paddingBottom: "2rem" }}
      />

      {/* Prev / Next navigation */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        paddingTop: "2.5rem",
        marginTop: "2.5rem",
        borderTop: "1px solid var(--border)",
      }}>
        {prev ? (
          <Link
            href={`/${prev.slug}`}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "1rem 1.25rem",
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              textDecoration: "none",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
              transition: "all 0.15s",
              flex: 1,
              maxWidth: "48%",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <ChevronLeft />
            <div>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem", color: "var(--text-dim)" }}>Previous</div>
              <div style={{ fontWeight: 600, color: "inherit" }}>{prev.label}</div>
            </div>
          </Link>
        ) : <div />}

        {next ? (
          <Link
            href={`/${next.slug}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.75rem",
              padding: "1rem 1.25rem",
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              textDecoration: "none",
              color: "var(--text-muted)",
              fontSize: "0.875rem",
              transition: "all 0.15s",
              flex: 1,
              maxWidth: "48%",
              textAlign: "right",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--blue)";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <div>
              <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem", color: "var(--text-dim)" }}>Next</div>
              <div style={{ fontWeight: 600, color: "inherit" }}>{next.label}</div>
            </div>
            <ChevronRight />
          </Link>
        ) : <div />}
      </div>

      {/* Edit on GitHub */}
      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <a
          href={`https://github.com/isaac-hash/hylius/tree/main/docs`}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: "0.78rem",
            color: "var(--text-dim)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58l-.01-2.25c-3.34.72-4.04-1.41-4.04-1.41-.54-1.38-1.33-1.74-1.33-1.74-1.08-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 013-.4c1.02.005 2.04.14 3 .4 2.28-1.55 3.28-1.23 3.28-1.23.64 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Edit this page on GitHub
        </a>
      </div>
    </article>
  );
}
