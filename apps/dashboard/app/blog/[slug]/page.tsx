import Link from "next/link";
import { getPostData, getSortedPostsData } from "@/lib/blog";
import { simpleMarkdownToHtml } from "@/lib/markdown";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const posts = getSortedPostsData();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const postData = getPostData(slug);
  if (!postData) {
    return {
      title: "Post Not Found",
    };
  }
  return {
    title: `${postData.title} | Hylius Blog`,
    description: postData.excerpt,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const postData = getPostData(slug);

  if (!postData) {
    notFound();
  }

  const htmlContent = simpleMarkdownToHtml(postData.content);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <nav className="w-full py-6 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 group cursor-pointer">
            <span className="text-gray-400 group-hover:text-white transition-colors">← Back to Blog</span>
          </Link>
          <Link href="/" className="font-display font-bold text-xl tracking-tight">Hylius</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20">
        <article>
          <header className="mb-14 text-center">
            <time className="text-blue-500 text-sm font-mono mb-4 block">
              {new Date(postData.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </time>
            <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-6">
              {postData.title}
            </h1>
          </header>
          
          <div 
            className="prose prose-invert prose-blue max-w-none prose-p:text-gray-300 prose-headings:text-white prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
        </article>
      </main>
      
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
               <span className="text-lg">H</span>
           </div>
           <span className="font-display font-bold tracking-tight">Hylius</span>
        </div>
        <div className="text-sm text-gray-500">
           © 2026 Hylius Cloud. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
