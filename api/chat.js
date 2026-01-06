import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, chat_type = "user" } = req.body || {};

    if (!message) {
      return res.json({ reply: "Please ask a question." });
    }

    const ADMIN_PROMPT = `
You are a help assistant for a Queue Management System (admin side).
Rules:
- Answer in 2-3 short sentences.
- Be clear and concise.
- Only answer admin queue-related questions.

Admin question: ${message}
`;

    const USER_PROMPT = `
You are a help assistant for a Queue Management System.
Rules:
- Answer in 2-3 short sentences.
- Be clear and concise.
- Only answer queue-related questions.

User question: ${message}
`;

    const prompt = chat_type === "admin" ? ADMIN_PROMPT : USER_PROMPT;

    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash" 
    });

    const result = await model.generateContent(prompt);

    return res.json({ reply: result.response.text() });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
