// POST /api/reader/ask
// Answers a question about a selected sentence/paragraph using Gemini.

import { NextRequest, NextResponse } from "next/server"
import { runLLM } from "@/lib/llm/claude"
import { getReaderPaper } from "@/lib/reader/db"
import type { AskAIRequest } from "@/lib/reader/types"

export async function POST(req: NextRequest) {
  const body: AskAIRequest = await req.json()
  const { paperId, selectionText, context, question } = body

  if (!selectionText || !paperId) {
    return NextResponse.json({ error: "paperId and selectionText required" }, { status: 400 })
  }

  const paper = await getReaderPaper(paperId)
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 })

  const prompt = [
    `You are helping a researcher read the paper "${paper.title}".`,
    ``,
    `Selected text:`,
    `"${selectionText}"`,
    ``,
    `Surrounding context:`,
    `${context}`,
    ``,
    `Question: ${question ?? "Please explain this passage clearly and concisely."}`,
    ``,
    `Answer in 2–4 sentences. Be precise and academic in tone.`,
  ].join("\n")

  try {
    const answer = await runLLM(prompt, undefined, "gemini-2.0-flash", 300)
    return NextResponse.json({ answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
