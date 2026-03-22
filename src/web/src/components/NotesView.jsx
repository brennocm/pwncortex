import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const NotesView = ({ projectId }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newNote, setNewNote] = useState({ title: "", body: "", status: "draft" });

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (query.trim()) params.set("q", query.trim());
      const qs = params.toString();
      const url = `${API_URL}/projects/${projectId}/notes${qs ? `?${qs}` : ""}`;
      const resp = await axios.get(url);
      setNotes(resp.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [projectId, filter, query]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingNote?.id) {
        await axios.patch(`${API_URL}/projects/${projectId}/notes/${editingNote.id}`, {
          title: editingNote.title,
          body: editingNote.body,
          status: editingNote.status,
        });
        setEditingNote(null);
      } else {
        await axios.post(`${API_URL}/projects/${projectId}/notes`, newNote);
        setNewNote({ title: "", body: "", status: "draft" });
        setShowForm(false);
      }
      fetchNotes();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await axios.delete(`${API_URL}/projects/${projectId}/notes/${id}`);
      fetchNotes();
    } catch {
      /* ignore */
    }
  };

  const cancelForm = () => {
    setEditingNote(null);
    setShowForm(false);
    setNewNote({ title: "", body: "", status: "draft" });
  };

  const isFormOpen = showForm || editingNote !== null;
  const formNote = editingNote || newNote;
  const setFormNote = editingNote ? setEditingNote : setNewNote;

  const statusConfig = {
    draft:    { pill: "bg-[#1a1a1a] text-slate-500 border-[#2a2a2a]",     dot: "bg-slate-600" },
    verified: { pill: "bg-teal-950 text-teal-400 border-teal-900/40",      dot: "bg-teal-400" },
    reported: { pill: "bg-blue-950 text-blue-400 border-blue-900/40",      dot: "bg-blue-400" },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1f1f1f] bg-[#0d0d0d] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Evidence Notes</h2>
            <p className="text-[10px] text-slate-600 font-mono mt-0.5">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingNote(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-black rounded hover:bg-primary/90 transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">add</span>
            New Note
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-700">search</span>
          <input
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded pl-8 pr-3 py-1.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-primary/40 placeholder-slate-700"
            placeholder="Search notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Status filters */}
        <div className="flex gap-1.5 flex-wrap">
          {["all", "draft", "verified", "reported"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
                filter === s
                  ? s === "verified" ? "bg-teal-950 text-teal-400 border-teal-900"
                  : s === "reported" ? "bg-blue-950 text-blue-400 border-blue-900"
                  : s === "draft"    ? "bg-[#1a1a1a] text-slate-400 border-slate-700"
                  :                    "bg-primary text-black border-primary"
                  : "bg-transparent text-slate-600 border-transparent hover:text-slate-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Inline form */}
      {isFormOpen && (
        <div className="px-5 py-4 border-b border-[#1f1f1f] bg-[#0d0d0d] shrink-0">
          <form onSubmit={handleSave} className="space-y-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">
              {editingNote?.id ? "Edit Note" : "New Note"}
            </p>
            <input
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[12px] font-mono text-slate-200 focus:outline-none focus:border-primary/40 placeholder-slate-700"
              placeholder="Title"
              value={formNote.title}
              onChange={(e) => setFormNote({ ...formNote, title: e.target.value })}
              required
            />
            <textarea
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[11px] font-mono text-slate-300 resize-none h-28 focus:outline-none focus:border-primary/40 placeholder-slate-700 leading-relaxed"
              placeholder="Body (Markdown supported)..."
              value={formNote.body}
              onChange={(e) => setFormNote({ ...formNote, body: e.target.value })}
              required
            />
            <div className="flex items-center justify-between">
              <select
                className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] font-mono text-slate-400 focus:outline-none focus:border-primary/40"
                value={formNote.status}
                onChange={(e) => setFormNote({ ...formNote, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="verified">Verified</option>
                <option value="reported">Reported</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-3 py-1.5 text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-black rounded hover:bg-primary/90 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-2.5">
        {loading && (
          <div className="text-center text-slate-700 py-12 text-xs font-mono">Loading...</div>
        )}
        {!loading && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3">
            <span className="material-symbols-outlined text-4xl">note_alt</span>
            <p className="text-xs font-mono">
              {query ? `No notes matching "${query}"` : "No notes yet. Create your first finding."}
            </p>
          </div>
        )}
        {notes.map((note) => {
          const cfg = statusConfig[note.status] || statusConfig.draft;
          return (
            <div key={note.id} className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg overflow-hidden hover:border-[#2a2a2a] transition-colors">
              {/* Card header */}
              <div className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-200 truncate">{note.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${cfg.pill}`}>
                      {note.status}
                    </span>
                    {note.linked_node_id && (
                      <span className="text-[8px] font-mono text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                        node #{note.linked_node_id}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-700 font-mono">
                      {new Date(note.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => { setEditingNote({ ...note }); setShowForm(false); }}
                    className="text-slate-600 hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
              {/* Body preview */}
              <div className="px-4 pb-3 text-[11px] text-slate-500 leading-relaxed border-t border-[#161616] pt-2 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{note.body.slice(0, 400) + (note.body.length > 400 ? "…" : "")}</ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotesView;
