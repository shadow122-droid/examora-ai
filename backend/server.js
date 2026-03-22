import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import aiRoutes from "./routes/aiRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Examora AI backend is running");
});

app.use("/api/ai", aiRoutes);
app.use("/api/pdf", pdfRoutes);

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("process.env.PORT =", process.env.PORT);
  console.log(`Server running on port ${PORT}`);
});