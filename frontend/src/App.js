import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function App() {
  const [username, setUsername] = useState("");
  const [savedUsers, setSavedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("examora_current_user") || ""
  );

  const [question, setQuestion] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [chats, setChats] = useState([
    {
      id: Date.now().toString(),
      title: "New Chat",
      createdAt: new Date().toISOString(),
      messages: [],
    },
  ]);
  const [activeChat, setActiveChat] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);

  const chatEndRef = useRef(null);
  const isMobile = window.innerWidth <= 900;

  const storageKey = currentUser
    ? `examora_chats_${currentUser.toLowerCase().trim()}`
    : null;

  const currentChat = chats[activeChat] || chats[0];
  const messages = currentChat?.messages || [];

  useEffect(() => {
    const users = localStorage.getItem("examora_users");
    if (users) {
      try {
        setSavedUsers(JSON.parse(users));
      } catch (error) {
        console.error("Failed to parse saved users:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!storageKey) return;

    const savedChats = localStorage.getItem(storageKey);
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats);
        if (Array.isArray(parsedChats) && parsedChats.length > 0) {
          setChats(parsedChats);
          setActiveChat(0);
          return;
        }
      } catch (error) {
        console.error("Failed to parse saved chats:", error);
      }
    }

    setChats([
      {
        id: Date.now().toString(),
        title: "New Chat",
        createdAt: new Date().toISOString(),
        messages: [],
      },
    ]);
    setActiveChat(0);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(chats));
  }, [chats, storageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, loading, progressInfo]);

  const saveUserIfNew = (name) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const existingUsers = JSON.parse(localStorage.getItem("examora_users") || "[]");

    const alreadyExists = existingUsers.some(
      (user) => user.toLowerCase() === cleanName.toLowerCase()
    );

    if (!alreadyExists) {
      const updatedUsers = [...existingUsers, cleanName];
      localStorage.setItem("examora_users", JSON.stringify(updatedUsers));
      setSavedUsers(updatedUsers);
    }
  };

  const handleLogin = () => {
    const cleanName = username.trim();
    if (!cleanName) return;

    saveUserIfNew(cleanName);
    localStorage.setItem("examora_current_user", cleanName);
    setCurrentUser(cleanName);
    setUsername("");
  };

  const handleSelectSavedUser = (e) => {
    const selectedUser = e.target.value;
    if (!selectedUser) return;

    localStorage.setItem("examora_current_user", selectedUser);
    setCurrentUser(selectedUser);
    setUsername("");
  };

  const handleLogout = () => {
    localStorage.removeItem("examora_current_user");
    setCurrentUser("");
    setQuestion("");
    setPdfFile(null);
    setLoading(false);
    setProgressInfo(null);
    setChats([
      {
        id: Date.now().toString(),
        title: "New Chat",
        createdAt: new Date().toISOString(),
        messages: [],
      },
    ]);
    setActiveChat(0);
  };

  const removeSavedUser = (userToRemove) => {
    const updatedUsers = savedUsers.filter((u) => u !== userToRemove);
    localStorage.setItem("examora_users", JSON.stringify(updatedUsers));
    setSavedUsers(updatedUsers);

    localStorage.removeItem(`examora_chats_${userToRemove.toLowerCase().trim()}`);

    if (currentUser === userToRemove) {
      handleLogout();
    }
  };

  const updateChatMessages = (chatIndex, newMessages) => {
    const updatedChats = [...chats];
    updatedChats[chatIndex] = {
      ...updatedChats[chatIndex],
      messages: newMessages,
      title:
        updatedChats[chatIndex].title === "New Chat" && newMessages.length > 0
          ? newMessages[0].text.slice(0, 24)
          : updatedChats[chatIndex].title,
    };
    setChats(updatedChats);
  };

  const pollJobStatus = (jobId, chatIndex) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/pdf/status/${jobId}`);
        const job = res.data;

        setProgressInfo({
          progress: job.progress,
          message: job.message,
          currentPart: job.currentPart,
          totalParts: job.totalParts,
        });

        if (job.status === "completed") {
          clearInterval(interval);

          const latestChats = JSON.parse(localStorage.getItem(storageKey)) || chats;
          const targetChat = latestChats[chatIndex] || latestChats[0];
          const newMessages = [
            ...(targetChat.messages || []),
            { type: "ai", text: job.result },
          ];

          const updatedChats = [...latestChats];
          updatedChats[chatIndex] = {
            ...updatedChats[chatIndex],
            messages: newMessages,
          };

          setChats(updatedChats);
          setLoading(false);
          setProgressInfo(null);
        }

        if (job.status === "failed") {
          clearInterval(interval);
          setLoading(false);
          setProgressInfo({
            progress: 0,
            message: "Processing failed",
            currentPart: 0,
            totalParts: 0,
          });
        }
      } catch (error) {
        clearInterval(interval);
        setLoading(false);
        setProgressInfo(null);
        alert("Failed to fetch progress");
      }
    }, 1000);
  };

  const askAI = async () => {
    if (!question.trim()) return;

    const currentQuestion = question;
    const chatIndex = activeChat;
    const chat = chats[chatIndex];
    const newMessages = [
      ...(chat.messages || []),
      { type: "user", text: currentQuestion },
    ];

    updateChatMessages(chatIndex, newMessages);
    setQuestion("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/ai/ask`, {
        question: currentQuestion,
      });

      updateChatMessages(chatIndex, [
        ...newMessages,
        { type: "ai", text: res.data.answer },
      ]);
    } catch (error) {
      updateChatMessages(chatIndex, [
        ...newMessages,
        { type: "ai", text: "Error fetching response" },
      ]);
    }

    setLoading(false);
  };

  const uploadPDF = async () => {
    if (!pdfFile) return;

    const formData = new FormData();
    formData.append("pdf", pdfFile);
    const chatIndex = activeChat;

    setLoading(true);
    setProgressInfo({
      progress: 0,
      message: "Uploading PDF...",
      currentPart: 0,
      totalParts: 0,
    });

    try {
      const res = await axios.post(`${API_URL}/api/pdf/upload`, formData);

      pollJobStatus(res.data.jobId, chatIndex);
    } catch (error) {
      setLoading(false);
      setProgressInfo(null);
      alert("PDF upload failed");
    }
  };

  const generateQuestionsFromPDF = async () => {
    if (!pdfFile) return;

    const formData = new FormData();
    formData.append("pdf", pdfFile);
    const chatIndex = activeChat;

    setLoading(true);
    setProgressInfo({
      progress: 0,
      message: "Uploading PDF...",
      currentPart: 0,
      totalParts: 0,
    });

    try {
      const res = await axios.post(`${API_URL}/api/pdf/questions`, formData);

      pollJobStatus(res.data.jobId, chatIndex);
    } catch (error) {
      setLoading(false);
      setProgressInfo(null);
      alert("Question generation failed");
    }
  };

  const newChat = () => {
    const newChatObj = {
      id: Date.now().toString(),
      title: "New Chat",
      createdAt: new Date().toISOString(),
      messages: [],
    };

    setChats([...chats, newChatObj]);
    setActiveChat(chats.length);

    if (isMobile) setSidebarOpen(false);
  };

  const deleteChat = (index) => {
    const updated = chats.filter((_, i) => i !== index);

    if (updated.length === 0) {
      const freshChat = {
        id: Date.now().toString(),
        title: "New Chat",
        createdAt: new Date().toISOString(),
        messages: [],
      };
      setChats([freshChat]);
      setActiveChat(0);
      return;
    }

    setChats(updated);
    setActiveChat(0);
  };

  const selectChat = (index) => {
    setActiveChat(index);
    if (isMobile) setSidebarOpen(false);
  };

  const clearAllUserChats = () => {
    if (!storageKey) return;
    localStorage.removeItem(storageKey);

    const freshChat = {
      id: Date.now().toString(),
      title: "New Chat",
      createdAt: new Date().toISOString(),
      messages: [],
    };

    setChats([freshChat]);
    setActiveChat(0);
  };

  if (!currentUser) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={styles.loginLogo}>🎓✨</div>
          <h1 style={styles.loginTitle}>Examora AI</h1>
          <p style={styles.loginSub}>Prepare Smarter. Score Better.</p>

          {savedUsers.length > 0 && (
            <>
              <select style={styles.userSelect} onChange={handleSelectSavedUser} defaultValue="">
                <option value="" disabled>
                  Select saved user
                </option>
                {savedUsers.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>

              <div style={styles.savedUsersBox}>
                {savedUsers.map((user) => (
                  <div key={user} style={styles.savedUserRow}>
                    <span style={styles.savedUserName}>{user}</span>
                    <button
                      style={styles.removeUserBtn}
                      onClick={() => removeSavedUser(user)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <input
            style={styles.loginInput}
            placeholder="Or enter a new name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />

          <button style={styles.loginButton} onClick={handleLogin}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.appShell}>
        {(sidebarOpen || !isMobile) && (
          <aside
            style={{
              ...styles.sidebar,
              ...(isMobile ? styles.sidebarMobile : {}),
            }}
          >
            <div style={styles.sidebarTop}>
              <div style={styles.logoBox}>
                <div style={styles.logoCircle}>🎓✨</div>
                <div>
                  <div style={styles.logoTitle}>Examora AI</div>
                  <div style={styles.logoSub}>Prepare Smarter. Score Better.</div>
                </div>
              </div>

              <div style={styles.userBadge}>User: {currentUser}</div>

              <button style={styles.newChatBtn} onClick={newChat}>
                + New Chat
              </button>

              <button style={styles.clearBtn} onClick={clearAllUserChats}>
                Clear My Data
              </button>

              <button style={styles.logoutBtn} onClick={handleLogout}>
                Logout
              </button>
            </div>

            <div style={styles.chatList}>
              {chats.map((chat, index) => (
                <div key={chat.id} style={styles.chatRow}>
                  <div
                    onClick={() => selectChat(index)}
                    style={{
                      ...styles.chatItem,
                      ...(activeChat === index ? styles.chatItemActive : {}),
                    }}
                  >
                    <div style={styles.chatItemTitle}>
                      {chat.title || "New Chat"}
                    </div>
                    <div style={styles.chatItemSub}>
                      {chat.messages?.length > 0
                        ? `${chat.messages.length} messages`
                        : "Empty conversation"}
                    </div>
                  </div>

                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteChat(index)}
                    title="Delete chat"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        <main style={styles.main}>
          <div style={styles.topBar}>
            <div style={styles.topLeft}>
              {isMobile && (
                <button
                  style={styles.menuButton}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  ☰
                </button>
              )}
              <div>
                <div style={styles.mainTitle}>Examora AI Workspace</div>
                <div style={styles.mainSub}>
                  Ask doubts, explain notes, and generate exam questions
                </div>
              </div>
            </div>

            <div style={styles.statusBadge}>
              {loading ? "Working..." : "Ready"}
            </div>
          </div>

          <div style={styles.chatPanel}>
            <div style={styles.chatBox}>
              {messages.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>🎓✨</div>
                  <h2 style={styles.emptyHeading}>
                    Start preparing smarter with Examora AI
                  </h2>
                  <p style={styles.emptyText}>
                    Ask a question, upload a PDF, or generate important exam
                    questions from your notes.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={msg.type === "user" ? styles.userRow : styles.aiRow}
                >
                  <div
                    style={
                      msg.type === "user"
                        ? styles.userBubble
                        : styles.aiBubble
                    }
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}

              {loading && progressInfo && (
                <div style={styles.aiRow}>
                  <div style={styles.aiBubble}>
                    <div style={styles.progressText}>{progressInfo.message}</div>
                    <div style={styles.progressBarOuter}>
                      <div
                        style={{
                          ...styles.progressBarInner,
                          width: `${progressInfo.progress || 0}%`,
                        }}
                      />
                    </div>
                    {progressInfo.totalParts > 0 && (
                      <div style={styles.progressSubText}>
                        Part {progressInfo.currentPart} of {progressInfo.totalParts}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div style={styles.bottomArea}>
              <div style={styles.pdfSection}>
                <label style={styles.fileLabel}>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files[0])}
                    style={styles.hiddenInput}
                  />
                  {pdfFile ? pdfFile.name : "Choose PDF"}
                </label>

                <button style={styles.secondaryButton} onClick={uploadPDF}>
                  Explain PDF
                </button>

                <button
                  style={styles.secondaryButton}
                  onClick={generateQuestionsFromPDF}
                >
                  Generate Questions
                </button>
              </div>

              <div style={styles.inputWrap}>
                <input
                  style={styles.input}
                  placeholder="Ask anything about your subject..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askAI()}
                />
                <button style={styles.sendButton} onClick={askAI}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const styles = {
  loginPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top left, #1f3b73 0%, #111827 35%, #0b1020 100%)",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    color: "#fff",
  },
  loginCard: {
    width: "380px",
    maxWidth: "90%",
    padding: "32px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
    textAlign: "center",
  },
  loginLogo: {
    fontSize: "42px",
    marginBottom: "12px",
  },
  loginTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "700",
  },
  loginSub: {
    marginTop: "8px",
    marginBottom: "20px",
    color: "rgba(255,255,255,0.7)",
  },
  userSelect: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.1)",
    outline: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: "15px",
    marginBottom: "14px",
  },
  savedUsersBox: {
    marginBottom: "14px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.05)",
    padding: "10px",
  },
  savedUserRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  savedUserName: {
    fontSize: "14px",
    color: "#e5e7eb",
  },
  removeUserBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    border: "none",
    background: "rgba(239,68,68,0.12)",
    color: "#fecaca",
    cursor: "pointer",
    fontSize: "18px",
    lineHeight: "1",
  },
  loginInput: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.1)",
    outline: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: "15px",
    marginBottom: "14px",
    boxSizing: "border-box",
  },
  loginButton: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37,99,235,0.25)",
  },
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, #1f3b73 0%, #111827 35%, #0b1020 100%)",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    color: "#fff",
  },
  appShell: {
    height: "calc(100vh - 40px)",
    display: "flex",
    gap: "18px",
  },
  sidebar: {
    width: "290px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "18px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },
  sidebarMobile: {
    position: "fixed",
    top: "20px",
    left: "20px",
    bottom: "20px",
    zIndex: 20,
    width: "280px",
  },
  sidebarTop: {
    marginBottom: "16px",
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  logoCircle: {
    width: "54px",
    height: "54px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #60a5fa, #2563eb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    boxShadow: "0 10px 20px rgba(37,99,235,0.3)",
  },
  logoTitle: {
    fontSize: "18px",
    fontWeight: "700",
  },
  logoSub: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.65)",
  },
  userBadge: {
    fontSize: "12px",
    color: "#bfdbfe",
    marginBottom: "10px",
  },
  newChatBtn: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37,99,235,0.25)",
    marginBottom: "10px",
  },
  clearBtn: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    cursor: "pointer",
    marginBottom: "10px",
  },
  logoutBtn: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(239,68,68,0.12)",
    color: "#fecaca",
    cursor: "pointer",
    marginBottom: "12px",
  },
  chatList: {
    overflowY: "auto",
    paddingRight: "4px",
  },
  chatRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  chatItem: {
    flex: 1,
    padding: "12px",
    borderRadius: "14px",
    cursor: "pointer",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid transparent",
    transition: "0.2s",
  },
  chatItemActive: {
    background: "rgba(59,130,246,0.18)",
    border: "1px solid rgba(96,165,250,0.4)",
  },
  chatItemTitle: {
    fontSize: "14px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  chatItemSub: {
    marginTop: "4px",
    fontSize: "11px",
    color: "rgba(255,255,255,0.58)",
  },
  deleteBtn: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "none",
    background: "rgba(255,255,255,0.05)",
    color: "#f87171",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: "1",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
  topBar: {
    borderRadius: "24px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "18px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
    gap: "12px",
    flexWrap: "wrap",
  },
  topLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  menuButton: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "20px",
  },
  mainTitle: {
    fontSize: "22px",
    fontWeight: "700",
  },
  mainSub: {
    marginTop: "4px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.65)",
  },
  statusBadge: {
    padding: "8px 14px",
    borderRadius: "999px",
    background: "rgba(16,185,129,0.16)",
    color: "#86efac",
    fontSize: "13px",
    fontWeight: "600",
    border: "1px solid rgba(134,239,172,0.2)",
  },
  chatPanel: {
    flex: 1,
    borderRadius: "24px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
    minHeight: 0,
  },
  chatBox: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    boxSizing: "border-box",
  },
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "rgba(255,255,255,0.8)",
  },
  emptyIcon: {
    fontSize: "42px",
    marginBottom: "12px",
  },
  emptyHeading: {
    margin: 0,
    fontSize: "24px",
  },
  emptyText: {
    marginTop: "10px",
    maxWidth: "500px",
    lineHeight: "1.6",
    color: "rgba(255,255,255,0.65)",
  },
  userRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "14px",
  },
  aiRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: "14px",
  },
  userBubble: {
    maxWidth: "72%",
    padding: "14px 16px",
    borderRadius: "18px 18px 6px 18px",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
    boxShadow: "0 8px 20px rgba(37,99,235,0.22)",
    lineHeight: "1.6",
    overflowWrap: "break-word",
  },
  aiBubble: {
    maxWidth: "78%",
    padding: "14px 16px",
    borderRadius: "18px 18px 18px 6px",
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#f3f4f6",
    lineHeight: "1.7",
    overflowWrap: "break-word",
  },
  progressText: {
    marginBottom: "10px",
    fontWeight: "600",
  },
  progressBarOuter: {
    width: "100%",
    height: "10px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    background: "linear-gradient(135deg, #60a5fa, #2563eb)",
    borderRadius: "999px",
    transition: "width 0.4s ease",
  },
  progressSubText: {
    marginTop: "8px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.7)",
  },
  bottomArea: {
    padding: "16px 18px 18px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  pdfSection: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  hiddenInput: {
    display: "none",
  },
  fileLabel: {
    padding: "10px 14px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.9)",
    maxWidth: "260px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600",
  },
  inputWrap: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: "220px",
    padding: "15px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.1)",
    outline: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: "15px",
  },
  sendButton: {
    padding: "14px 20px",
    borderRadius: "16px",
    border: "none",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "700",
    boxShadow: "0 10px 20px rgba(37,99,235,0.25)",
  },
};

export default App;