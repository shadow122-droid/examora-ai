import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import aiRoutes from "./routes/aiRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://examora-ai.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.options("*", cors());

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.status(200).send("Examora AI backend is running");
});

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.use("/api/ai", aiRoutes);
app.use("/api/pdf", pdfRoutes);

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("process.env.PORT =", process.env.PORT);
  console.log(`Server running on port ${PORT}`);
});