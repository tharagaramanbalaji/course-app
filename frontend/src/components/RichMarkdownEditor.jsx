import React, { useState } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const TEMPLATES = [
  {
    label: "Standard Lesson",
    text: `# Lesson Title\n\nOverview of the lesson topic and why it matters in real-world scenarios.\n\n## Key Objectives\n- Learn the core concepts.\n- Understand how to apply them.\n\n## Main Content\nDetailed explanations, architecture notes, and best practices go here.\n\n**Key takeaways**\n- Keep concepts simple and practical.\n- Practice with real code examples.`,
  },
  {
    label: "Code Tutorial",
    text: `# Code Walkthrough\n\nIn this lesson, we will implement a practical example.\n\n## Example Code\n\`\`\`python\ndef calculate_metrics(data):\n    # Process data and return result\n    return {"total": len(data), "active": True}\n\`\`\`\n\n## Code Breakdown\n1. Initialize parameters.\n2. Execute core logic.\n3. Return structured metrics.\n\n> Always validate your inputs before running transformations.`,
  },
  {
    label: "Concept Callout",
    text: `> **IMPORTANT NOTE**\n> This concept is fundamental for production environments.\n\n## Why it matters\nWhen scaling applications, understanding this behavior avoids performance bottlenecks.\n\n- **Pro Tip**: Use asynchronous processing for long-running jobs.`,
  },
];

export default function RichMarkdownEditor({ value, onChange, placeholder = "Write lesson text, code snippets, or notes...", rows = 8 }) {
  const [activeTab, setActiveTab] = useState("write"); // "write" | "preview"

  const insertSyntax = (prefix, suffix = "") => {
    const textarea = document.getElementById("rich-markdown-textarea");
    if (!textarea) {
      onChange(value + prefix + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);

    const replacement = prefix + (selected || "text") + suffix;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected || "text").length);
    }, 50);
  };

  const handleTemplateSelect = (templateText) => {
    if (value.trim() && !window.confirm("Replace current editor text with template?")) {
      return;
    }
    onChange(templateText);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* Editor Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 gap-2">
        {/* Write / Preview Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("write")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              activeTab === "write"
                ? "bg-white text-[#0A6847] shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              activeTab === "preview"
                ? "bg-white text-[#0A6847] shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Live Preview</span>
          </button>
        </div>

        {/* Formatting Toolbar (shown in write mode) */}
        {activeTab === "write" && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => insertSyntax("# ")}
              title="Heading 1"
              className="px-2 py-1 text-xs font-extrabold rounded-md hover:bg-slate-200 text-slate-700"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => insertSyntax("## ")}
              title="Heading 2"
              className="px-2 py-1 text-xs font-bold rounded-md hover:bg-slate-200 text-slate-700"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertSyntax("### ")}
              title="Heading 3"
              className="px-2 py-1 text-xs font-bold rounded-md hover:bg-slate-200 text-slate-700"
            >
              H3
            </button>

            <span className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => insertSyntax("**", "**")}
              title="Bold"
              className="px-2 py-1 text-xs font-bold rounded-md hover:bg-slate-200 text-slate-800"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertSyntax("*", "*")}
              title="Italic"
              className="px-2 py-1 text-xs italic rounded-md hover:bg-slate-200 text-slate-800"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insertSyntax("`", "`")}
              title="Inline Code"
              className="px-2 py-1 text-xs font-mono rounded-md hover:bg-slate-200 text-slate-800"
            >
              &lt;/&gt;
            </button>
            <button
              type="button"
              onClick={() => insertSyntax("\n```python\n", "\n```\n")}
              title="Code Block"
              className="px-2 py-1 text-xs font-mono bg-slate-200/80 rounded-md hover:bg-slate-300 text-slate-900 font-semibold"
            >
              ``` Code Block
            </button>

            <span className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => insertSyntax("- ")}
              title="Bullet List"
              className="px-2 py-1 text-xs rounded-md hover:bg-slate-200 text-slate-700"
            >
              • List
            </button>
            <button
              type="button"
              onClick={() => insertSyntax("> ")}
              title="Quote"
              className="px-2 py-1 text-xs rounded-md hover:bg-slate-200 text-slate-700"
            >
              &quot; Quote
            </button>

            {/* Template Selector */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleTemplateSelect(e.target.value);
                  e.target.value = "";
                }
              }}
              className="ml-1 text-xs rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <option value="">Templates...</option>
              {TEMPLATES.map((t, idx) => (
                <option key={idx} value={t.text}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="p-3">
        {activeTab === "write" ? (
          <textarea
            id="rich-markdown-textarea"
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full font-mono text-xs leading-relaxed text-slate-800 focus:outline-hidden resize-y border-0 p-1"
          />
        ) : (
          <div className="min-h-[160px] p-2 bg-slate-50/50 rounded-lg border border-slate-100">
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="text-xs text-slate-400 italic">Nothing to preview yet. Switch to Write mode to type lesson content.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
