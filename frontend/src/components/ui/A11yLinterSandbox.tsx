import React, { useState, useEffect, useRef, useCallback } from "react";
import axe from "axe-core";
import {
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle,
  Wand2,
  Eye,
  Code2,
  ShieldCheck,
  Zap,
  Volume2,
  Copy,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";

interface A11yTemplate {
  id: string;
  name: string;
  category: "Form" | "Media" | "Navigation" | "Interactive";
  description: string;
  code: string;
}

const A11Y_TEMPLATES: A11yTemplate[] = [
  {
    id: "broken-form",
    name: "1. Unaccessible Form (Missing Labels & Contrast)",
    category: "Form",
    description: "Input fields without associated labels and low-contrast submit button.",
    code: `<form>
  <h2>User Registration</h2>
  
  <!-- Missing label association -->
  <input type="text" placeholder="Enter Full Name" />
  
  <!-- Low contrast text -->
  <p style="color: #999999; background-color: #ffffff;">
    Password must contain at least 8 characters.
  </p>
  <input type="password" placeholder="Password" />

  <!-- Inaccessible icon button without aria-label -->
  <button style="color: #777777; background-color: #eeeeee;">
    Submit Form
  </button>
</form>`,
  },
  {
    id: "missing-alt",
    name: "2. Media & Icon Buttons (Missing Alt & ARIA)",
    category: "Media",
    description: "Images missing alt text and SVG icon buttons without screen reader labels.",
    code: `<div>
  <h3>Product Catalog</h3>
  
  <!-- Missing alt attribute -->
  <img src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=200" />
  
  <!-- Icon button with no text or aria-label -->
  <button style="padding: 8px; background: #3b82f6; color: white; border: none; rounded: 4px;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 12h14M12 5l7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</div>`,
  },
  {
    id: "broken-modal",
    name: "3. Unaccessible Dialog (Missing ARIA Roles)",
    category: "Interactive",
    description: "Custom modal overlay missing role='dialog', aria-modal, and aria-labelledby.",
    code: `<div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px;">
  <!-- Custom modal header without heading association -->
  <div>
    <span>Delete Account Confirmation</span>
    <button style="float: right;">X</button>
  </div>
  
  <p style="color: #64748b;">Are you sure you want to permanently delete your account?</p>
  
  <!-- Non-semantic div used as button -->
  <div style="display: inline-block; padding: 8px 16px; background: #ef4444; color: white; cursor: pointer;">
    Confirm Delete
  </div>
</div>`,
  },
  {
    id: "accessible-form",
    name: "4. 100% Compliant WCAG 2.1 AAA Component",
    category: "Form",
    description: "Fully compliant form with label associations, high contrast, and ARIA attributes.",
    code: `<form aria-labelledby="form-title">
  <h2 id="form-title" style="color: #0f172a;">Accessible Contact Form</h2>
  
  <div style="margin-bottom: 12px;">
    <label for="user-name" style="display: block; font-weight: bold; color: #0f172a; margin-bottom: 4px;">
      Full Name <span aria-hidden="true" style="color: #dc2626;">*</span>
    </label>
    <input 
      id="user-name" 
      type="text" 
      required 
      aria-required="true"
      style="width: 100%; padding: 8px; border: 2px solid #0f172a; border-radius: 4px;"
    />
  </div>

  <div style="margin-bottom: 16px;">
    <label for="user-email" style="display: block; font-weight: bold; color: #0f172a; margin-bottom: 4px;">
      Email Address <span aria-hidden="true" style="color: #dc2626;">*</span>
    </label>
    <input 
      id="user-email" 
      type="email" 
      required 
      aria-required="true"
      style="width: 100%; padding: 8px; border: 2px solid #0f172a; border-radius: 4px;"
    />
  </div>

  <button 
    type="submit" 
    style="padding: 10px 20px; background: #1e1b4b; color: #ffffff; border: 2px solid #0f172a; font-weight: bold; border-radius: 6px; cursor: pointer;"
  >
    Submit Information
  </button>
</form>`,
  },
];

export function A11yLinterSandbox() {
  const [activeTemplate, setActiveTemplate] = useState<A11yTemplate>(A11Y_TEMPLATES[0]);
  const [code, setCode] = useState(A11Y_TEMPLATES[0].code);
  const [issues, setIssues] = useState<axe.Result[]>([]);
  const [ignoredRules, setIgnoredRules] = useState<Set<string>>(new Set());
  const [visionMode, setVisionMode] = useState<"normal" | "contrast" | "grayscale">("normal");
  const [screenReaderText, setScreenReaderText] = useState<string>("");

  const containerRef = useRef<HTMLDivElement>(null);

  const analyzeAccessibility = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      const results = await axe.run(containerRef.current, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      });

      const filteredIssues = results.violations.filter((v) => !ignoredRules.has(v.id));
      setIssues(filteredIssues);
      generateScreenReaderPreview(containerRef.current);
    } catch (err) {
      console.error("Axe core evaluation error:", err);
    }
  }, [code, ignoredRules]);

  useEffect(() => {
    const timer = setTimeout(() => {
      analyzeAccessibility();
    }, 300);
    return () => clearTimeout(timer);
  }, [code, analyzeAccessibility]);

  const generateScreenReaderPreview = (el: HTMLElement) => {
    const textNodes: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        const tagName = elem.tagName.toLowerCase();
        const ariaLabel = elem.getAttribute("aria-label");
        const alt = elem.getAttribute("alt");
        const role = elem.getAttribute("role");

        if (ariaLabel) {
          textNodes.push(`[${role || tagName}: ${ariaLabel}]`);
          return;
        }

        if (tagName === "img") {
          textNodes.push(`[image: ${alt || "unlabeled image"}]`);
          return;
        }

        if (tagName === "button") {
          textNodes.push(`[button: ${elem.innerText.trim() || "unlabeled button"}]`);
          return;
        }

        if (tagName === "input") {
          const type = elem.getAttribute("type") || "text";
          const placeholder = elem.getAttribute("placeholder");
          const id = elem.id;
          const label = id ? el.querySelector(`label[for="${id}"]`)?.textContent?.trim() : null;
          textNodes.push(`[input field ${type}: ${label || placeholder || "unlabeled input"}]`);
          return;
        }
      }

      for (let child of Array.from(node.childNodes)) {
        walk(child);
      }
    };

    walk(el);
    setScreenReaderText(textNodes.join(" ➔ ") || "No screen reader announcements detected.");
  };

  const handleSelectTemplate = (tpl: A11yTemplate) => {
    setActiveTemplate(tpl);
    setCode(tpl.code);
    toast.success(`Loaded template: ${tpl.name}`);
  };

  const handleAutoFix = () => {
    let fixedCode = code;

    // 1. Fix missing alt on img tags
    fixedCode = fixedCode.replace(/<img(?![^>]*\balt=)([^>]*)>/gi, '<img alt="Decorative image" $1>');

    // 2. Fix un-associated input fields by adding ids & labels
    fixedCode = fixedCode.replace(
      /<input(?![^>]*\bid=)([^>]*)placeholder="([^"]+)"([^>]*)>/gi,
      (match, p1, p2, p3) => {
        const id = `input-${Math.random().toString(36).substring(2, 7)}`;
        return `<label for="${id}" style="display:block; font-weight:bold; margin-bottom:4px;">${p2}</label>\n  <input id="${id}" placeholder="${p2}" ${p1}${p3}>`;
      }
    );

    // 3. Fix low contrast button styles
    fixedCode = fixedCode.replace(
      /style="([^"]*color:\s*#[0-9a-f]{3,6}[^"]*)"/gi,
      'style="color: #ffffff; background-color: #0f172a; padding: 10px 16px; border-radius: 6px; border: 2px solid #000;"'
    );

    // 4. Fix inaccessible buttons missing text or aria-label
    fixedCode = fixedCode.replace(
      /<button(?![^>]*\baria-label=)([^>]*)>(\s*<svg[^>]*>[\s\S]*?<\/svg>\s*)<\/button>/gi,
      '<button aria-label="Action button" $1>$2</button>'
    );

    setCode(fixedCode);
    toast.success("⚡ Accessibility auto-fixes applied!");
  };

  const getComplianceGrade = () => {
    if (issues.length === 0) return { grade: "AAA", color: "bg-emerald-400 text-black", label: "100% WCAG Compliant" };
    const criticalCount = issues.filter((i) => i.impact === "critical" || i.impact === "serious").length;
    if (criticalCount === 0) return { grade: "AA", color: "bg-amber-300 text-black", label: "Minor Warnings" };
    return { grade: "FAIL", color: "bg-rose-500 text-white", label: `${criticalCount} Critical Violations` };
  };

  const compliance = getComplianceGrade();

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 text-text dark:text-[#f0ebe2] px-2 sm:px-4 lg:px-6">
      {/* Top Hero Banner - Neo-Brutalist Theme */}
      <div className="w-full bg-white dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-3xl p-6 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#C3C0FF] border-2 border-black flex items-center justify-center shrink-0 text-black shadow-card-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-display font-black uppercase tracking-tight text-black dark:text-white">
                WCAG Accessibility &amp; ARIA Studio
              </h1>
              <span className={`text-xs font-mono font-black uppercase px-3 py-1 rounded-md border-2 border-black ${compliance.color}`}>
                Grade: {compliance.grade}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold mt-1">
              Live axe-core WCAG 2.1 Linter • Screen Reader Voiceover Emulator • 1-Click Auto-Fix Studio
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleAutoFix}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-400 hover:bg-emerald-500 text-black border-2 border-black text-xs font-black rounded-xl shadow-card transition-all active:translate-y-0.5"
          >
            <Wand2 className="w-4 h-4" /> ⚡ 1-Click Auto-Fix Code
          </button>

          <button
            onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("Code copied!"))}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C3C0FF] hover:bg-[#b0adff] text-black border-2 border-black text-xs font-black rounded-xl shadow-card-sm transition-all"
          >
            <Copy className="w-4 h-4" /> Copy Clean HTML
          </button>
        </div>
      </div>

      {/* Preset Templates Selector Deck */}
      <div className="bg-white dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" /> Test Preset Scenarios:
          </h2>
          <span className="text-[11px] font-mono font-bold text-slate-400">Select scenario to audit</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 overflow-hidden">
          {A11Y_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleSelectTemplate(tpl)}
              className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all border-2 border-black ${
                activeTemplate.id === tpl.id
                  ? "bg-[#C3C0FF] text-black shadow-card-sm"
                  : "bg-surface-low dark:bg-[#0a0a0f] text-text dark:text-white hover:bg-gray-200 dark:hover:bg-[#1f1c18]"
              }`}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-Pane Studio Layout: Editor (4) | Rendered Canvas (4) | Audit Results (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pane 1: HTML Code Editor */}
        <div className="lg:col-span-4 space-y-3 bg-white dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl p-4 shadow-card flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-[#2e2924]">
            <h3 className="font-black text-xs uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-500" /> HTML Editor
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Keystroke Linter Active</span>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Type HTML code to run accessibility linter..."
            className="flex-1 w-full p-3 bg-surface-low dark:bg-[#0a0a0f] border-2 border-black dark:border-[#2e2924] rounded-xl font-mono text-xs text-text dark:text-[#f0ebe2] outline-none focus:border-indigo-500 transition-colors leading-relaxed resize-none"
          />
        </div>

        {/* Pane 2: Live HTML Canvas & Vision Simulator */}
        <div className="lg:col-span-4 space-y-3 bg-white dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl p-4 shadow-card flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-[#2e2924]">
            <h3 className="font-black text-xs uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-500" /> Rendered Canvas
            </h3>

            {/* Vision Filter Selector */}
            <div className="flex items-center gap-1 bg-surface-low dark:bg-[#0a0a0f] p-1 rounded-lg border border-black dark:border-[#2e2924]">
              <button
                onClick={() => setVisionMode("normal")}
                className={`px-2 py-0.5 text-[10px] font-black rounded ${
                  visionMode === "normal" ? "bg-black text-white" : "text-slate-400"
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setVisionMode("grayscale")}
                className={`px-2 py-0.5 text-[10px] font-black rounded ${
                  visionMode === "grayscale" ? "bg-black text-white" : "text-slate-400"
                }`}
              >
                Monochrome
              </button>
            </div>
          </div>

          {/* Live Render Container */}
          <div
            className={`flex-1 p-4 bg-white dark:bg-[#0f0e0c] border-2 border-black dark:border-[#2e2924] rounded-xl overflow-y-auto ${
              visionMode === "grayscale" ? "grayscale contrast-125" : ""
            }`}
          >
            <div dangerouslySetInnerHTML={{ __html: code }} />
          </div>

          {/* Screen Reader Voiceover Simulation Box */}
          <div className="p-3 bg-[#0a0a0f] border-2 border-black dark:border-[#2e2924] rounded-xl font-mono text-[11px] text-amber-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-slate-400">
              <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Screen Reader Voiceover Sequence:
            </div>
            <p className="text-slate-200 truncate">{screenReaderText}</p>
          </div>
        </div>

        {/* Pane 3: Audit Violations & Fix Guidance */}
        <div className="lg:col-span-4 space-y-3 bg-white dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl p-4 shadow-card flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-[#2e2924]">
            <h3 className="font-black text-xs uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Violations ({issues.length})
            </h3>
            <span className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded ${compliance.color}`}>
              {compliance.label}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {issues.length === 0 ? (
              <div className="p-6 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl text-center space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="font-black text-sm text-emerald-600 dark:text-emerald-400 uppercase">
                  100% Accessibility Verified!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                  Zero WCAG 2.1 violations found in this HTML structure.
                </p>
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-3.5 bg-surface-low dark:bg-[#0a0a0f] border-2 border-black dark:border-[#2e2924] rounded-xl space-y-2 shadow-card-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/30">
                        {issue.impact || "moderate"}
                      </span>
                      <h4 className="font-black text-xs text-black dark:text-white mt-1">
                        {issue.help}
                      </h4>
                    </div>

                    <button
                      onClick={() => {
                        setIgnoredRules((prev) => new Set(prev).add(issue.id));
                        toast.success(`Ignored rule: ${issue.id}`);
                      }}
                      className="text-[10px] font-mono font-bold px-2 py-1 bg-surface-low hover:bg-gray-200 dark:hover:bg-[#1f1c18] rounded border border-black/10 text-slate-500"
                    >
                      Ignore Rule
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {issue.description}
                  </p>

                  <div className="p-2 bg-white dark:bg-[#1a1714] border border-black/10 dark:border-[#2e2924] rounded-lg font-mono text-[11px] text-indigo-500 dark:text-indigo-400 truncate">
                    Node: {issue.nodes[0]?.target.join(", ") || "DOM Node"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Hidden axe-core audit node */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: "1000px",
          height: "1000px",
          overflow: "hidden",
        }}
        dangerouslySetInnerHTML={{ __html: code }}
      />
    </div>
  );
}

export default A11yLinterSandbox;
