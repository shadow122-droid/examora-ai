import express from "express";
import multer from "multer";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { createRequire } from "module";
import crypto from "crypto";

dotenv.config();

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const router = express.Router();
const upload = multer();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama-3.3-70b-versatile";

// In-memory job store (good for local project)
const jobs = {};

function chunkText(text, chunkSize = 5000) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  for (let i = 0; i < cleanText.length; i += chunkSize) {
    chunks.push(cleanText.slice(i, i + chunkSize));
  }

  return chunks;
}

router.get("/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

router.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No readable text found in PDF" });
    }

    const chunks = chunkText(text, 5000);
    const jobId = crypto.randomUUID();

    jobs[jobId] = {
      status: "processing",
      currentPart: 0,
      totalParts: chunks.length,
      progress: 0,
      message: `Starting analysis...`,
      result: null,
      type: "explain",
    };

    res.json({
      jobId,
      totalParts: chunks.length,
    });

    // Background processing
    (async () => {
      try {
        const chunkExplanations = [];

        for (let i = 0; i < chunks.length; i++) {
          jobs[jobId].currentPart = i + 1;
          jobs[jobId].progress = Math.round(((i + 1) / chunks.length) * 100);
          jobs[jobId].message = `Analyzing Part ${i + 1} of ${chunks.length}`;

          const response = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content:
                  "You are a smart study assistant. Explain this part of the notes in simple language using headings, bullet points, and short paragraphs. Keep it concise but useful.",
              },
              {
                role: "user",
                content: `This is chunk ${i + 1} of ${chunks.length}:\n\n${chunks[i]}`,
              },
            ],
            model: MODEL,
          });

          chunkExplanations.push(
            `## Part ${i + 1}\n${response.choices[0].message.content}`
          );
        }

        jobs[jobId].message = "Combining all parts into final answer...";
        jobs[jobId].progress = 95;

        const finalResponse = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are a smart study assistant. Combine the following chunk-wise explanations into one clean final answer. Remove repetition. Use proper headings, bullet points, and short paragraphs. End with a quick revision summary.",
            },
            {
              role: "user",
              content: chunkExplanations.join("\n\n"),
            },
          ],
          model: MODEL,
        });

        jobs[jobId].status = "completed";
        jobs[jobId].progress = 100;
        jobs[jobId].message = "Analysis complete";
        jobs[jobId].result = finalResponse.choices[0].message.content;
      } catch (error) {
        console.error("FULL PDF EXPLAIN ERROR:", error);
        jobs[jobId].status = "failed";
        jobs[jobId].message = "Full PDF processing failed";
      }
    })();
  } catch (error) {
    console.error("PDF ERROR:", error);
    res.status(500).json({ error: "PDF processing failed" });
  }
});

router.post("/questions", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No readable text found in PDF" });
    }

    const chunks = chunkText(text, 5000);
    const jobId = crypto.randomUUID();

    jobs[jobId] = {
      status: "processing",
      currentPart: 0,
      totalParts: chunks.length,
      progress: 0,
      message: `Starting question generation...`,
      result: null,
      type: "questions",
    };

    res.json({
      jobId,
      totalParts: chunks.length,
    });

    // Background processing
    (async () => {
      try {
        const chunkQuestions = [];

        for (let i = 0; i < chunks.length; i++) {
          jobs[jobId].currentPart = i + 1;
          jobs[jobId].progress = Math.round(((i + 1) / chunks.length) * 100);
          jobs[jobId].message = `Analyzing Part ${i + 1} of ${chunks.length}`;

          const response = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content:
                  "You are a smart study assistant. From this notes chunk, generate important exam questions in markdown using this structure:\n\n## 2 Marks\n- ...\n\n## 5 Marks\n- ...\n\n## 10 Marks\n- ...\n\nKeep questions exam-oriented and relevant.",
              },
              {
                role: "user",
                content: `This is chunk ${i + 1} of ${chunks.length}:\n\n${chunks[i]}`,
              },
            ],
            model: MODEL,
          });

          chunkQuestions.push(response.choices[0].message.content);
        }

        jobs[jobId].message = "Combining final question set...";
        jobs[jobId].progress = 95;

        const finalResponse = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "Combine the following question sets into one final clean list. Remove duplicates. Keep only the most important questions. Return in markdown format with these headings only:\n\n## 2 Marks\n## 5 Marks\n## 10 Marks",
            },
            {
              role: "user",
              content: chunkQuestions.join("\n\n"),
            },
          ],
          model: MODEL,
        });

        jobs[jobId].status = "completed";
        jobs[jobId].progress = 100;
        jobs[jobId].message = "Question generation complete";
        jobs[jobId].result = finalResponse.choices[0].message.content;
      } catch (error) {
        console.error("FULL PDF QUESTION ERROR:", error);
        jobs[jobId].status = "failed";
        jobs[jobId].message = "Full PDF question generation failed";
      }
    })();
  } catch (error) {
    console.error("QUESTION PDF ERROR:", error);
    res.status(500).json({ error: "Question generation failed" });
  }
});

export default router;