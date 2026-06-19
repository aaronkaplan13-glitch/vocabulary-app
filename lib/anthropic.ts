import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./config";
import type {
  ChatMessage,
  ConversationEvaluation,
  WordGeneration,
} from "./types";

// Lazily constructed so importing this module during build doesn't require the key.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Copy .env.example to .env.local and fill it in.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/** Pull the input object out of a forced tool_use response. */
function toolInput<T>(message: Anthropic.Message): T {
  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude did not return the expected structured output.");
  }
  return block.input as T;
}

/** Pull plain text out of a normal message response. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// ---------------------------------------------------------------------------
// 1. Word generation: definition, part of speech, example, and morphemes.
// ---------------------------------------------------------------------------
const WORD_TOOL: Anthropic.Tool = {
  name: "record_word",
  description:
    "Record the structured linguistic breakdown of a vocabulary word.",
  input_schema: {
    type: "object",
    properties: {
      definition: {
        type: "string",
        description: "A clear, concise learner-friendly definition.",
      },
      part_of_speech: {
        type: "string",
        description: "e.g. noun, verb, adjective, adverb.",
      },
      example_sentence: {
        type: "string",
        description:
          "A natural example sentence that demonstrates the word in context.",
      },
      morphemes: {
        type: "array",
        description:
          "The word broken into its meaningful parts, in left-to-right order. Omit if the word is a single unanalyzable morpheme.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["prefix", "root", "suffix", "infix", "combining"],
            },
            text: {
              type: "string",
              description: "The morpheme form, e.g. 'bene', 'volent', 'ation'.",
            },
            meaning: {
              type: "string",
              description: "What this morpheme contributes, e.g. 'good', 'wish'.",
            },
          },
          required: ["type", "text", "meaning"],
        },
      },
    },
    required: ["definition", "part_of_speech", "example_sentence", "morphemes"],
  },
};

export async function generateWord(word: string): Promise<WordGeneration> {
  const message = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    tools: [WORD_TOOL],
    tool_choice: { type: "tool", name: "record_word" },
    system:
      "You are a precise etymologist and lexicographer. Break vocabulary words into their true morphemes (prefix/root/suffix) with accurate meanings drawn from their etymology. Keep definitions concise and learner-friendly.",
    messages: [
      {
        role: "user",
        content: `Analyze the word: "${word}". Provide its definition, part of speech, one example sentence, and its morpheme breakdown.`,
      },
    ],
  });
  return toolInput<WordGeneration>(message);
}

// ---------------------------------------------------------------------------
// 2. Conversation coaching: generate the coach's next reply.
// ---------------------------------------------------------------------------
function coachSystemPrompt(targetWords: string[], maxTurns: number): string {
  return [
    "You are a warm, encouraging conversation coach helping a learner practice vocabulary through active production.",
    `The learner is trying to naturally use these target words during the chat: ${targetWords.join(", ")}.`,
    "Hold a natural, engaging conversation on an everyday topic. Ask open questions that create good openings for the learner to use the target words — but do NOT tell them which words to use, and do NOT use the target words yourself unless the learner uses them first.",
    `Keep the conversation to about ${maxTurns} of the learner's turns. Keep each of your replies to 1-3 sentences.`,
  ].join(" ");
}

export async function coachReply(
  targetWords: string[],
  history: ChatMessage[],
  maxTurns: number,
): Promise<string> {
  const message = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    system: coachSystemPrompt(targetWords, maxTurns),
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });
  return textOf(message);
}

// ---------------------------------------------------------------------------
// 3. Conversation evaluation: did the learner use the target words naturally?
// ---------------------------------------------------------------------------
const EVAL_TOOL: Anthropic.Tool = {
  name: "score_conversation",
  description:
    "Score how naturally and correctly the learner used the target vocabulary words.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        description:
          "0-100. Reward natural, correct, contextually appropriate use of the target words. Penalize forced, incorrect, or missing usage.",
      },
      words_used: {
        type: "array",
        items: { type: "string" },
        description:
          "The target words the learner actually used naturally and correctly.",
      },
      feedback: {
        type: "string",
        description:
          "2-4 sentences of specific, encouraging feedback on the learner's usage, including any corrections.",
      },
    },
    required: ["score", "words_used", "feedback"],
  },
};

export async function evaluateConversation(
  targetWords: string[],
  history: ChatMessage[],
): Promise<ConversationEvaluation> {
  const transcript = history
    .map((m) => `${m.role === "user" ? "Learner" : "Coach"}: ${m.content}`)
    .join("\n");

  const message = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    tools: [EVAL_TOOL],
    tool_choice: { type: "tool", name: "score_conversation" },
    system:
      "You evaluate vocabulary practice conversations. Judge only the learner's turns. A word counts as 'used' only if it appears in a learner turn with correct meaning and natural phrasing.",
    messages: [
      {
        role: "user",
        content: `Target words: ${targetWords.join(", ")}\n\nTranscript:\n${transcript}\n\nScore how naturally and correctly the learner used the target words.`,
      },
    ],
  });
  return toolInput<ConversationEvaluation>(message);
}
