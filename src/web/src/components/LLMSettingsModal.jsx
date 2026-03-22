import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function LLMSettingsModal({ onClose }) {
  const [provider, setProvider] = useState("ollama");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:3b");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [openRouterModel, setOpenRouterModel] = useState(
    "anthropic/claude-3.5-haiku",
  );
  const [isKeySet, setIsKeySet] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [llmModels, setLlmModels] = useState([]);
  const [status, setStatus] = useState(null); // 'saving', 'success', 'error'
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | {ok, msg}

  useEffect(() => {
    // Load current settings
    axios
      .get(`${API_URL}/settings/llm`)
      .then((resp) => {
        const d = resp.data;
        setProvider(d.provider || "ollama");
        setOllamaModel(d.ollama_model || "qwen2.5:3b");
        setOpenRouterModel(d.openrouter_model || "anthropic/claude-3.5-haiku");
        setIsKeySet(d.openrouter_api_key_set || false);
      })
      .catch((err) => console.error("Failed to load LLM settings", err));

    // Load available models
    axios
      .get(`${API_URL}/settings/llm/openrouter-models/`)
      .then((resp) => setLlmModels(resp.data))
      .catch((err) => console.error("Failed to load OpenRouter models", err));
  }, []);

  const handleTest = async () => {
    setTestStatus("testing");
    try {
      const payload = {
        provider,
        ollama_model: ollamaModel,
        openrouter_model: openRouterModel,
      };
      // Include key only if user typed a new one (don't send empty string — backend falls back to DB)
      if (openRouterKey.trim()) {
        payload.openrouter_api_key = openRouterKey.trim();
      }
      const resp = await axios.post(`${API_URL}/settings/llm/test`, payload);
      setTestStatus({ ok: resp.data.success, msg: resp.data.message });
    } catch (err) {
      setTestStatus({ ok: false, msg: err?.response?.data?.detail || "Request failed" });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus("saving");

    // validation for openrouter without key
    if (provider === "openrouter" && !isKeySet && !openRouterKey.trim()) {
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    try {
      const payload = {
        provider,
        ollama_model: ollamaModel,
        openrouter_model: openRouterModel,
      };
      if (openRouterKey.trim()) {
        payload.openrouter_api_key = openRouterKey.trim();
      }

      await axios.put(`${API_URL}/settings/llm`, payload);
      setStatus("success");
      if (openRouterKey.trim()) {
        setIsKeySet(true);
        setOpenRouterKey(""); // clear input after save
      }
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const isOllama = provider === "ollama";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-10 z-[100]">
      <div className="bg-surface-dark border border-border-dark p-6 rounded-lg shadow-2xl w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              psychology
            </span>
            LLM Settings
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Cards for Provider Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              onClick={() => setProvider("ollama")}
              className={`p-4 rounded-lg cursor-pointer border transition-all ${isOllama ? "border-primary bg-primary/5" : "border-border-dark opacity-50 hover:opacity-80"}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined">computer</span>
                <h4 className="font-bold text-slate-100">Local (Ollama)</h4>
              </div>
              <p className="text-xs text-slate-400">
                Run models entirely locally without an internet connection.
              </p>
            </div>

            <div
              onClick={() => setProvider("openrouter")}
              className={`p-4 rounded-lg cursor-pointer border transition-all ${!isOllama ? "border-primary bg-primary/5" : "border-border-dark opacity-50 hover:opacity-80"}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined">cloud</span>
                <h4 className="font-bold text-slate-100">API (OpenRouter)</h4>
              </div>
              <p className="text-xs text-slate-400">
                Access commercial models like GPT-4 or Claude via API.
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {isOllama ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Ollama Model
                </label>
                <input
                  type="text"
                  className="w-full bg-background-dark border border-border-dark rounded px-4 py-2 text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="e.g. qwen2.5:3b"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    OpenRouter API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      className="w-full bg-background-dark border border-border-dark rounded pl-4 pr-12 py-2 text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                      value={openRouterKey}
                      onChange={(e) => setOpenRouterKey(e.target.value)}
                      placeholder={
                        isKeySet
                          ? "•••••••••••••••• (Key is already set)"
                          : "sk-or-v1-..."
                      }
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-2 text-slate-400 hover:text-white"
                      onClick={() => setShowKey(!showKey)}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showKey ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                    OpenRouter Model
                  </label>
                  <select
                    className="w-full bg-background-dark border border-border-dark rounded px-4 py-2 text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono appearance-none h-11"
                    value={openRouterModel}
                    onChange={(e) => setOpenRouterModel(e.target.value)}
                  >
                    {llmModels.length > 0 ? (
                      Object.entries(
                        llmModels.reduce((acc, m) => {
                          const p = m.provider || "Other";
                          if (!acc[p]) acc[p] = [];
                          acc[p].push(m);
                          return acc;
                        }, {}),
                      ).map(([providerName, models]) => (
                        <optgroup
                          key={providerName}
                          label={
                            providerName.charAt(0).toUpperCase() +
                            providerName.slice(1)
                          }
                          className="bg-background-dark"
                        >
                          {models.map((m) => (
                            <option
                              key={m.id}
                              value={m.id}
                              className="bg-background-dark text-slate-200"
                            >
                              {m.name || m.id} — {m.id}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      <optgroup label="Popular Models" className="bg-background-dark">
                        <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku — anthropic/claude-3.5-haiku</option>
                        <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet — anthropic/claude-3-sonnet</option>
                        <option value="google/gemini-pro-1.5">Gemini Pro 1.5 — google/gemini-pro-1.5</option>
                        <option value="meta-llama/llama-3.1-405b">Llama 3.1 405B — meta-llama/llama-3.1-405b</option>
                      </optgroup>
                    )}
                  </select>
                  <div className="absolute right-4 top-[38px] pointer-events-none text-slate-500">
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Test Connection */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testStatus === "testing"}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-[#333] text-slate-400 rounded hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${testStatus === "testing" ? "animate-spin" : ""}`}>
                  {testStatus === "testing" ? "sync" : "cable"}
                </span>
                {testStatus === "testing" ? "Testing..." : "Test Connection"}
              </button>
              {testStatus && testStatus !== "testing" && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    testStatus.ok
                      ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}
                >
                  {testStatus.ok ? "✓ OK" : "✗ Failed"}
                </span>
              )}
            </div>
            {testStatus && testStatus !== "testing" && (
              <div
                className={`text-xs font-mono px-3 py-2 rounded border whitespace-pre-wrap break-all leading-relaxed ${
                  testStatus.ok
                    ? "bg-teal-500/5 text-teal-300 border-teal-500/20"
                    : "bg-red-500/5 text-red-300 border-red-500/20"
                }`}
              >
                {testStatus.msg}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            {/* Feedback Badge */}
            <div className="h-8 flex items-center">
              {status === "success" && (
                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-xs font-bold uppercase tracking-widest">
                  Saved!
                </span>
              )}
              {status === "error" && (
                <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-xs font-bold uppercase tracking-widest">
                  Error
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition-colors"
                disabled={status === "saving"}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "saving"}
                className="bg-primary hover:bg-primary/90 text-background-dark px-6 py-2.5 rounded font-bold transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
              >
                {status === "saving" ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
