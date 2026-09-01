import React, { useState } from "react";

export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  // Split content by code block fences (```)
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

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check for Headings
    if (trimmed.startsWith("# ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h1 key={`h1-${index}`} className="mt-6 mb-3 text-2xl font-extrabold text-slate-900 tracking-tight border-b border-slate-200/80 pb-2">
          {renderInlineFormatting(trimmed.substring(2))}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h2 key={`h2-${index}`} className="mt-5 mb-2.5 text-xl font-bold text-slate-900 tracking-tight">
          {renderInlineFormatting(trimmed.substring(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith("### ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <h3 key={`h3-${index}`} className="mt-4 mb-2 text-base font-bold text-slate-800">
          {renderInlineFormatting(trimmed.substring(4))}
        </h3>
      );
      return;
    }

    // Check for Blockquotes
    if (trimmed.startsWith("> ")) {
      flushList(elements, currentList);
      currentList = null;
      elements.push(
        <blockquote key={`bq-${index}`} className="my-3 border-l-4 border-[#0A6847] bg-emerald-50/50 py-2 pl-4 pr-3 text-slate-700 italic rounded-r-lg">
          {renderInlineFormatting(trimmed.substring(2))}
        </blockquote>
      );
      return;
    }

    // Check for Unordered List items (- or *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!currentList || currentList.type !== "ul") {
        flushList(elements, currentList);
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(trimmed.substring(2));
      return;
    }

    // Check for Ordered List items (1. 2. etc)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!currentList || currentList.type !== "ol") {
        flushList(elements, currentList);
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(olMatch[2]);
      return;
    }

    // Empty lines flush active lists
    if (trimmed === "") {
      flushList(elements, currentList);
      currentList = null;
      return;
    }

    // Regular paragraph
    flushList(elements, currentList);
    currentList = null;
    elements.push(
      <p key={`p-${index}`} className="my-2 leading-relaxed text-slate-600">
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList(elements, currentList);
  return <>{elements}</>;
}

function flushList(elements, list) {
  if (!list || list.items.length === 0) return;
  if (list.type === "ul") {
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

function renderInlineFormatting(text) {
  if (!text) return null;

  // Split by inline code blocks `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={pIdx}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Parse bold **bold** within plain text parts
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={pIdx}>
        {boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith("**") && bPart.endsWith("**")) {
            return (
              <strong key={bIdx} className="font-bold text-slate-900">
                {bPart.slice(2, -2)}
              </strong>
            );
          }
          return bPart;
        })}
      </React.Fragment>
    );
  });
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
