import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import weaviate from 'weaviate-ts-client';

const client = weaviate.client({
  scheme: 'http',
  host: process.env.WEAVIATE_HOST || 'localhost:8080',
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const chatbotId = params.id;
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileContent = await file.text();
    
    // Create a unique ID for the document
    const documentId = `${chatbotId}-${Date.now()}`;

    // Store the document in Weaviate
    await client.data.creator()
      .withClassName('Document')
      .withProperties({
        content: fileContent,
        filename: file.name,
        chatbotId: chatbotId,
      })
      .withId(documentId)
      .do();

    return NextResponse.json({ message: 'File uploaded and processed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json({ error: 'Error processing file' }, { status: 500 });
  }
}
