import { NextRequest, NextResponse } from "next/server";
import { auth } from "../auth";
import { db } from "@/lib/db";
import OpenAI from "openai";
import weaviate, { WeaviateClient } from "weaviate-ts-client";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set");
}

if (!process.env.WEAVIATE_HOST) {
  throw new Error("WEAVIATE_HOST is not set");
}

const weaviateClient: WeaviateClient = weaviate.client({
  scheme: "http",
  host: process.env.WEAVIATE_HOST,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const chatbotId = params.id;
    const { messages } = await req.json();

    const chatbot = await db.chatbot.findUnique({
      where: { id: chatbotId },
      include: { model: true },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const userMessage = messages[messages.length - 1].content;
    let relevantContext = "";

    try {
      const weaviateResponse = await weaviateClient.graphql
        .get()
        .withClassName("Document")
        .withFields(["content", "filename"])
        .withNearText({
          concepts: [userMessage],
          distance: 0.7,
        })
        .withLimit(1)
        .do();

      relevantContext = weaviateResponse.data.Get.Document[0]?.content || "";
    } catch (error) {
      console.error("Error querying Weaviate:", error);
      // Continue without context if Weaviate query fails
    }

    const contextualizedMessages = [
      { role: "system", content: chatbot.prompt },
      { role: "system", content: `Relevant context: ${relevantContext}` },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model: chatbot.model?.name || "gpt-3.5-turbo",
      messages: contextualizedMessages as OpenAI.Chat.ChatCompletionMessage[],
    });

    const assistantMessage = completion.choices[0].message;

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
