import { GoogleGenAI, Type } from "@google/genai";
import { Challenge, GradingResult, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || "" });

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
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
- Provide a description of the task and a sample input/output context if applicable.${avoidBlock}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Clear description of what the user needs to do." },
          context: { type: Type.STRING, description: "Sample input or environment context (e.g. 'You have a list named data with...') " },
          expectedCommandHint: { type: Type.STRING, description: "A small generic hint about the syntax or functions to use without providing the full answer." },
          difficulty: { type: Type.STRING, enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] }
        },
        required: ["description", "context", "expectedCommandHint", "difficulty"]
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
