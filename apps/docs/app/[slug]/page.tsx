import { notFound } from "next/navigation";
import path from "path";
import fs from "fs";
import type { Metadata } from "next";
import DocsLayout from "@/components/DocsLayout";
import { docsSections, getDocBySlug } from "@/lib/nav";
import { markdownToHtml } from "@/lib/markdown";
import DocsPageClient from "./DocsPageClient";

// The shared docs/ directory is two levels up from apps/docs
const DOCS_DIR = path.resolve(process.cwd(), "../../docs");

export async function generateStaticParams() {
  return docsSections.flatMap(s => s.items.map(i => ({ slug: i.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return {};
  return {
    title: doc.label,
    description: `Hylius documentation — ${doc.label}`,
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  // Try the shared docs dir, else fall back to a local docs dir
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  let content = "";

  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  } else {
    // Fallback: look in a local docs directory
    const localPath = path.join(process.cwd(), "docs", `${slug}.md`);
    if (fs.existsSync(localPath)) {
      content = fs.readFileSync(localPath, "utf-8");
    } else {
      content = `# ${doc.label}\n\nDocumentation for this page is coming soon.`;
    }
  }

  const html = markdownToHtml(content);

  // Build previous/next navigation
  const allItems = docsSections.flatMap(s => s.items);
  const currentIdx = allItems.findIndex(i => i.slug === slug);
  const prev = currentIdx > 0 ? allItems[currentIdx - 1] : null;
  const next = currentIdx < allItems.length - 1 ? allItems[currentIdx + 1] : null;

  return (
    <DocsLayout>
      <DocsPageClient html={html} prev={prev} next={next} label={doc.label} />
    </DocsLayout>
  );
}
