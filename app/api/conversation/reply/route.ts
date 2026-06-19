import { NextResponse } from "next/server";
import { coachReply } from "@/lib/anthropic";
import { getSettings } from "@/lib/settings";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/conversation/reply — get the coach's next message.
 * Body: { targetWords: string[], messages: ChatMessage[] }
 * The client owns the full message history (React state); this endpoint is
 * stateless and just returns the assistant's next turn.
 */
export async function POST(req: Request) {
  try {
    const { targetWords, messages } = (await req.json()) as {
      targetWords?: string[];
      messages?: ChatMessage[];
    };
    if (!Array.isArray(targetWords) || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Provide targetWords[] and messages[]." },
        { status: 400 },
      );
    }
    const settings = await getSettings();
    const reply = await coachReply(
      targetWords,
      messages,
      settings.conversation_turns,
    );
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
