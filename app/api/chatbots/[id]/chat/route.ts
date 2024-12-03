import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import OpenAI from "openai";
import weaviate, { WeaviateClient } from 'weaviate-ts-client';

const weaviateClient: WeaviateClient = weaviate.client({
  scheme: 'http',
  host: process.env.WEAVIATE_HOST || 'localhost:8080',
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const chatbotId = params.id;
    const { messages } = await req.json();

    // Retrieve the chatbot from the database
    const chatbot = await db.chatbot.findUnique({
      where: { id: chatbotId },
      include: { model: true },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Query Weaviate for relevant context
    const userMessage = messages[messages.length - 1].content;
    const weaviateResponse = await weaviateClient.graphql
      .get()
      .withClassName('Document')
      .withFields(['content', 'filename'])
      .withNearText({
        concepts: [userMessage],
        distance: 0.7,
      })
      .withLimit(1)
      .do();

    const relevantContext = weaviateResponse.data.Get.Document[0]?.content || '';

    // Prepare the messages array with the system message and relevant context
    const contextualizedMessages = [
      { role: "system", content: chatbot.prompt },
      { role: "system", content: `Relevant context: ${relevantContext}` },
      ...messages
    ];

    // Generate a response using the OpenAI API
    const completion = await openai.chat.completions.create({
      model: chatbot.model?.name || 'gpt-3.5-turbo', // Fallback to a default model if chatbot.model is null
      messages: contextualizedMessages,
    });

    const assistantMessage = completion.choices[0].message;

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
