import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateConversation } from "@/lib/anthropic";
import { USER_ID } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/conversation — list past coaching sessions (most recent first). */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", USER_ID)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/conversation — end of a coaching session.
 * Body: { targetWords: string[], messages: ChatMessage[] }
 * Evaluates the transcript with Claude and persists the final log + score.
 * (Per the brief, this is the ONLY DB write for conversation mode.)
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

    const evaluation = await evaluateConversation(targetWords, messages);

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: USER_ID,
        target_words: targetWords,
        words_used: evaluation.words_used,
        transcript: messages,
        score: evaluation.score,
        feedback: evaluation.feedback,
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, evaluation }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
