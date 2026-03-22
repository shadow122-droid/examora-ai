import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Groq from "groq-sdk";

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

router.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: "Question is required",
      });
    }

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a smart study assistant. Answer in clean markdown format using short paragraphs, headings, and bullet points where useful. Keep explanations student-friendly and exam-oriented.",
        },
        {
          role: "user",
          content: question,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    res.json({
      answer: response.choices[0].message.content,
    });
  } catch (error) {
    console.error("AI ERROR:", error);
    res.status(500).json({
      error: "AI request failed",
    });
  }
});

export default router;