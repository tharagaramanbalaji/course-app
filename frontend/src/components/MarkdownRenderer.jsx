import React, { useState } from "react";

/**
 * Robust, feature-complete Markdown Renderer for lessons, notes, and previews.
 * Supports:
 * - Headings (H1 - H6)
 * - Code blocks with copy button and language badge
 * - Inline formatting: bold (** or __), italic (* or _), bold-italic (*** or ___),
 *   inline code (`...`), strikethrough (~~...~~), and markdown links ([text](url))
 * - Blockquotes with callout styling
 * - Tables (GFM syntax: | Header | Header |)
 * - Unordered, ordered, and task checkbox lists (- [x], - [ ])
 * - Horizontal rules (---, ***, ___)
 */
export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-4 text-slate-700 leading-relaxed text-sm ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return <CodeBlock key={idx} language={block.language} code={block.code} />;
        }
        return <TextMarkdownBlock key={idx} text={block.text} />;
      })}
    </div>
  );
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-800 bg-[#0D1117] text-slate-100 shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#161B22] px-4 py-2 text-xs font-mono text-slate-400">
        <span className="font-semibold text-emerald-400 uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          {copied ? (
            <>
              <span className="text-emerald-400">✓</span> Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <pre className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-emerald-300/90 selection:bg-emerald-900 selection:text-white">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextMarkdownBlock({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let currentList = null;
  let tableLines = [];

  const flushTable = () => {
    if (tableLines.length >= 2) {
      elements.push(renderTable(tableLines, elements.length));
    } else if (tableLines.length === 1) {
      elements.push(
        <p key={`p-tbl-${elements.length}`} className="my-2 leading-relaxed text-slate-600">
          {renderInlineFormatting(tableLines[0])}
        </p>
      );
    }
    tableLines = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    // Check if line is part of a markdown table (starts and ends with |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1)) {
      flushList(elements, currentList);
      currentList = null;
      tableLines.push(trimmed);
      continue;
    } else if (tableLines.length > 0) {
      flushTable();
    }

    // Check for Horizontal Rules (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(<hr key={`hr-${index}`} className="my-6 border-slate-200" />);
      continue;
    }

    // Check for Headings
    if (trimmed.startsWith("# ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h1 key={`h1-${index}`} className="mt-6 mb-3 text-2xl font-extrabold text-slate-900 tracking-tight border-b border-slate-200/80 pb-2">
          {renderInlineFormatting(trimmed.substring(2))}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h2 key={`h2-${index}`} className="mt-5 mb-2.5 text-xl font-bold text-slate-900 tracking-tight">
          {renderInlineFormatting(trimmed.substring(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h3 key={`h3-${index}`} className="mt-4 mb-2 text-base font-bold text-slate-800">
          {renderInlineFormatting(trimmed.substring(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h4 key={`h4-${index}`} className="mt-3 mb-1.5 text-sm font-bold text-slate-800">
          {renderInlineFormatting(trimmed.substring(5))}
        </h4>
      );
      continue;
    }

    // Check for Blockquotes (> ...)
    if (trimmed.startsWith("> ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <blockquote key={`bq-${index}`} className="my-3 border-l-4 border-[#0A6847] bg-emerald-50/50 py-2.5 pl-4 pr-3 text-slate-700 italic rounded-r-lg">
          {renderInlineFormatting(trimmed.substring(2))}
        </blockquote>
      );
      continue;
    }

    // Check for Task lists (- [ ] or - [x])
    const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === "x";
      const itemText = taskMatch[2];
      if (!currentList || currentList.type !== "task") {
        flushList(elements, currentList);
        currentList = { type: "task", items: [] };
      }
      currentList.items.push({ isChecked, text: itemText });
      continue;
    }

    // Check for Unordered List items (- or * or +)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("+ ")) {
      if (!currentList || currentList.type !== "ul") {
        flushList(elements, currentList);
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(trimmed.substring(2));
      continue;
    }

    // Check for Ordered List items (1. 2. etc)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList(elements, currentList);
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    // Empty lines flush active lists
    if (trimmed === "") {
      flushList(elements, currentList);
      currentList = null;
      continue;
    }

    // Regular paragraph
    flushList(elements, currentList);
    currentList = null;
    elements.push(
      <p key={`p-${index}`} className="my-2 leading-relaxed text-slate-600">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  flushList(elements, currentList);
  if (tableLines.length > 0) {
    flushTable();
  }

  return <>{elements}</>;
}

function flushList(elements, list) {
  if (!list || list.items.length === 0) return;

  if (list.type === "task") {
    elements.push(
      <ul key={`task-${elements.length}`} className="my-3 space-y-2 text-slate-600">
        {list.items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={item.isChecked}
              readOnly
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className={item.isChecked ? "line-through text-slate-400" : ""}>
              {renderInlineFormatting(item.text)}
            </span>
          </li>
        ))}
      </ul>
    );
  } else if (list.type === "ul") {
    elements.push(
      <ul key={`ul-${elements.length}`} className="my-3 list-disc pl-6 space-y-1.5 text-slate-600">
        {list.items.map((item, idx) => (
          <li key={idx}>{renderInlineFormatting(item)}</li>
        ))}
      </ul>
    );
  } else if (list.type === "ol") {
    elements.push(
      <ol key={`ol-${elements.length}`} className="my-3 list-decimal pl-6 space-y-1.5 text-slate-600">
        {list.items.map((item, idx) => (
          <li key={idx}>{renderInlineFormatting(item)}</li>
        ))}
      </ol>
    );
  }
}

function renderTable(tableLines, keyIdx) {
  if (!tableLines || tableLines.length < 2) return null;

  const parseRow = (line) =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

  const headers = parseRow(tableLines[0]);
  // Line 1 is usually separator (|---|---|)
  const rows = tableLines.slice(2).map(parseRow);

  return (
    <div key={`tbl-${keyIdx}`} className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
        <thead className="bg-slate-50 text-slate-800 font-bold uppercase tracking-wider">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3.5 py-2.5">
                {renderInlineFormatting(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2 text-slate-600">
                  {renderInlineFormatting(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Parses inline markdown tokens with full support for:
 * 1. Inline code: `code`
 * 2. Markdown links: [title](url)
 * 3. Bold-Italic: ***text*** or ___text___
 * 4. Bold: **text** or __text__
 * 5. Italic: *text* or _text_
 * 6. Strikethrough: ~~text~~
 */
export function renderInlineFormatting(text) {
  if (!text || typeof text !== "string") return text || null;

  // Master regex tokenizer matching all inline markdown structures:
  // Match 1: `code`
  // Match 2: [link text](url)
  // Match 3: ***bold italic*** or ___bold italic___
  // Match 4: **bold** or __bold__
  // Match 5: *italic* or _italic_
  // Match 6: ~~strikethrough~~
  const inlinePattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*\*(?:[^*]|\*(?!\*\*))+\*\*\*|___(?:[^_]|_(?!___))+___)|(\*\*(?:[^*]|\*(?!\*))+\*\*|__(?:[^_]|_(?!_))+__)|(\*(?:[^*]+)\*|_(?:[^_]+)_)|(~~(?:[^~]+)~~)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = inlinePattern.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Push preceding plain text
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    if (match[1]) {
      // Inline Code: `code`
      const codeContent = matchText.slice(1, -1);
      parts.push(
        <code
          key={`code-${matchIndex}`}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 border border-slate-200"
        >
          {codeContent}
        </code>
      );
    } else if (match[2]) {
      // Link: [label](url)
      const linkMatch = matchText.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        parts.push(
          <a
            key={`link-${matchIndex}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-900 underline font-medium transition"
          >
            {renderInlineFormatting(label)}
          </a>
        );
      } else {
        parts.push(matchText);
      }
    } else if (match[3]) {
      // Bold Italic: ***text*** or ___text___
      const inner = matchText.slice(3, -3);
      parts.push(
        <strong key={`bi-${matchIndex}`} className="font-bold text-slate-900">
          <em className="italic">{renderInlineFormatting(inner)}</em>
        </strong>
      );
    } else if (match[4]) {
      // Bold: **text** or __text__
      const inner = matchText.slice(2, -2);
      parts.push(
        <strong key={`b-${matchIndex}`} className="font-bold text-slate-900">
          {renderInlineFormatting(inner)}
        </strong>
      );
    } else if (match[5]) {
      // Italic: *text* or _text_
      const inner = matchText.slice(1, -1);
      parts.push(
        <em key={`i-${matchIndex}`} className="italic text-slate-800">
          {renderInlineFormatting(inner)}
        </em>
      );
    } else if (match[6]) {
      // Strikethrough: ~~text~~
      const inner = matchText.slice(2, -2);
      parts.push(
        <del key={`del-${matchIndex}`} className="line-through text-slate-400">
          {renderInlineFormatting(inner)}
        </del>
      );
    }

    lastIndex = matchIndex + matchText.length;
  }

  // Push any remaining trailing text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function parseMarkdownBlocks(raw) {
  const blocks = [];
  const parts = raw.split(/```/);

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      // Code block
      const firstLineEnd = part.indexOf("\n");
      let language = "";
      let code = part;

      if (firstLineEnd !== -1) {
        language = part.substring(0, firstLineEnd).trim();
        code = part.substring(firstLineEnd + 1);
      }

      blocks.push({
        type: "code",
        language: language || "code",
        code: code.trim(),
      });
    } else {
      // Regular markdown text
      if (part.trim()) {
        blocks.push({
          type: "text",
          text: part,
        });
      }
    }
  });

  return blocks;
}

