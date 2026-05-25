import { fetchApi } from "./api";

export interface Exercise {
  id?: number;
  title: string;
  prompt: string;
  expected_command?: string;
  explanation?: string;
  points?: number;
}

export interface Lesson {
  slug: string; // used for URL
  title: string;
  description: string; // summary
  explanation: string; // content or long text
  expected: string | RegExp; // validation pattern or exact string
  hint: string;
  difficulty?: string;
  estimatedMinutes?: number;
  learningObjectives?: string[];
  tips?: string[]; // optional tips/mistakes guidance
  exercises?: Exercise[];
  order?: number;
}

// Small built-in fallback lessons (used if API unreachable)
export const lessons: Lesson[] = [
  {
    slug: "intro",
    title: "Open Source Mindset",
    description: "Understand how open source collaboration actually works.",
    explanation:
      "Open source is not only about code. It includes communication, issue triage, reviews, and consistency.",
    expected: "open-source means collaboration",
    hint: "Type exactly: open-source means collaboration",
    difficulty: "beginner",
    estimatedMinutes: 8,
    learningObjectives: [
      "Understand contributor and maintainer roles",
      "Know where to start in a new repository",
    ],
    tips: [
      "Small pull requests are reviewed faster.",
      "Always read README and CONTRIBUTING first.",
    ],
    order: 0,
  },
];

// Fetch lessons from backend API and map fields to frontend shape.
export async function fetchLessonsApi(): Promise<Lesson[]> {
  try {
    const data = await fetchApi("/content/lessons/");

    if (!Array.isArray(data)) return lessons;

    const mapped: Lesson[] = data.map((l: any) => {
      const firstExercise: Exercise | undefined = (l.exercises && l.exercises[0]) || undefined;
      let expected: string | RegExp = ".+";

      if (firstExercise) {
        if (firstExercise.expected_command && firstExercise.expected_command.trim().length > 0) {
          // use exact match for expected_command when available
          expected = firstExercise.expected_command;
        } else {
          // fallback for reflection-style lessons
          expected = /.+/;
        }
      }

      return {
        slug: l.slug,
        title: l.title,
        description: l.summary || l.description || "",
        explanation: l.content || l.explanation || "",
        expected,
        hint: firstExercise?.prompt || "Read the lesson and run the expected command.",
        difficulty: l.difficulty || "beginner",
        estimatedMinutes: l.estimated_minutes || 10,
        learningObjectives: Array.isArray(l.learning_objectives) ? l.learning_objectives : [],
        tips: Array.isArray(l.tips) ? l.tips : [],
        exercises: l.exercises || [],
        order: l.order ?? 0,
      };
    });

    // sort by order
    mapped.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return mapped;
  } catch (err) {
    // fall back to built-in lessons
    return lessons;
  }
}
