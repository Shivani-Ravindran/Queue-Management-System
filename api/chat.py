from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import traceback
from dotenv import load_dotenv

# Load API key
load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__)
CORS(app)

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()

        if not data or "message" not in data:
            return jsonify({"reply": "Please ask a question."})

        message = data.get("message", "")
        chat_type = data.get("chat_type", "user")

        if not message:
            return jsonify({"reply": "Please ask a question."})

        USER_PROMPT = f"""
        You are a help assistant for a Queue Management System.
        Rules:
        - Answer in 2-3 short sentences.
        - Be clear, concise, and relevant.
        - Only answer questions about queues, tokens, waiting time, buffer time, or system usage.
        - If unrelated, say you can only help with queue-related questions.
        - Respond positively to "thank you" or similar sentences but don't be irrelevant.

        System definitions:
        - Queue ID: A unique, case-sensitive code given by the admin to join a queue. Each user can join a queue only once.
        - Buffer time: After reaching the front, the user is moved to the end if they don’t arrive within this time.
        - Turn notification: When a user reaches the front, their status updates and they receive an alert.
        - Multiple queues: Users may join more than one queue at a time.
        - Leaving a queue: Removes the user permanently; rejoining does not preserve position.

        User question: {message}
        """

        ADMIN_PROMPT = f"""
        You are a help assistant for a Queue Management System (admin side).
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


        Admin question: {message}
        """


        prompt = ADMIN_PROMPT if chat_type == "admin" else USER_PROMPT

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "role": "user",
                    "parts": [{"text": prompt}]
                }
            ]
        )

        return jsonify({"reply": response.text})

    except Exception as e:
        if "RESOURCE_EXHAUSTED" in str(e):
            return jsonify({"reply": "Chatbot is temporarily busy. Please try again."})

        traceback.print_exc()
        return jsonify({"error": "Something went wrong."}), 500



