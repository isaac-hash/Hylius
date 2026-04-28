import { notFound } from "next/navigation";
import path from "path";
import fs from "fs";
import type { Metadata } from "next";
import { docsSections, getDocBySlug } from "@/lib/docs";
import { simpleMarkdownToHtml } from "@/lib/markdown";
import DocsClient from "./DocsClient";

// Since content/docs is adjacent to content/blog
const DOCS_DIR = path.resolve(process.cwd(), "content/docs");

export async function generateStaticParams() {
  return docsSections.flatMap(s => s.items.map(i => ({ slug: i.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return {};
  return {
    title: `${doc.label} | Hylius Docs`,
    description: `Hylius documentation — ${doc.label}`,
  };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  let content = "";

  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf-8");
  } else {
    content = `# ${doc.label}\n\nDocumentation for this page is coming soon.`;
  }

  const html = simpleMarkdownToHtml(content);

  // Build previous/next navigation
  const allItems = docsSections.flatMap(s => s.items);
  const currentIdx = allItems.findIndex(i => i.slug === slug);
  const prev = currentIdx > 0 ? allItems[currentIdx - 1] : null;
  const next = currentIdx < allItems.length - 1 ? allItems[currentIdx + 1] : null;

  return <DocsClient html={html} prev={prev} next={next} label={doc.label} />;
}
