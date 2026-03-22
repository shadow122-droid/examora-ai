# Examora AI 🎓✨

**Prepare Smarter. Score Better.**

Examora AI is an AI-powered exam preparation platform that helps students ask doubts, explain PDF notes, and generate exam-oriented questions using a clean chat-based interface.

## 🚀 Live Demo

- **Frontend:** https://examora-ai.vercel.app
- **Backend:** https://examora-ai.onrender.com

---

## 📌 Features

- AI-powered doubt solving
- Clean chat-based study interface
- PDF upload and explanation
- Exam question generation from PDF notes
- Progress tracking while PDF is being analyzed
- User-wise local storage login system
- Multiple saved users in dropdown
- Persistent chats in browser storage
- Modern glassmorphism UI

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Axios
- React Markdown
- CSS / Inline Styling

### Backend
- Node.js
- Express.js
- Multer
- pdf-parse
- Groq API

### Deployment
- Vercel (Frontend)
- Render (Backend)

---

## 📂 Project Structure

```bash
examora-ai/
│
├── backend/
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   └── pdfRoutes.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── index.css
│   │   └── App.css
│   ├── public/
│   └── package.json
│
└── README.md
