import { GoogleGenAI, Type } from "@google/genai";
import { Challenge, GradingResult, Difficulty, ProgressEvaluationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || "" });

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
}

function looksLikeCodeOrSolution(text: string): boolean {
  // Block fenced code and common full-solution patterns.
  if (/```/m.test(text)) return true;
  if (/^\s*(def|class)\s+\w+/m.test(text)) return true;
  if (/^\s*for\s+\w+\s+in\s+/m.test(text)) return true;
  if (/^\s*while\s+.+:/m.test(text)) return true;
  return false;
}

function sanitizeProgressEvaluation(result: ProgressEvaluationResult): ProgressEvaluationResult {
  const combined = [
    result.summary,
    ...(result.issues ?? []),
    ...(result.hints ?? []),
  ].join("\n");

  if (looksLikeCodeOrSolution(combined)) {
    return {
      correct: false,
      summary:
        "I can’t show code or a full solution here, but I can still help you spot what to improve.",
      issues: [
        "Your current attempt is missing one or more key pieces required by the prompt (or has a logical mismatch).",
      ],
      hints: [
        "Re-read the challenge and verify your output/return value matches exactly.",
        "Check edge cases mentioned or implied by the context (empty input, off-by-one, types).",
        "Make sure you’re using the topic’s intended concept (as hinted by the challenge).",
      ],
      confidence: "LOW",
    };
  }

  if (result.correct) {
    return {
      ...result,
      summary:
        result.summary?.trim().length > 0
          ? result.summary
          : "Your answer looks correct. Go ahead and submit it.",
      issues: [],
      hints: [],
    };
  }

  return result;
}

type AvoidChallenge = Pick<Challenge, "description" | "context">;

export async function generateChallenge(
  topicId: string,
  difficulty: Difficulty = "BEGINNER",
  options?: {
    avoidExactChallenges?: AvoidChallenge[];
  }
): Promise<Challenge> {
  const avoidBlock =
    options?.avoidExactChallenges && options.avoidExactChallenges.length > 0
      ? `\n\nDo NOT repeat any of the following challenges exactly (same task/wording). Generate a different task:\n${options.avoidExactChallenges
          .slice(0, 5)
          .map(
            (c, idx) =>
              `${idx + 1}. Description: ${c.description}\n   Context: ${c.context}`
          )
          .join("\n")}`
      : "";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Generate a Python programming challenge for the topic: ${topicId}.
Difficulty Level: ${difficulty}.

Requirements:
- The challenge should be a specific task the user needs to complete by writing a Python snippet.
- The target topic (${topicId}) MUST be the primary focus/learning objective of the task.
- Provide a description of the task and a sample input/output context if applicable.
- Include expectedOutcomeCriteria: concise behavioral success criteria (no code).
- Include expectedReferenceSolution: a canonical Python reference solution that satisfies the task.${avoidBlock}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Clear description of what the user needs to do." },
          context: { type: Type.STRING, description: "Sample input or environment context (e.g. 'You have a list named data with...') " },
          expectedCommandHint: { type: Type.STRING, description: "A small generic hint about the syntax or functions to use without providing the full answer." },
          expectedOutcomeCriteria: {
            type: Type.STRING,
            description: "Behavioral success criteria for a correct solution (no code).",
          },
          expectedReferenceSolution: {
            type: Type.STRING,
            description: "Canonical Python reference solution for evaluator use.",
          },
          difficulty: { type: Type.STRING, enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] }
        },
        required: [
          "description",
          "context",
          "expectedCommandHint",
          "expectedOutcomeCriteria",
          "expectedReferenceSolution",
          "difficulty",
        ]
      },
      systemInstruction: "You are an expert Python programming tutor. You generate concise, educational coding challenges for specific Python topics. Focus on practical, real-world scenarios and Pythonic practices."
    }
  });

  try {
    const cleanedText = cleanJsonResponse(response.text || "{}");
    const parsed = JSON.parse(cleanedText);
    return {
      ...parsed,
      topicId // Ensure topicId is preserved
    } as Challenge;
  } catch (e) {
    throw new Error("Failed to parse AI response for challenge generation.");
  }
}

export async function gradeSubmission(challenge: Challenge, submission: string): Promise<GradingResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `
    Challenge Description: ${challenge.description}
    Context: ${challenge.context}
    User Submission: 
    \`\`\`python
    ${submission}
    \`\`\`

    Grade this submission. Is it correct? Does it achieve the goal described?
    Provide a gentle explanation if wrong and the correct solution.
    If the user's code is a valid alternative that works, mark it as correct.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING, description: "Gentle feedback about the user's attempt." },
          solution: { type: Type.STRING, description: "The ideal Python code solution." }
        },
        required: ["correct", "feedback", "solution"]
      },
      systemInstruction: "You are an expert Python programming tutor. You grade user submissions accurately without executing code. Be encouraging but precise. Accept valid alternative solutions and Pythonic code."
    }
  });

  try {
    const cleanedText = cleanJsonResponse(response.text || "{}");
    return JSON.parse(cleanedText) as GradingResult;
  } catch (e) {
    throw new Error("Failed to parse AI response for grading.");
  }
}

export async function evaluateProgress(
  challenge: Challenge,
  submission: string,
  options?: { compactWhenCorrect?: boolean }
): Promise<ProgressEvaluationResult> {
  const compactWhenCorrect = options?.compactWhenCorrect ?? true;
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: `
Challenge Description: ${challenge.description}
Context: ${challenge.context}
Expected Outcome Criteria: ${challenge.expectedOutcomeCriteria}
Reference Solution (for evaluator context only):
\`\`\`python
${challenge.expectedReferenceSolution}
\`\`\`
User Submission:
\`\`\`python
${submission}
\`\`\`

Evaluate the user's progress toward a correct solution.
Use the expected criteria and reference solution only as evaluation anchors.
Mark correct=true if the user's code is functionally equivalent, even if implementation differs.
You MUST NOT provide a full solution, full code, or step-by-step instructions.
You MUST NOT provide any code blocks.
Only point out what is incorrect/missing and provide concept-level hints (functions/ideas to consider).
All issues and hints must stay within this challenge's scope and map to mismatches with the challenge requirements/expected criteria.
If the user's submission is fully correct, set correct=true. In that case:
- summary should say it's correct and suggest the user submit
- issues MUST be an empty array
- hints MUST be an empty array
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          summary: {
            type: Type.STRING,
            description:
              "1–3 sentences describing current progress and the most important gap (no code).",
          },
          issues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Concrete problems with the current attempt (no code; no full solution).",
          },
          hints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Concept-level hints: what to think about or which Python concepts to consider (no code).",
          },
          confidence: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        },
        required: ["correct", "summary", "issues", "hints", "confidence"],
      },
      systemInstruction:
        "You are an expert Python tutor. You only evaluate progress and provide hints. Never reveal a complete solution, never write full code, and never give step-by-step solving instructions. Be brief, specific, and safe.",
    },
  });

  try {
    const cleanedText = cleanJsonResponse(response.text || "{}");
    const parsed = JSON.parse(cleanedText) as ProgressEvaluationResult;
    const sanitized = sanitizeProgressEvaluation(parsed);
    if (compactWhenCorrect && sanitized.correct) {
      return { ...sanitized, issues: [], hints: [] };
    }
    return sanitized;
  } catch (e) {
    throw new Error("Failed to parse AI response for progress evaluation.");
  }
}
