import { fetchApi } from "./api";

export interface Exercise {
  id?: number;
  title: string;
  prompt: string;
  expected_command?: string;
  explanation?: string;
  points?: number;
}

export interface ConflictScenario {
  baseBranchName: string;
  featureBranchName: string;
  fileContent: string; // The file content containing Git conflict markers (<<<<<<< HEAD)
}

export interface PythonExercise {
  prompt: string;
  starterCode: string;
  testCode: string; // Hidden code appended after user code to run assertions
  hint?: string;
}

export interface Lesson {
  slug: string; // used for URL
  title: string;
  description: string; // summary
  explanation: string; // content or long text
  expected: string | RegExp; // validation pattern or exact string
  hint: string;
  difficulty?: string;
  points?: number;
  estimatedMinutes?: number;
  learningObjectives?: string[];
  tips?: string[]; // optional tips/mistakes guidance
  exercises?: Exercise[];
  order?: number;
  filePath?: string;
  quizzes?: Array<{
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  }>;
  conflictScenario?: ConflictScenario;
  pythonExercise?: PythonExercise;
  category?: string;
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

// Fetch lessons from live API
export async function fetchLessonsApi(): Promise<Lesson[]> {
  try {
    const data = await fetchApi("/content/lessons/", { requireAuth: false });
    if (!Array.isArray(data)) return lessons;

    return data.map((les: any, index: number) => {
      const firstExercise = les.exercises?.[0];
      return {
        slug: les.slug,
        title: les.title,
        description: les.summary || "",
        explanation: les.content || "", // Will load dynamically from backend
        expected: firstExercise?.expectedCommand || "",
        hint: firstExercise?.explanation || "Read the lesson contents and solve the check.",
        difficulty: les.difficulty || "beginner",
        points: firstExercise?.points || 15,
        estimatedMinutes: les.estimatedMinutes || 10,
        learningObjectives: les.learningObjectives || [],
        tips: les.tips || [],
        exercises: les.exercises || [],
        quizzes: les.quizzes || [],
        conflictScenario: les.conflictScenario || undefined,
        pythonExercise: les.pythonExercise || undefined,
        order: les.order || index,
        category: les.category || "general",
        filePath: les.filePath,
      };
    });
  } catch (err) {
    console.error("Error loading live curriculum:", err);
    return lessons;
  }
}

export function buildModulesFromLessons(lessonsList: Lesson[]) {
  const modulesMap = new Map<string, any>();
  lessonsList.forEach((les) => {
    const cat = les.category || "general";
    if (!modulesMap.has(cat)) {
      modulesMap.set(cat, {
        id: cat,
        title: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, " "),
        lessons: [],
      });
    }
    modulesMap.get(cat).lessons.push({
      slug: les.slug,
      title: les.title,
      difficulty: les.difficulty,
    });
  });
  return Array.from(modulesMap.values());
}

// Fetch markdown text content for a lesson
export async function fetchLessonContent(filePath: string): Promise<string> {
  try {
    const response = await fetch(`/content/${filePath}`);
    if (!response.ok) throw new Error(`Markdown file not found: ${filePath}`);
    return await response.text();
  } catch (err) {
    console.error("Error loading lesson markdown content:", err);
    return "# Content not found\nCould not retrieve the detailed documentation for this lesson.";
  }
}
