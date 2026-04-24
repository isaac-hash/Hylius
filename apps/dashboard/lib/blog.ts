import fs from 'fs';
import path from 'path';

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
}

const blogsDirectory = path.join(process.cwd(), 'content', 'blog');

// Very basic regex parser as a fallback when gray-matter is not used.
function parseMarkdown(fileContents: string) {
  const match = fileContents.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { data: {}, content: fileContents };
  }

  const frontmatterStr = match[1];
  const content = match[2];

  const data: Record<string, string> = {};
  frontmatterStr.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Remove surrounding quotes if they exist
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    }
  });

  return { data, content };
}

export function getSortedPostsData(): BlogPost[] {
  if (!fs.existsSync(blogsDirectory)) {
    return [];
  }
  
  const fileNames = fs.readdirSync(blogsDirectory);
  const allPostsData = fileNames
    .filter(fileName => fileName.endsWith('.md'))
    .map(fileName => {
      // Remove ".md" from file name to get id
      const slug = fileName.replace(/\.md$/, '');

      // Read markdown file as string
      const fullPath = path.join(blogsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      const { data, content } = parseMarkdown(fileContents);

      return {
        slug,
        title: data.title || slug,
        date: data.date || '',
        excerpt: data.excerpt || '',
        content,
      };
    });

  // Sort posts by date
  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getPostData(slug: string): BlogPost | undefined {
  const fullPath = path.join(blogsDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return undefined;
  
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = parseMarkdown(fileContents);

  return {
    slug,
    title: data.title || slug,
    date: data.date || '',
    excerpt: data.excerpt || '',
    content,
  };
}
