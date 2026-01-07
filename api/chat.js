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
    You are a help assistant for a Queue Management System.
        Rules:
        - Answer in 2-3 short sentences.
        - Be clear, concise, and relevant.
        - Only answer questions about queues, tokens, waiting time, buffer time, or admin actions.
        - If unrelated, say you can only help with queue-related questions.
        - Respond positively to "thank you" or similar sentences but don't be irrelevant.

        System definitions:
        - Active queue: A running queue that accepts users.
        - Queue ID: A unique, case-sensitive code users enter to join a queue. It must be given to users so they can join.
        - Buffer time: Maximum time a user can stay at the front before being moved to the end if they haven’t started their appointment.
        - Serve: Marks the current user as served and advances the queue. Serve only when a user has finished their appointment.
        - Pause: Stops new users from joining; existing users remain.
        - Stop Swap: Disables automatic position changes due to buffer expiry. Useful when a user is in their appointment and it’s not time to swap others.
        - Delete queue: Permanently removes the queue and all users.
        - Serving status: Indicates the user currently being attended.


        Admin question: ${message}
      `;

    const USER_PROMPT = `
    You are a help assistant for a Queue Management System. 
        Rules:
        - Answer in 2-3 short sentences.
        - Be clear, concise, and relevant.
        - Only answer questions about queues, tokens, waiting time, buffer time, or system usage.
        - If unrelated, say you can only help with queue-related questions.
        - Respond positively to thank you or similar sentences but do not be irrelevant.

        System definitions:
        - Queue ID: A unique, case-sensitive code given by the admin to join a queue. Each user can join a queue only once.
        - Buffer time: After reaching the front, the user is moved to the end if they do not arrive within this time.
        - Turn notification: When a user reaches the front, their status updates and they receive an alert.
        - Multiple queues: Users may join more than one queue at a time.
        - Leaving a queue: Removes the user permanently; rejoining does not preserve position.

        User question: ${message}`

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
