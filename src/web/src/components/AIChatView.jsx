import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const AIChatView = ({ projectId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    axios
      .get(`${API_URL}/projects/${projectId}/chat/`)
      .then((r) => setMessages(r.data))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);

    // /note <text> — create a draft note
    if (trimmed.startsWith("/note ")) {
      const noteText = trimmed.slice(6).trim();
      if (!noteText) { setLoading(false); return; }
      try {
        await axios.post(`${API_URL}/projects/${projectId}/notes`, {
          title: noteText.slice(0, 80),
          body: noteText,
          status: "draft",
        });
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), role: "user", content: trimmed },
          { id: Date.now() + 1, role: "assistant", content: "✓ Draft note created." },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", content: "Error creating note." },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // /report <text> — append verified note
    if (trimmed.startsWith("/report ")) {
      const noteText = trimmed.slice(8).trim();
      if (!noteText) { setLoading(false); return; }
      try {
        await axios.post(`${API_URL}/projects/${projectId}/notes`, {
          title: `Report Note`,
          body: noteText,
          status: "verified",
        });
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), role: "user", content: trimmed },
          { id: Date.now() + 1, role: "assistant", content: "✓ Note appended to report." },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: "assistant", content: "Error appending note." },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // /ask <question> or free text — send to LLM via backend
    const content = trimmed.startsWith("/ask ") ? trimmed.slice(5).trim() : trimmed;
    try {
      await axios.post(`${API_URL}/projects/${projectId}/chat/`, { content });
      const history = await axios.get(`${API_URL}/projects/${projectId}/chat/`);
      setMessages(history.data);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", content: trimmed },
        { id: Date.now() + 1, role: "assistant", content: "Error: Could not reach AI backend." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages flex-grow overflow-y-auto p-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <span className="material-symbols-outlined text-6xl mb-4">robot_2</span>
            <p className="text-sm">Welcome to PwnCortex AI Analyst.</p>
            <p className="text-xs mt-1">Try: <span className="text-primary">/ask</span> about this project, <span className="text-primary">/note</span> Found a bug, or <span className="text-primary">/report</span> add finding</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id || i} className={`message-${m.role}`}>
            <div className="text-xs font-bold uppercase mb-1 opacity-50">{m.role}</div>
            <div className="markdown-content">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && <div className="message-assistant animate-pulse">Thinking...</div>}
        <div ref={scrollRef} />
      </div>
      <form onSubmit={handleSend} className="chat-input-area p-4 border-t border-white/5 bg-main">
        <div className="flex gap-2">
          <input
            autoFocus
            className="flex-grow bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-2 text-[13px] font-mono text-slate-200 focus:outline-none focus:border-primary/40 placeholder-slate-700"
            placeholder="Type /ask, /note, /report, or a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-30"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        <div className="flex gap-4 mt-1.5">
          <span className="text-[10px] text-slate-700 font-mono"><span className="text-slate-500">/note</span> create draft note</span>
          <span className="text-[10px] text-slate-700 font-mono"><span className="text-slate-500">/report</span> add to report</span>
          <span className="text-[10px] text-slate-700 font-mono"><span className="text-slate-500">/ask</span> query findings</span>
        </div>
      </form>
    </div>
  );
};

export default AIChatView;
