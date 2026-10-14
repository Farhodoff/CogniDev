import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface FormattedAiTextProps {
  content: string;
  className?: string;
}

/** Parses inline code within bold or regular text */
function formatInlineCodeOnly(text: string, keyPrefix: string | number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <code
        key={`${keyPrefix}-code-${match.index}`}
        className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 font-mono text-[11.5px] text-purple-200"
      >
        {match[1]}
      </code>
    );
    lastIndex = codeRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/** Formats inline text: transforms **bold**, `inline code`, and cleans stray markdown punctuation. */
function formatInlineText(text: string): React.ReactNode[] {
  if (!text) return [];

  // 1. Clean up backtick apostrophe typos e.g. README`ni -> README'ni, branch`ga -> branch'ga
  const sanitized = text
    .replace(/([a-zA-Z0-9])`([a-zA-Z]+)/g, "$1'$2")
    .replace(/`([a-zA-Z0-9_.-]+)\s*`\s*([a-zA-Z]+)/g, "`$1`'$2")
    .replace(/`\s*([a-zA-Z0-9_.-]+)\s*`/g, '`$1`');

  // 2. Tokenize by bold (**...**), inline code (`...`), and italics (*...*)
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      const rawText = sanitized.substring(lastIndex, match.index);
      // Clean stray double asterisks or unclosed marks
      parts.push(rawText.replace(/\*\*/g, ''));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const boldContent = token.slice(2, -2).trim();
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-white">
          {formatInlineCodeOnly(boldContent, `b-${match.index}`)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const codeContent = token.slice(1, -1);
      parts.push(
        <code
          key={`c-${match.index}`}
          className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 font-mono text-[11.5px] text-purple-200"
        >
          {codeContent}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      const italicContent = token.slice(1, -1).trim();
      parts.push(
        <em key={`i-${match.index}`} className="italic text-zinc-300">
          {italicContent}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < sanitized.length) {
    const remainder = sanitized.substring(lastIndex).replace(/\*\*/g, '');
    if (remainder) parts.push(remainder);
  }

  return parts.length > 0 ? parts : [sanitized];
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40">
      <table className="w-full text-left text-[12.5px]">
        {headers.length > 0 && (
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-zinc-300 font-semibold">
              {headers.map((h, i) => (
                <th key={i} className="px-3.5 py-2.5">
                  {formatInlineText(h)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/[0.02] transition">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2 text-zinc-200 align-top">
                  {formatInlineText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#090a0f] shadow-lg">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3.5 py-1.5 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5 font-mono font-medium text-purple-300">
          <Terminal size={12} />
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/5 hover:text-white transition"
          title="Nusxa olish"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? 'Nusxalandi' : 'Nusxa'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[12px] leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function FormattedAiText({ content, className = '' }: FormattedAiTextProps) {
  if (!content) return null;

  // Split into lines and parse blocks
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Code Block: ```lang ... ```
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <CodeBlock
          key={`code-${elements.length}`}
          code={codeLines.join('\n')}
          language={language}
        />
      );
      continue;
    }

    // 2. Table Block: | col | col |
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const splitRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());

        const headers = splitRow(tableLines[0]);
        const dataRows: string[][] = [];

        // Check if row 1 is separator |---|---|
        const startIdx = tableLines[1].replace(/[\s\-|:]/g, '').length === 0 ? 2 : 1;
        for (let r = startIdx; r < tableLines.length; r++) {
          dataRows.push(splitRow(tableLines[r]));
        }

        elements.push(
          <TableBlock
            key={`table-${elements.length}`}
            headers={headers}
            rows={dataRows}
          />
        );
        continue;
      }
    }

    // 3. Headers: #, ##, ###, ####
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const headerText = headerMatch[2];
      elements.push(
        <div
          key={`h-${elements.length}`}
          className="mt-4 mb-2 flex items-center gap-2 border-b border-white/[0.06] pb-1.5"
        >
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-400 to-sky-400" />
          <h4 className="text-[13.5px] font-bold text-white tracking-wide">
            {formatInlineText(headerText)}
          </h4>
        </div>
      );
      i++;
      continue;
    }

    // 4. Blockquotes: > quote
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="my-2 rounded-r-xl border-l-2 border-purple-400 bg-purple-500/[0.04] py-1.5 px-3.5 text-[12.5px] italic text-zinc-300"
        >
          {formatInlineText(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 5. Bullet items: - item or * item or • item
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      elements.push(
        <div
          key={`bullet-${elements.length}`}
          className="my-1 flex items-start gap-2.5 text-[12.5px] text-zinc-300 pl-1"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400/80" />
          <div className="leading-relaxed">{formatInlineText(bulletMatch[1])}</div>
        </div>
      );
      i++;
      continue;
    }

    // 6. Numbered items: 1. item, 2. item or 1) item
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div
          key={`num-${elements.length}`}
          className="my-2 flex items-start gap-2 text-[12.5px] text-zinc-200"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] font-mono text-[11px] font-bold text-purple-300">
            {numMatch[1]}
          </span>
          <div className="leading-relaxed pt-0.5">{formatInlineText(numMatch[2])}</div>
        </div>
      );
      i++;
      continue;
    }

    // 7. Regular paragraph or empty line
    if (line.length === 0) {
      elements.push(<div key={`sp-${elements.length}`} className="h-2" />);
    } else {
      elements.push(
        <p
          key={`p-${elements.length}`}
          className="my-1.5 text-[12.5px] leading-relaxed text-zinc-200"
        >
          {formatInlineText(line)}
        </p>
      );
    }

    i++;
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}
