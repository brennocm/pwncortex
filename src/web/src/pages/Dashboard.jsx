import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import LLMSettingsModal from "../components/LLMSettingsModal";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectToDelete, setProjectToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const resp = await axios.get(`${API_URL}/projects/`);
      setProjects(resp.data);
    } catch (error) {
      console.error("Error fetching projects", error);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const resp = await axios.post(`${API_URL}/projects/`, {
        name: newProjectName.trim(),
        description: "Pentest Engagement",
      });
      setProjects([...projects, resp.data]);
      setIsModalOpen(false);
      setNewProjectName("");
      navigate(`/workspace/${resp.data.id}`);
    } catch (error) {
      console.error("Error creating project", error);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await axios.delete(`${API_URL}/projects/${projectToDelete}`);
      setProjects(projects.filter((p) => p.id !== projectToDelete));
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project", error);
    }
  };

  const handleDeleteProject = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(id);
  };

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <header className="border-b border-border-dark bg-background-dark/95 backdrop-blur-md sticky top-0 z-50 mb-8 pb-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-primary">hub</span>
            <h1 className="text-xs font-bold tracking-widest uppercase text-primary">PwnCortex</h1>
          </div>
          <div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-400 hover:text-white transition-colors"
              title="LLM Settings"
            >
              <span className="material-symbols-outlined text-2xl">
                settings
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">
            Welcome back, Operator
          </h2>
          <p className="text-slate-200 mt-2">
            Manage your active offensive security engagements.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-background-dark px-6 h-11 rounded font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/10"
        >
          <span className="material-symbols-outlined font-bold">
            add_circle
          </span>
          Create New Project
        </button>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects.map((proj) => (
          <Link
            to={`/workspace/${proj.id}`}
            key={proj.id}
            className="bg-neutral-dark border border-border-dark p-4 rounded-lg hover:border-primary/60 transition-all group relative overflow-hidden block"
          >
            <div className="absolute top-0 right-0 p-3 flex flex-col gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handleDeleteProject(e, proj.id)}
                className="p-1.5 bg-background-dark/80 rounded hover:text-red-400 border border-border-dark flex items-center justify-center backdrop-blur-sm"
                title="Delete Project"
              >
                <span className="material-symbols-outlined text-sm">
                  delete
                </span>
              </button>
            </div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-col">
                <span
                  className="mono-text text-[10px] text-primary/60 uppercase"
                  title={proj.id}
                >
                  Project #{String(proj.id).substring(0, 8)}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  {proj.name}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-tighter">
                {proj.status}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Created:</span>
                <span className="text-slate-200">
                  {new Date(proj.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="w-full bg-background-dark h-1.5 rounded-full overflow-hidden mt-2 border border-border-dark">
                <div
                  className="bg-primary h-full"
                  style={{ width: "65%" }}
                ></div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-surface-dark border border-border-dark p-6 rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100">
                Create New Project
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-background-dark border border-border-dark rounded px-4 py-3 text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                  placeholder="Ex: Internal Network Pentest"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="bg-primary hover:bg-primary/90 text-background-dark px-6 py-2.5 rounded font-bold transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-surface-dark border border-border-dark p-6 rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100">
                Delete Project
              </h3>
              <button
                onClick={() => setProjectToDelete(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-slate-300 mb-6">
              Are you sure? This action cannot be undone and will delete all
              associated nodes and findings.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 px-6 py-2.5 rounded font-bold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <LLMSettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
