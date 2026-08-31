import type { CheatEntry, RegexPreset, RegexFlags } from "./types";

export const CHEAT_SHEET: CheatEntry[] = [
  // Character Classes
  { token: ".", description: "Any character except newline", example: "a.c → abc, aXc", category: "character" },
  { token: "\\d", description: "Digit [0-9]", example: "3 \\d → 31", category: "character" },
  { token: "\\w", description: "Word char [a-zA-Z0-9_]", example: "\\w+ → hello_42", category: "character" },
  { token: "\\s", description: "Whitespace", example: "a\\sb → a b", category: "character" },
  { token: "[abc]", description: "Character set", example: "[aeiou] → e", category: "character" },
  { token: "[^abc]", description: "Negated set", example: "[^0-9] → x", category: "character" },
  { token: "[a-z]", description: "Range", example: "[a-z] → m", category: "character" },

  // Quantifiers
  { token: "*", description: "Zero or more", example: "ab*c → ac, abbc", category: "quantifier" },
  { token: "+", description: "One or more", example: "ab+c → abc, abbc", category: "quantifier" },
  { token: "?", description: "Zero or one (optional)", example: "colou?r → color", category: "quantifier" },
  { token: "{n}", description: "Exactly n times", example: "\\d{3} → 123", category: "quantifier" },
  { token: "{n,m}", description: "Between n and m times", example: "\\d{2,4} → 1234", category: "quantifier" },
  { token: "*?", description: "Lazy zero or more", example: "a.*?b → axxb", category: "quantifier" },

  // Anchors
  { token: "^", description: "Start of string/line", example: "^Hello → Hello world", category: "anchor" },
  { token: "$", description: "End of string/line", example: "world$ → Hello world", category: "anchor" },
  { token: "\\b", description: "Word boundary", example: "\\bcat\\b → cat in cat", category: "anchor" },

  // Groups & References
  { token: "(abc)", description: "Capturing group", example: "(\\d{3}) → 123", category: "group" },
  { token: "(?:abc)", description: "Non-capturing group", example: "(?:ab)+ → abab", category: "group" },
  { token: "(?<name>abc)", description: "Named group", example: "(?<y>\\d{4})", category: "group" },
  { token: "a|b", description: "Alternation (or)", example: "cat|dog → cat", category: "group" },
  { token: "\\1", description: "Back-reference to group 1", example: "(\\w+) \\1 → hi hi", category: "group" },

  // Escapes
  { token: "\\.", description: "Literal dot", example: "a\\.b → a.b", category: "escape" },
  { token: "\\\\", description: "Literal backslash", example: "a\\\\b → a\\b", category: "escape" },
  { token: "\\n", description: "Newline", example: "a\\nb matches a\\nb", category: "escape" },

  // Flags
  { token: "g", description: "Global — find all matches", example: /\\d+/g.source, category: "flag" },
  { token: "i", description: "Case-insensitive", example: /hello/i.source, category: "flag" },
  { token: "m", description: "Multiline ^$ match per line", example: /^\\d+/gm.source, category: "flag" },
  { token: "s", description: "Dotall — dot matches \\n", example: /a.b/s.source, category: "flag" },
];

export const PRESETS: RegexPreset[] = [
  {
    name: "Email Address",
    pattern: "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    description: "Matches standard email addresses",
    testString: "Contact us at hello@example.com or support@company.co.uk for help.",
  },
  {
    name: "URL (http/https)",
    pattern: "https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+[\\w\\-.,@?^=%&:/~+#]*",
    flags: "g",
    description: "Matches HTTP and HTTPS URLs",
    testString: "Visit https://example.com/path?query=1 or http://docs.test.org/api for more.",
  },
  {
    name: "IPv4 Address",
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b",
    flags: "g",
    description: "Valid IPv4 addresses (0.0.0.0 – 255.255.255.255)",
    testString: "Server at 192.168.1.1, gateway 10.0.0.1, invalid 999.999.999.999.",
  },
  {
    name: "Semantic Version",
    pattern: "\\bv?(\\d+)\\.(\\d+)\\.(\\d+)(?:\\-([\\w.]+))?(?:\\+([\\w.]+))?\\b",
    flags: "g",
    description: "Matches semver strings like v1.2.3-beta.1+build.42",
    testString: "Releases: v1.0.0, 2.3.1-rc.1, v10.0.0-beta.2+build.123",
  },
  {
    name: "Hex Color Code",
    pattern: "#(?:[0-9a-fA-F]{3}){1,2}\\b",
    flags: "g",
    description: "Matches 3 or 6 digit hex color codes",
    testString: "Colors: #ff0000, #0a0a0f, #FFF, #1a2b3c in the theme.",
  },
  {
    name: "Git Commit Hash",
    pattern: "\\b[0-9a-f]{7,40}\\b",
    flags: "g",
    description: "Matches short or full git commit SHA hashes",
    testString: "Commit abc1234 merged by user. Full SHA: fcf844ab1234567890abcdef1234567890abcdef.",
  },
  {
    name: "HTML Tag",
    pattern: "<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>([\\s\\S]*?)<\\/\\1>",
    flags: "g",
    description: "Matches opening/closing HTML tag pairs with content",
    testString: "<p>Hello</p> <div class='box'>Content</div> <span>text</span>",
  },
  {
    name: "Markdown Heading",
    pattern: "^(#{1,6})\\s+(.+)$",
    flags: "gm",
    description: "Matches Markdown headings (# to ######)",
    testString: "# Title\n## Section\n### Subsection\nRegular text\n#### Deep heading",
  },
  {
    name: "Phone Number (US)",
    pattern: "(?:\\+1[\\s\\-]?)?\\(?\\d{3}\\)?[\\s\\-.]?\\d{3}[\\s\\-.]?\\d{4}",
    flags: "g",
    description: "US phone numbers in various formats",
    testString: "Call (555) 123-4567, +1 555-987-6543, or 555.111.2222.",
  },
  {
    name: "Conventional Commit",
    pattern: "^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(?:\\(.+\\))?!?:\\s.{3,}",
    flags: "gm",
    description: "Matches conventional commit message format",
    testString: "feat(auth): add OAuth2 login\nfix: resolve race condition in worker\ndocs: update API reference",
  },
];

export function formatFlags(flags: RegexFlags): string {
  return Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join("");
}

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "character", label: "Character Classes" },
  { key: "quantifier", label: "Quantifiers" },
  { key: "anchor", label: "Anchors" },
  { key: "group", label: "Groups & Alternation" },
  { key: "escape", label: "Escapes" },
  { key: "flag", label: "Flags" },
];

export const GROUP_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
];
