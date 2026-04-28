function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colorWrap(text: string, color: string): string {
    return `<span style="color:${color}">${text}</span>`;
}

function tokeniseCode(code: string, lang: string): string {
    const escaped = escapeHtml(code);
    if (['bash', 'sh', 'shell'].includes(lang)) {
        return escaped
            .replace(/(#[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
            .replace(/\b(npm|npx|curl|cat|echo|ufw|apt-get|apk|ssh|git|docker|hylius|tar|nano|composer|ssh-copy-id)\b/g, (m) => colorWrap(m, '#ffa657'))
            .replace(/(&quot;|&#39;)((?:(?!&quot;|&#39;).)*)\1/g, (m, q, inner) => colorWrap(`${q}${inner}${q}`, '#a5d6ff'));
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
            .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*):/gm, (m, ws, key) => `${ws}${colorWrap(key, '#79c0ff')}:`);
    }
    if (['python', 'py'].includes(lang)) {
        return escaped
            .replace(/(#[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
            .replace(/\b(import|from|def|class|if|else|elif|return|async|await|for|in|while|with|as|try|except|raise|not|and|or|True|False|None)\b/g, (m) => colorWrap(m, '#ff7b72'))
            .replace(/(&quot;(?:(?!&quot;).)*&quot;)/g, (m) => colorWrap(m, '#a5d6ff'));
    }
    if (['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'].includes(lang)) {
        return escaped
            .replace(/(\/\/[^<]*)$/gm, (m) => colorWrap(m, '#8b949e'))
            .replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|new|this|async|await|default|type|interface|extends|implements)\b/g, (m) => colorWrap(m, '#ff7b72'))
            .replace(/(&quot;(?:(?!&quot;).)*&quot;)/g, (m) => colorWrap(m, '#a5d6ff'));
    }
    return escaped;
}

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
  
    return `<div style="border-left:3px solid ${color};background:${color}18;border-radius:0 8px 8px 0;padding:1rem 1.25rem;margin:1.5rem 0;" class="text-sm">
      <div style="font-weight:bold;margin-bottom:0.5rem;color:${color}">${label}</div>
      <div class="text-gray-300 leading-relaxed">${rest}</div>
    </div>`;
}

export function simpleMarkdownToHtml(markdown: string): string {
    // Fix Windows CRLF issues that break multi-line regexes
    let html = markdown.replace(/\r\n/g, '\n');
    
    // Save code blocks to prevent inner interference
    const codeBlocks: string[] = [];
    html = html.replace(/```([a-z]*)\n([\s\S]*?)\n```/gim, (match, lang, code) => {
        const highlighted = tokeniseCode(code, lang || 'text');
        const langLabel = lang ? `<span style="position:absolute;top:0.6rem;right:0.9rem;font-size:0.7rem;color:#484f58;font-family:monospace;text-transform:uppercase;letter-spacing:0.06em">${lang}</span>` : '';
        const blockHtml = `<pre class="relative bg-black/50 border border-white/10 p-4 rounded-xl overflow-x-auto my-6 text-sm text-gray-300 shadow-xl">${langLabel}<code>${highlighted}</code></pre>`;
        codeBlocks.push(blockHtml);
        return `@@CODEBLOCK_${codeBlocks.length - 1}@@`;
    });

    // Save inline code
    const inlineCodes: string[] = [];
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
        const escaped = escapeHtml(code);
        inlineCodes.push(`<code class="bg-blue-500/10 text-blue-300 font-semibold px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-blue-500/20">${escaped}</code>`);
        return `@@INLINECODE_${inlineCodes.length - 1}@@`;
    });

    // Process tables
    html = html.replace(/(?:^\|.*\|$\n?)+/gim, (match) => {
        const rows = match.trim().split('\n');
        let tableHtml = '<div class="overflow-x-auto my-8"><table class="w-full text-left border-collapse text-sm">';
        rows.forEach((row, index) => {
            // Ignore the structure line
            if (row.includes('|---') || row.includes('|:---') || row.includes('| ---') || /\|[\s-]+\|/.test(row)) return;
            const parts = row.split('|');
            const cells = parts.slice(1, parts.length - 1).map(c => c.trim());
            tableHtml += '<tr class="border-b border-white/10 hover:bg-white/5">';
            cells.forEach(cell => {
                if (index === 0) {
                    tableHtml += `<th class="p-4 font-bold bg-white/5 text-gray-200">${cell}</th>`;
                } else {
                    tableHtml += `<td class="p-4 text-gray-400">${cell}</td>`;
                }
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</table></div>';
        return tableHtml;
    });

    // Convert horizontal rules
    html = html.replace(/^\s*---\s*$/gm, '<hr class="border-white/10 my-12" />');

    // Convert blockquotes & alerts
    html = html.replace(/^\s*>\s+([\s\S]*?)(?=\n\n|\n$|$)/gm, (match, p1) => {
        const singleLine = p1.replace(/\n\s*>\s+/g, ' ');
        const alertHtml = processAlert(singleLine);
        if (alertHtml !== singleLine) return alertHtml;
        return `<blockquote class="border-l-4 border-blue-500 pl-4 py-2 italic text-gray-400 my-6 bg-blue-500/5">${singleLine}</blockquote>`;
    });

    // Convert headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-2xl font-bold mt-8 mb-4">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-3xl font-bold mt-10 mb-4">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold mt-12 mb-6">$1</h1>');
    
    // Convert bold and italic
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Convert images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="rounded-xl border border-white/10 shadow-lg mt-8 mb-6 mx-auto w-full" />');
    
    // Convert links
    html = html.replace(/(?<!<img[^>]*|\!)\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-500 hover:underline">$1</a>');
    
    // Convert lists
    html = html.replace(/^\s*-\s+(.*)$/gim, '<li class="ml-6 list-disc mb-2 text-gray-300">$1</li>');
    
    // Wrap paragraphs - simple multi-line separation
    const blocks = html.split(/\n\s*\n/);
    html = blocks.map(block => {
        const tBlock = block.trim();
        if (tBlock.startsWith('<h') || tBlock.startsWith('<li') || tBlock.startsWith('<img') || 
            tBlock.startsWith('<!--') || tBlock.startsWith('<div') || tBlock.startsWith('<pre') || 
            tBlock.startsWith('<hr') || tBlock.startsWith('<blockquote') || tBlock.startsWith('@@CODEBLOCK_')) {
            if (tBlock.startsWith('<li')) {
                return `<ul class="mb-6">${block}</ul>`;
            }
            return block;
        }
        if (!tBlock) return '';
        return `<p class="mb-6 leading-relaxed text-gray-300">${block}</p>`;
    }).join('\n');

    // Restore inline code
    html = html.replace(/@@INLINECODE_(\d+)@@/g, (match, idx) => inlineCodes[parseInt(idx, 10)]);

    // Restore code blocks
    html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (match, idx) => codeBlocks[parseInt(idx, 10)]);

    return html;
}
