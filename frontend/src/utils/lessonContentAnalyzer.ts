/**
 * Automated Lesson Content Suggestion & Quality Analysis Engine
 */

export interface AnalysisSuggestion {
  id: string;
  type: "readability" | "code" | "passive_voice" | "sentence_length" | "missing_alt" | "internal_link";
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  line?: number;
  originalText?: string;
  suggestedFix?: string;
}

export interface LessonAnalysisReport {
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  readingEaseScore: number;
  gradeLevel: number;
  suggestions: AnalysisSuggestion[];
}

const KNOWN_CURRICULUM_CONCEPTS: { keyword: string; slug: string; title: string }[] = [
  { keyword: "git rebase", slug: "git-rebase-flow", title: "Interactive Git Rebase" },
  { keyword: "merge conflict", slug: "resolving-merge-conflicts", title: "Resolving Merge Conflicts" },
  { keyword: "pull request", slug: "anatomy-of-a-pr", title: "Anatomy of a Pull Request" },
  { keyword: "cherry pick", slug: "git-cherry-pick", title: "Git Cherry Pick" },
  { keyword: "bisect", slug: "git-bisect-debugging", title: "Debugging with Git Bisect" },
];

/**
 * Estimate syllable count of an English word.
 */
function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 0;
  if (clean.length <= 3) return 1;

  const matches = clean.match(/[aeiouy]{1,2}/g);
  let count = matches ? matches.length : 1;
  if (clean.endsWith("e") && !clean.endsWith("le") && count > 1) {
    count--;
  }
  return Math.max(1, count);
}

/**
 * Analyzes markdown content for readability, passive voice, missing image alt text,
 * missing code examples, and internal link suggestions.
 */
export function analyzeLessonMarkdown(markdown: string): LessonAnalysisReport {
  const suggestions: AnalysisSuggestion[] = [];

  if (!markdown || !markdown.trim()) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      readingEaseScore: 100,
      gradeLevel: 0,
      suggestions: [
        {
          id: "empty-content",
          type: "readability",
          severity: "warning",
          title: "Empty Lesson Content",
          message: "Write or paste markdown content to generate suggestions.",
        },
      ],
    };
  }

  // Strip code blocks and HTML tags for text analysis
  const plainText = markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
  const lines = markdown.split("\n");

  const words = plainText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const sentences = plainText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const wordCount = words.length;
  const sentenceCount = sentences.length || 1;

  let totalSyllables = 0;
  words.forEach((w) => {
    totalSyllables += countSyllables(w);
  });

  // Flesch Reading Ease Score
  // Score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;
  const readingEaseScore = Math.round(
    Math.max(0, Math.min(100, 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord)),
  );

  // Flesch-Kincaid Grade Level = 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
  const gradeLevel = Math.round(Math.max(1, 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59));

  if (readingEaseScore < 50) {
    suggestions.push({
      id: "low-readability",
      type: "readability",
      severity: "warning",
      title: "Complex Readability",
      message: `Flesch Reading Ease score is ${readingEaseScore}/100 (Grade Level ${gradeLevel}). Consider using shorter sentences and simpler terms.`,
    });
  }

  // 1. Long Sentences Check (> 25 words)
  sentences.forEach((sentence, idx) => {
    const sWords = sentence.split(/\s+/).filter(Boolean);
    if (sWords.length > 25) {
      suggestions.push({
        id: `long-sentence-${idx}`,
        type: "sentence_length",
        severity: "info",
        title: "Long Sentence Detected",
        message: `Sentence has ${sWords.length} words. Splitting long sentences improves retention.`,
        originalText: sentence.slice(0, 60) + "...",
      });
    }
  });

  // 2. Passive Voice Detection
  const passiveRegex = /\b(am|is|are|was|were|be|been|being)\s+([a-z]+ed)\b/gi;
  let passiveMatch;
  let passiveCount = 0;
  while ((passiveMatch = passiveRegex.exec(plainText)) !== null && passiveCount < 3) {
    suggestions.push({
      id: `passive-voice-${passiveCount}`,
      type: "passive_voice",
      severity: "info",
      title: "Passive Voice Detected",
      message: `Consider converting "${passiveMatch[0]}" to active voice for stronger instruction.`,
      originalText: passiveMatch[0],
    });
    passiveCount++;
  }

  // 3. Missing Alt Text on Images (![]() or ![image]() or ![img]())
  const missingAltRegex = /!\[(\s*|image|img|photo|picture)\]\(([^)]+)\)/gi;
  lines.forEach((lineText, lineIdx) => {
    let match;
    while ((match = missingAltRegex.exec(lineText)) !== null) {
      suggestions.push({
        id: `missing-alt-line-${lineIdx}`,
        type: "missing_alt",
        severity: "warning",
        title: "Missing Image Alt Text",
        message: "Add descriptive accessibility alt text inside image brackets ![alt text](url).",
        line: lineIdx + 1,
        originalText: match[0],
        suggestedFix: `![Descriptive image explanation](${match[2]})`,
      });
    }
  });

  // 4. Heading Concept Lacking Code Examples
  let currentHeading = "";
  let currentSectionHasCode = false;

  lines.forEach((lineText) => {
    if (lineText.startsWith("## ") || lineText.startsWith("### ")) {
      if (currentHeading && !currentSectionHasCode) {
        suggestions.push({
          id: `missing-code-${currentHeading.replace(/\s+/g, "-")}`,
          type: "code",
          severity: "warning",
          title: "Concept Missing Code Example",
          message: `Section "${currentHeading}" explains concepts without a practical code snippet. Add a code block (\`\`\`bash ... \`\`\`).`,
        });
      }
      currentHeading = lineText.replace(/^#+\s*/, "").trim();
      currentSectionHasCode = false;
    } else if (lineText.trim().startsWith("```")) {
      currentSectionHasCode = true;
    }
  });

  // 5. Internal Link Suggestions
  KNOWN_CURRICULUM_CONCEPTS.forEach((concept) => {
    if (
      plainText.toLowerCase().includes(concept.keyword) &&
      !markdown.includes(`/lessons/${concept.slug}`)
    ) {
      suggestions.push({
        id: `link-suggestion-${concept.slug}`,
        type: "internal_link",
        severity: "info",
        title: "Internal Link Suggestion",
        message: `Topic mentions "${concept.keyword}". Consider linking to the lesson: [${concept.title}](/lessons/${concept.slug}).`,
        suggestedFix: `[${concept.title}](/lessons/${concept.slug})`,
      });
    }
  });

  return {
    wordCount,
    sentenceCount,
    syllableCount: totalSyllables,
    readingEaseScore,
    gradeLevel,
    suggestions,
  };
}
