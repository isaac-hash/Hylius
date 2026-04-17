/**
 * Lightweight markdown → HTML converter used server-side.
 * No npm packages required — pure regex transforms.
 * Supports: headings, bold/italic, inline code, code blocks,
 * tables, blockquotes, GitHub alerts, horizontal rules, lists, links.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert GitHub-flavoured alerts inside a blockquote's first paragraph */
function processAlert(inner: string): string {
  const alertMap: Record<string, { label: string; color: string }> = {
    NOTE:      { label: '📘 Note',      color: '#2f81f7' },
    TIP:       { label: '💡 Tip',       color: '#3fb950' },
    IMPORTANT: { label: '⚠️ Important', color: '#a371f7' },
    WARNING:   { label: '⚡ Warning',   color: '#d29922' },
    CAUTION:   { label: '🔴 Caution',   color: '#f85149' },
  };

  const match = inner.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
  if (!match) return inner;

  const type = match[1].toUpperCase() as keyof typeof alertMap;
  const rest = inner.slice(match[0].length);
  const { label, color } = alertMap[type];

  return `<div style="border-left:3px solid ${color};background:${color}18;border-radius:0 8px 8px 0;padding:0.85rem 1.25rem;margin:1.25rem 0;">
    <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.35rem;color:${color}">${label}</div>
    <div style="color:#c9d1d9">${rest}</div>
  </div>`;
}

/** Apply inline styles (bold, italic, inline-code, links) */
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Highlight code blocks with simple color tokens.
 * We escape HTML FIRST, then use CSS class spans.
 * The spans use a unique placeholder to avoid escaping issues,
 * then we swap them to real HTML at the end.
 */
function colorWrap(text: string, color: string): string {
  return `<span style="color:${color}">${text}</span>`;
}

function tokeniseCode(code: string, lang: string): string {
  // First, fully escape HTML entities in the raw code
  const escaped = escapeHtml(code);

  // For highlighting, we simply wrap matched text in styled spans.
  // Because escapeHtml already ran, we can safely inject our spans now
  // since the code content has no raw HTML tags left.

  if (['bash', 'sh', 'shell'].includes(lang)) {
    return escaped
      .replace(/(#[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
      .replace(/\b(npm|npx|curl|cat|echo|ufw|apt-get|apk|ssh|git|docker|hylius|tar|nano|composer|ssh-copy-id)\b/g,
        (m) => colorWrap(m, '#ffa657'))
      .replace(/(&quot;|&#39;)((?:(?!&quot;|&#39;).)*)\1/g,
        (m, q, inner) => colorWrap(`${q}${inner}${q}`, '#a5d6ff'));
  }

  if (['json'].includes(lang)) {
    return escaped
      .replace(/(&quot;(?:(?!&quot;).)*&quot;)\s*:/g, (m, key) => `${colorWrap(key, '#79c0ff')}:`)
      .replace(/:\s*(&quot;(?:(?!&quot;).)*&quot;)/g, (m, val) => `: ${colorWrap(val, '#a5d6ff')}`)
      .replace(/:\s*(true|false|null)\b/g, (m, val) => `: ${colorWrap(val, '#ff7b72')}`)
      .replace(/:\s*(\d+)/g, (m, val) => `: ${colorWrap(val, '#79c0ff')}`);
  }

  if (['yaml', 'yml'].includes(lang)) {
    return escaped
      .replace(/(#[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
      .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*):/gm,
        (m, ws, key) => `${ws}${colorWrap(key, '#79c0ff')}:`);
  }

  if (['python', 'py'].includes(lang)) {
    return escaped
      .replace(/(#[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
      .replace(/\b(import|from|def|class|if|else|elif|return|async|await|for|in|while|with|as|try|except|raise|not|and|or|True|False|None)\b/g,
        (m) => colorWrap(m, '#ff7b72'))
      .replace(/(&quot;(?:(?!&quot;).)*&quot;)/g, (m) => colorWrap(m, '#a5d6ff'));
  }

  if (['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'].includes(lang)) {
    return escaped
      .replace(/(\/\/[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
      .replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|new|this|async|await|default|type|interface|extends|implements)\b/g,
        (m) => colorWrap(m, '#ff7b72'))
      .replace(/(&quot;(?:(?!&quot;).)*&quot;)/g, (m) => colorWrap(m, '#a5d6ff'));
  }

  return escaped;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──────────────────────────────────────
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const raw = codeLines.join('\n');
      const highlighted = tokeniseCode(raw, lang);
      const label = lang ? `<span style="position:absolute;top:0.6rem;right:0.9rem;font-size:0.7rem;color:#484f58;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.06em">${lang}</span>` : '';
      out.push(`<pre style="position:relative">${label}<code>${highlighted}</code></pre>`);
      i++;
      continue;
    }

    // ── Blockquote / GitHub alert ──────────────────────────────
    if (line.startsWith('> ')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      const inner = inline(bqLines.join(' '));
      const alertHtml = processAlert(inner);
      if (alertHtml !== inner) {
        out.push(alertHtml);
      } else {
        out.push(`<blockquote><p>${inner}</p></blockquote>`);
      }
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push('<hr />');
      i++;
      continue;
    }

    // ── Headings ─────────────────────────────────────────────
    const h = line.match(/^(#{1,6})\s+(.+)/);
    if (h) {
      const level = h[1].length;
      const text = inline(h[2]);
      const id = h[2].toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      out.push(`<h${level} id="${id}">${text}</h${level}>`);
      i++;
      continue;
    }

    // ── Table ─────────────────────────────────────────────────
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
      const headerCells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr.length === 1));
      const rows: string[][] = [];
      i += 2; // skip separator
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr.length === 1)));
        i++;
      }
      const thead = headerCells.map(c => `<th>${inline(c.trim())}</th>`).join('');
      const tbody = rows.map(r => `<tr>${r.map(c => `<td>${inline(c.trim())}</td>`).join('')}</tr>`).join('');
      out.push(`<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`);
      continue;
    }

    // ── Unordered list ────────────────────────────────────────
    if (/^[-*+] /.test(line)) {
      out.push('<ul>');
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^[-*+] /, ''))}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push('</ol>');
      continue;
    }

    // ── Empty line ────────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('>') && !lines[i].startsWith('---')) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${inline(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}
