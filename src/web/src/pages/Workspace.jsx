import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import CytoscapeComponent from "react-cytoscapejs";
import SimpleMdeReact from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import html2pdf from "html2pdf.js";
import NotesView from "../components/NotesView";
import AIChatView from "../components/AIChatView";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// ── Style helpers ─────────────────────────────────────────────────────────────
const riskBg = (r) => {
  switch ((r || "").toLowerCase()) {
    case "critical": return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "high":     return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    case "medium":   return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    default:         return "bg-teal-500/20 text-teal-400 border border-teal-500/30";
  }
};
const sevBg = (s) => {
  switch ((s || "").toLowerCase()) {
    case "critical": return "bg-red-600 text-white";
    case "high":     return "bg-orange-500 text-white";
    case "medium":   return "bg-yellow-500 text-black";
    default:         return "bg-slate-600 text-slate-200";
  }
};

// ── Cytoscape stylesheet (outside component — no re-renders) ──────────────────
const cytoscapeStylesheet = [
  {
    selector: "node",
    style: {
      "background-color": "#121212",
      "border-width": 2,
      "border-color": "#c79800",
      label: (e) => {
        if (e.data("type") !== "host") return e.data("label");
        return e.data("label"); // IP only — details are in the Node panel
      },
      color: "#e2e8f0",
      "font-family": "JetBrains Mono, monospace",
      "font-size": "9px",
      "text-valign": "bottom",
      "text-margin-y": 7,
      "text-wrap": "wrap",
      "text-max-width": "120px",
      "text-background-color": "#0a0a0a",
      "text-background-opacity": 0.75,
      "text-background-padding": "2px",
      "text-background-shape": "roundrectangle",
      width: 34,
      height: 34,
      "min-zoomed-font-size": 0,
    },
  },
  {
    selector: 'node[type="project"]',
    style: {
      shape: "ellipse",
      "background-color": "#c79800",
      "border-width": 3,
      "border-color": "#fff8dc",
      width: 46,
      height: 46,
      color: "#fffbe6",
      "font-weight": "bold",
      "font-size": "10px",
      "text-valign": "bottom",
      "text-margin-y": 8,
      "text-background-opacity": 0,
    },
  },
  {
    selector: 'node[type="host"]',
    style: {
      shape: "ellipse",
      "background-color": (e) => {
        const r = e.data("risk_level");
        if (r === "critical") return "#7f1d1d";
        if (r === "high")     return "#7c2d12";
        if (r === "medium")   return "#1c3a2a";
        return "#0d2b2b";
      },
      "border-color": (e) => {
        const r = e.data("risk_level");
        if (r === "critical") return "#ef4444";
        if (r === "high")     return "#f97316";
        if (r === "medium")   return "#facc15";
        return "#00e6ac";
      },
      "border-width": 2,
      width: 34,
      height: 34,
    },
  },
  {
    selector: 'node[type="host"]:selected',
    style: { "border-width": 3, "border-color": "#c79800" },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#2d2d2d",
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#2d2d2d",
      "arrow-scale": 0.9,
      opacity: 0.7,
    },
  },
];

// ── StatRow ───────────────────────────────────────────────────────────────────
function StatRow({ icon, label, value, color = "text-slate-300" }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[#161616]">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[12px] text-slate-500">{icon}</span>
        <span className="text-[10px] text-slate-400">{label}</span>
      </div>
      <span className={`text-[11px] font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

// ── NodePanel ─────────────────────────────────────────────────────────────────
function NodePanel({ node, projectId }) {
  const [explanation, setExplanation]     = useState(null);   // { text, stale }
  const [explainLoading, setExplainLoading] = useState(false);
  const [linkedNotes, setLinkedNotes]     = useState([]);

  // Reset state when node changes
  useEffect(() => {
    setExplanation(null);
    setLinkedNotes([]);
    if (!node || node.type !== "host" || !node.db_id) return;
    // Fetch notes linked to this node
    axios
      .get(`${API_URL}/projects/${projectId}/notes?node_id=${node.db_id}`)
      .then((r) => setLinkedNotes(r.data))
      .catch(() => {});
  }, [node?.db_id, projectId]);

  const handleExplain = async () => {
    if (!node?.db_id) return;
    setExplainLoading(true);
    try {
      const r = await axios.post(`${API_URL}/projects/${projectId}/nodes/${node.db_id}/explain`);
      setExplanation({ text: r.data.explanation, stale: r.data.is_stale });
    } catch {
      setExplanation({ text: "Failed to generate explanation.", stale: true });
    } finally {
      setExplainLoading(false);
    }
  };

  if (!node || node.type !== "host") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 p-8">
        <span className="material-symbols-outlined text-4xl">account_tree</span>
        <p className="text-[11px] font-mono text-center leading-relaxed">
          Click a node on the graph<br />to inspect the target
        </p>
      </div>
    );
  }

  const openPorts = (node.ports || []).filter((p) => p.state === "open");
  const vulns = node.vulnerabilities || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1f1f] bg-[#0f0f0f] shrink-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-mono font-bold text-sm text-slate-100">{node.label}</span>
          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${riskBg(node.risk_level)}`}>
            {node.risk_level || "low"}
          </span>
        </div>
        {node.hostname && node.hostname !== node.label && (
          <p className="text-[11px] text-slate-500 font-mono mb-1">{node.hostname}</p>
        )}
        {node.os_info && (
          <p className="text-[10px] text-slate-500 truncate" title={node.os_info}>{node.os_info}</p>
        )}
        <div className="flex gap-2 mt-3">
          <div className="flex items-center gap-1.5 bg-[#1a1a1a] px-2 py-1 rounded text-[10px] font-mono">
            <span className="material-symbols-outlined text-[11px] text-teal-500">lan</span>
            <span className="text-slate-400">{openPorts.length}<span className="text-slate-500 ml-1">open</span></span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono ${vulns.length > 0 ? "bg-red-950/50" : "bg-[#1a1a1a]"}`}>
            <span className={`material-symbols-outlined text-[11px] ${vulns.length > 0 ? "text-red-400" : "text-slate-500"}`}>bug_report</span>
            <span className={vulns.length > 0 ? "text-red-300" : "text-slate-500"}>{vulns.length} vulns</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Services */}
        {openPorts.length > 0 && (
          <section>
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Open Services</h3>
            <div className="space-y-1.5">
              {openPorts.map((p, i) => {
                const portVulns = vulns.filter((v) => v.service_port === p.port_number);
                return (
                  <div key={i} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded px-3 py-2 hover:border-[#2d2d2d] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[11px] text-primary">{p.port_number}</span>
                        <span className="text-slate-500 text-[9px]">{p.protocol}</span>
                        <span className="text-slate-300 text-[11px]">{p.service || "unknown"}</span>
                        {portVulns.length > 0 && (
                          <span className="text-[8px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                            {portVulns.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {(p.product || p.version) && (
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
                        {[p.product, p.version].filter(Boolean).join(" ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Vulnerabilities */}
        {vulns.length > 0 && (
          <section>
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Vulnerabilities</h3>
            <div className="space-y-1.5">
              {vulns.map((v, i) => (
                <div
                  key={i}
                  className={`rounded px-3 py-2 border ${
                    v.severity?.toLowerCase() === "critical" ? "bg-red-950/30 border-red-900/50" :
                    v.severity?.toLowerCase() === "high"     ? "bg-orange-950/30 border-orange-900/50" :
                    "bg-[#0a0a0a] border-[#1f1f1f]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] text-slate-200 font-bold leading-tight">
                      {v.cve && <span className="text-primary mr-1">[{v.cve}]</span>}
                      {v.name}
                    </span>
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${sevBg(v.severity)}`}>
                      {v.severity}
                    </span>
                  </div>
                  {v.cvss_score && <p className="text-[9px] text-slate-600 font-mono">CVSS {v.cvss_score}</p>}
                  {v.description && (
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed line-clamp-3">{v.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Explain */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-600">AI Analysis</h3>
            <button
              onClick={handleExplain}
              disabled={explainLoading || !node.db_id}
              className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded border border-primary/30 text-primary/70 hover:text-primary hover:border-primary/60 disabled:opacity-30 transition-all"
            >
              <span className="material-symbols-outlined text-[11px]">{explainLoading ? "sync" : "auto_awesome"}</span>
              {explainLoading ? "Analyzing..." : "Explain"}
            </button>
          </div>
          {explanation && (
            <div className={`rounded px-3 py-2 text-[10px] leading-relaxed border ${explanation.stale ? "bg-yellow-950/20 border-yellow-900/30 text-yellow-300" : "bg-[#0a0a0a] border-[#1f1f1f] text-slate-300"}`}>
              {explanation.stale && (
                <span className="text-[8px] font-bold uppercase text-yellow-500 block mb-1">stale / error</span>
              )}
              {explanation.text}
            </div>
          )}
        </section>

        {/* Linked Notes */}
        {linkedNotes.length > 0 && (
          <section>
            <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Linked Notes</h3>
            <div className="space-y-1.5">
              {linkedNotes.map((n) => (
                <div key={n.id} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded px-3 py-2">
                  <p className="text-[10px] font-bold text-slate-300 mb-0.5 truncate">{n.title}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{n.body}</p>
                  <span className={`text-[8px] font-mono mt-1 inline-block px-1.5 py-0.5 rounded ${
                    n.status === "verified" ? "bg-teal-950 text-teal-400 border border-teal-900/40" :
                    n.status === "reported" ? "bg-blue-950 text-blue-400 border border-blue-900/40" :
                    "bg-[#1a1a1a] text-slate-600 border border-[#2a2a2a]"
                  }`}>{n.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────
function ChatPanel({ projectId, logs, setLogs, isLoading, setIsLoading }) {
  const [input, setInput] = useState("");
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");

    // /report command — append note to report, no LLM call
    if (trimmed.startsWith("/report ")) {
      const noteContent = trimmed.slice(8).trim();
      if (!noteContent) return;
      setLogs((prev) => [...prev, { id: Date.now(), role: "user", content: trimmed }]);
      setIsLoading(true);
      try {
        await axios.post(`${API_URL}/projects/${projectId}/notes`, { title: "Report Note", body: noteContent, status: "verified" });
        setLogs((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: "✓ Note appended to report.", is_system: true }]);
      } catch {
        setLogs((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: "Error appending note.", is_system: true }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // /ask prefix — strip it, treat as regular query
    const messageContent = trimmed.startsWith("/ask ") ? trimmed.slice(5).trim() : trimmed;
    setLogs((prev) => [...prev, { id: Date.now(), role: "user", content: trimmed }]);
    setIsLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/projects/${projectId}/chat/`, {
        content: messageContent,
      });
      setLogs((prev) => [...prev, resp.data]);
    } catch {
      setLogs((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: "Error communicating with AI. Check provider status." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = async () => {
    if (!window.confirm("Delete chat history?")) return;
    try { await axios.delete(`${API_URL}/projects/${projectId}/chat/`); setLogs([]); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-[#1f1f1f] flex justify-end items-center shrink-0">
        <button onClick={clearChat} className="text-slate-700 hover:text-red-400 transition-colors" title="Clear history">
          <span className="material-symbols-outlined text-sm">delete_sweep</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 font-mono text-[11px]">
        {logs.length === 0 && (
          <div className="text-center text-slate-500 py-10 space-y-2">
            <span className="material-symbols-outlined text-3xl block">psychology</span>
            <p className="text-[10px] leading-relaxed">Ask about findings or use:<br />
              <span className="text-slate-500">/report</span> to add notes to the report<br />
              <span className="text-slate-500">/ask</span> for explicit queries
            </p>
          </div>
        )}
        {(Array.isArray(logs) ? logs : []).map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[90%] px-3 py-2 rounded-lg break-words leading-relaxed ${
              msg.role === "user"
                ? "bg-[#1a1a1a] text-slate-200 border border-[#2d2d2d]"
                : msg.is_system
                ? "bg-teal-950/40 text-teal-400 border border-teal-900/40 text-[10px]"
                : "bg-primary/10 text-slate-300 border border-primary/20"
            }`}>
              {msg.content}
            </div>
            {msg.created_at && (
              <span className="text-[8px] text-slate-700 mt-0.5 px-1">
                {new Date(msg.created_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-primary/10 border border-primary/20 px-3 py-2 rounded-lg">
              <span className="text-primary text-[10px] animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#1f1f1f] shrink-0">
        <div className="relative">
          <textarea
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 pr-10 text-[11px] font-mono text-slate-200 resize-none h-16 leading-relaxed focus:border-primary/40 outline-none placeholder-slate-700"
            placeholder="Ask a question or use /report, /ask..."
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 1000))}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="absolute bottom-2 right-2 p-1.5 bg-primary text-black rounded-md hover:bg-primary/90 disabled:opacity-30 transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">send</span>
          </button>
        </div>
        <div className="flex gap-4 mt-1.5">
          <span className="text-[9px] text-slate-500 font-mono"><span className="text-slate-400">/report</span> add to report</span>
          <span className="text-[9px] text-slate-500 font-mono"><span className="text-slate-400">/ask</span> query findings</span>
        </div>
      </div>
    </div>
  );
}

// ── Checklist static metadata ─────────────────────────────────────────────────
const WSTG_CHAPTER = {
  INFO:  "01-Information_Gathering",
  CONF:  "02-Configuration_and_Deployment_Management_Testing",
  IDNT:  "03-Identity_Management_Testing",
  AUTHN: "04-Authentication_Testing",
  AUTHZ: "05-Authorization_Testing",
  SESS:  "06-Session_Management_Testing",
  INPV:  "07-Input_Validation_Testing",
  ERRH:  "08-Testing_for_Error_Handling",
  CRYP:  "09-Testing_for_Weak_Cryptography",
  BUSL:  "10-Business_Logic_Testing",
  CLNT:  "11-Client-Side_Testing",
  APIT:  "12-API_Testing",
};

const CHECKLIST_META = {
  // Information Gathering
  "WSTG-INFO-01": { objective: "Identify sensitive information exposed via search engines, dorking, and public sources (emails, credentials, API keys, internal paths).", tools: ["Google Dorks","Shodan","theHarvester","FOCA","Maltego","DnsDumpster"] },
  "WSTG-INFO-02": { objective: "Fingerprint the web server software, version, OS, and loaded modules through banners, headers, and error pages.", tools: ["Nmap","curl -I","Wappalyzer","whatweb","Nikto"] },
  "WSTG-INFO-03": { objective: "Analyse robots.txt, sitemap.xml, security.txt, and other metafiles for exposed paths and internal structure.", tools: ["curl","Burp Suite","ffuf","wget"] },
  "WSTG-INFO-04": { objective: "Enumerate all applications, virtual hosts, and services running on the web server (DNS brute force, port scan, vhost fuzzing).", tools: ["Nmap","gobuster","ffuf","amass","dnsx","subfinder"] },
  "WSTG-INFO-05": { objective: "Review HTML source, JavaScript files, and comments for sensitive data (keys, tokens, internal IPs, debug info).", tools: ["Burp Suite","DevTools","LinkFinder","SecretFinder","truffleHog"] },
  "WSTG-INFO-06": { objective: "Map all application entry points: forms, parameters, headers, cookies, API endpoints, file uploads.", tools: ["Burp Suite","OWASP ZAP","Postman","Arjun"] },
  "WSTG-INFO-07": { objective: "Map code execution paths, including authentication flows, business workflows, and conditional branches.", tools: ["Burp Suite","Manual review","Draw.io"] },
  "WSTG-INFO-08": { objective: "Identify the web framework (Django, Rails, Spring, etc.) and its version through fingerprinting techniques.", tools: ["Wappalyzer","whatweb","Burp Suite","BuiltWith"] },
  "WSTG-INFO-09": { objective: "Fingerprint the web application itself — version, known CVEs, default files, admin paths.", tools: ["Nikto","Nuclei","CMSmap","WPScan","Droopescan"] },
  "WSTG-INFO-10": { objective: "Map the full application architecture: load balancers, CDN, WAF, reverse proxies, microservices.", tools: ["Nmap","traceroute","Burp Suite","wafw00f","CDN Finder"] },
  // Configuration
  "WSTG-CONF-01": { objective: "Audit network infrastructure configuration: open ports, unnecessary services, insecure protocols (Telnet, FTP, SNMP v1/v2).", tools: ["Nmap","Nessus","Shodan","testssl.sh"] },
  "WSTG-CONF-02": { objective: "Review web server and platform configuration for defaults, debug modes, verbose errors, and unnecessary modules.", tools: ["Nikto","Lynis","Burp Suite","curl"] },
  "WSTG-CONF-03": { objective: "Test file extension handling — check for executable uploads, double extensions, bypass of extension filtering.", tools: ["Burp Suite","ffuf","curl","exiftool"] },
  "WSTG-CONF-04": { objective: "Search for backup files, temp files, old versions, and editor artifacts (.bak, .old, .swp, ~) exposing source or config.", tools: ["ffuf","gobuster","Burp Suite","dirsearch"] },
  "WSTG-CONF-05": { objective: "Enumerate and access admin interfaces (/admin, /manager, /console). Test for default credentials and unprotected access.", tools: ["ffuf","gobuster","Burp Intruder","Hydra"] },
  "WSTG-CONF-06": { objective: "Test all HTTP methods (PUT, DELETE, TRACE, CONNECT, OPTIONS). Identify dangerous methods enabled on the server.", tools: ["curl","Burp Suite","Nmap http-methods NSE"] },
  "WSTG-CONF-07": { objective: "Verify presence, correctness, and max-age of the Strict-Transport-Security (HSTS) header.", tools: ["curl -I","Burp Suite","SSL Labs","securityheaders.com"] },
  "WSTG-CONF-08": { objective: "Review crossdomain.xml and clientaccesspolicy.xml for overly permissive cross-domain policies.", tools: ["curl","Burp Suite","Manual review"] },
  "WSTG-CONF-09": { objective: "Check file and directory permissions on the server. Identify world-writable files, sensitive config file exposure.", tools: ["find","ls -la","Nmap","Nikto"] },
  "WSTG-CONF-10": { objective: "Identify DNS misconfigurations that allow subdomain takeover (dangling CNAMEs pointing to unclaimed cloud resources).", tools: ["subfinder","amass","nuclei","can-i-take-over-xyz"] },
  "WSTG-CONF-11": { objective: "Enumerate and test cloud storage (S3, GCS, Azure Blob) for public access, listing, and write permissions.", tools: ["aws cli","gsutil","s3scanner","GrayhatWarfare","BlobHunter"] },
  // Identity
  "WSTG-IDNT-01": { objective: "Review and validate role definitions — check for privilege creep, undefined roles, or roles with excessive permissions.", tools: ["Manual review","Burp Suite","Postman"] },
  "WSTG-IDNT-02": { objective: "Test the user registration process for weak validation, email enumeration, duplicate accounts, and self-registration abuse.", tools: ["Burp Suite","Manual testing","ffuf"] },
  "WSTG-IDNT-03": { objective: "Audit account provisioning and deprovisioning processes for orphaned accounts and excessive privilege assignment.", tools: ["Manual review","LDAP tools","AD queries"] },
  "WSTG-IDNT-04": { objective: "Test for account enumeration via login errors, registration, password reset, or timing differences.", tools: ["Burp Intruder","ffuf","timing attacks","Manual testing"] },
  "WSTG-IDNT-05": { objective: "Test for weak username policies that allow predictable, sequential, or system-default usernames.", tools: ["Manual review","Burp Suite","Custom wordlists"] },
  // Authentication
  "WSTG-AUTHN-01": { objective: "Verify that credentials are never transmitted over unencrypted channels (HTTP). Test for SSL stripping and mixed content.", tools: ["Burp Suite","Wireshark","sslstrip","testssl.sh"] },
  "WSTG-AUTHN-02": { objective: "Test all interfaces for default or vendor credentials (admin/admin, admin/password). Check vendor documentation.", tools: ["Hydra","Medusa","Default Credentials DB","Burp Intruder"] },
  "WSTG-AUTHN-03": { objective: "Evaluate account lockout thresholds, lockout duration, and whether lockout applies to all authentication channels.", tools: ["Burp Intruder","Manual testing","Custom scripts"] },
  "WSTG-AUTHN-04": { objective: "Attempt to bypass authentication via direct URL access, forced browsing, parameter tampering, and logic flaws.", tools: ["Burp Suite","OWASP ZAP","Manual testing"] },
  "WSTG-AUTHN-05": { objective: "Analyse 'Remember Me' / persistent login tokens for predictability, insecure storage, and lack of expiry.", tools: ["Burp Suite","DevTools","Manual analysis"] },
  "WSTG-AUTHN-06": { objective: "Verify that browsers do not cache pages containing sensitive information after logout.", tools: ["Burp Suite","curl","Browser DevTools","Manual testing"] },
  "WSTG-AUTHN-07": { objective: "Evaluate password complexity requirements, history enforcement, and whether weak passwords are accepted.", tools: ["Manual testing","Burp Suite","Custom password lists"] },
  "WSTG-AUTHN-08": { objective: "Assess security questions for predictability, public availability of answers, and brute-force susceptibility.", tools: ["Manual testing","OSINT","Burp Intruder"] },
  "WSTG-AUTHN-09": { objective: "Test the password reset flow for token predictability, lack of expiry, user enumeration, and replay attacks.", tools: ["Burp Suite","Manual testing","jwt-tool"] },
  "WSTG-AUTHN-10": { objective: "Identify weaker authentication mechanisms in alternative channels (mobile app, API, legacy endpoints).", tools: ["Burp Suite","Mobile proxy","Manual testing"] },
  // Authorization
  "WSTG-AUTHZ-01": { objective: "Test for path traversal and local/remote file inclusion vulnerabilities (../../../etc/passwd, LFI/RFI).", tools: ["Burp Suite","dotdotpwn","ffuf","Manual testing"] },
  "WSTG-AUTHZ-02": { objective: "Attempt to access restricted functionality by modifying roles, parameters, or session tokens.", tools: ["Burp Suite","AuthMatrix","Manual testing"] },
  "WSTG-AUTHZ-03": { objective: "Test vertical and horizontal privilege escalation — can a low-privileged user perform admin actions?", tools: ["Burp Suite","Manual testing","AuthMatrix"] },
  "WSTG-AUTHZ-04": { objective: "Test for Insecure Direct Object References — access other users' data by manipulating IDs in requests.", tools: ["Burp Intruder","Manual testing","Postman","ffuf"] },
  // Session
  "WSTG-SESS-01": { objective: "Analyse session token entropy, predictability, encoding, and lifecycle (creation, expiry, invalidation).", tools: ["Burp Sequencer","Burp Suite","Manual analysis","OWASP ZAP"] },
  "WSTG-SESS-02": { objective: "Verify cookie attributes: Secure, HttpOnly, SameSite, Path, Domain, and expiry settings.", tools: ["Burp Suite","DevTools","curl","Manual testing"] },
  "WSTG-SESS-03": { objective: "Test whether the application issues a new session token post-authentication (session fixation prevention).", tools: ["Burp Suite","Manual testing","OWASP ZAP"] },
  "WSTG-SESS-04": { objective: "Check for session tokens exposed in URLs, referrer headers, browser history, and server logs.", tools: ["Burp Suite","Manual testing","grep in access logs"] },
  "WSTG-SESS-05": { objective: "Test for CSRF vulnerabilities on state-changing operations. Verify anti-CSRF token presence and validation.", tools: ["Burp Suite","OWASP CSRFTester","Manual testing"] },
  "WSTG-SESS-06": { objective: "Verify that logout fully invalidates the server-side session and clears all session cookies.", tools: ["Burp Suite","Manual testing","curl"] },
  "WSTG-SESS-07": { objective: "Test session timeout — verify that idle sessions expire and cannot be reused after timeout.", tools: ["Burp Suite","Manual testing","Browser automation"] },
  "WSTG-SESS-08": { objective: "Test for session variable overloading/puzzling — multiple features sharing session variables causing confusion.", tools: ["Burp Suite","Manual analysis","Source code review"] },
  "WSTG-SESS-09": { objective: "Test for session hijacking vulnerabilities: token theft via XSS, network sniffing, fixation.", tools: ["Burp Suite","Wireshark","BeEF","Manual testing"] },
  // Input Validation
  "WSTG-INPV-01": { objective: "Test all input vectors for Reflected XSS — data reflected in response without proper encoding.", tools: ["Burp Suite","OWASP ZAP","XSStrike","dalfox"] },
  "WSTG-INPV-02": { objective: "Test for Stored XSS where malicious payload is persisted and later rendered to other users.", tools: ["Burp Suite","XSStrike","dalfox","Manual testing"] },
  "WSTG-INPV-03": { objective: "Test HTTP verb tampering — bypass access controls by using unexpected HTTP methods (HEAD, PATCH, etc.).", tools: ["Burp Suite","curl","Manual testing"] },
  "WSTG-INPV-04": { objective: "Test HTTP Parameter Pollution — inject duplicate parameters to override or bypass logic.", tools: ["Burp Suite","Arjun","Manual testing"] },
  "WSTG-INPV-05": { objective: "Test all input fields and parameters for SQL Injection (error-based, blind, time-based, out-of-band).", tools: ["sqlmap","Burp Suite","Manual payloads","Ghauri"] },
  "WSTG-INPV-06": { objective: "Test LDAP query inputs for injection that could bypass authentication or extract directory data.", tools: ["Burp Suite","Manual payloads","LDAP injection wordlists"] },
  "WSTG-INPV-07": { objective: "Test XML inputs for injection: XXE (External Entity), XPath injection, and XML bomb (DoS).", tools: ["Burp Suite","XXEInjector","Manual payloads"] },
  "WSTG-INPV-08": { objective: "Test for Server-Side Include (SSI) injection via user-controlled input rendered in server-parsed pages.", tools: ["Burp Suite","Manual payloads","Nikto"] },
  "WSTG-INPV-09": { objective: "Test XPath query inputs for injection that may bypass auth or extract XML data.", tools: ["Burp Suite","Manual payloads"] },
  "WSTG-INPV-10": { objective: "Test email/IMAP/SMTP inputs for header injection and CRLF injection enabling relaying or spoofing.", tools: ["Burp Suite","Manual payloads","smtp-user-enum"] },
  "WSTG-INPV-11": { objective: "Test for code injection — attacker-controlled data evaluated as code (eval, exec, include).", tools: ["Burp Suite","Manual payloads","Commix"] },
  "WSTG-INPV-12": { objective: "Test for OS command injection in parameters passed to shell functions.", tools: ["Burp Suite","Commix","Manual payloads (;id, &&whoami)"] },
  "WSTG-INPV-13": { objective: "Test for format string vulnerabilities where user input is passed as format specifier (%x, %s, %n).", tools: ["Burp Suite","Manual payloads","Fuzzing"] },
  "WSTG-INPV-14": { objective: "Test for incubated/stored vulnerabilities that are only triggered under specific future conditions.", tools: ["Burp Suite","Manual analysis","Time-delayed payloads"] },
  "WSTG-INPV-15": { objective: "Test for HTTP Request Smuggling and Response Splitting via crafted Content-Length / Transfer-Encoding headers.", tools: ["Burp Suite HTTP Smuggler","smuggler.py","Manual testing"] },
  "WSTG-INPV-16": { objective: "Inspect incoming HTTP requests for unexpected headers, methods, or data that could indicate ongoing attacks.", tools: ["Burp Suite","Server logs","Wireshark"] },
  "WSTG-INPV-17": { objective: "Test Host header injection for cache poisoning, password reset poisoning, and SSRF via host header.", tools: ["Burp Suite","Manual testing"] },
  "WSTG-INPV-18": { objective: "Test for Server-Side Template Injection (SSTI) in template engines (Jinja2, Twig, FreeMarker, Pebble).", tools: ["Burp Suite","tplmap","Manual payloads ({{7*7}})"] },
  "WSTG-INPV-19": { objective: "Test for SSRF — force the server to make requests to internal/external resources via user-controlled URLs.", tools: ["Burp Collaborator","ssrfmap","Interactsh","Manual testing"] },
  // Error Handling
  "WSTG-ERRH-01": { objective: "Trigger errors to verify they don't leak stack traces, DB queries, file paths, or internal IPs.", tools: ["Burp Suite","Manual testing","ffuf"] },
  "WSTG-ERRH-02": { objective: "Confirm stack traces and debug information are suppressed in production responses.", tools: ["Burp Suite","Manual testing","Nikto"] },
  // Cryptography
  "WSTG-CRYP-01": { objective: "Evaluate TLS configuration: protocol versions, cipher suites, certificate validity, and key exchange.", tools: ["testssl.sh","SSL Labs","Nmap ssl-enum-ciphers","tlsx"] },
  "WSTG-CRYP-02": { objective: "Test for padding oracle vulnerabilities in CBC-mode encryption (POODLE, BEAST, custom implementations).", tools: ["padbuster","Burp Suite","PadBuster"] },
  "WSTG-CRYP-03": { objective: "Verify all sensitive data (credentials, PII, tokens) is transmitted exclusively over encrypted channels.", tools: ["Wireshark","Burp Suite","Manual testing"] },
  "WSTG-CRYP-04": { objective: "Audit encryption algorithms in use — flag MD5, SHA-1, DES, RC4, and other deprecated algorithms.", tools: ["testssl.sh","Source code review","Burp Suite","Manual analysis"] },
  // Business Logic
  "WSTG-BUSL-01": { objective: "Test that the application enforces data validation rules at the business level (not just format validation).", tools: ["Burp Suite","Manual testing","Postman"] },
  "WSTG-BUSL-02": { objective: "Attempt to forge requests that simulate legitimate business actions (e.g., price manipulation, step skipping).", tools: ["Burp Suite","Manual testing","Postman"] },
  "WSTG-BUSL-03": { objective: "Test whether integrity checks prevent tampering with data in transit (checksums, HMACs, digital signatures).", tools: ["Burp Suite","Manual testing"] },
  "WSTG-BUSL-04": { objective: "Test for race conditions and time-of-check/time-of-use (TOCTOU) vulnerabilities in business processes.", tools: ["Burp Suite Turbo Intruder","Race condition scripts","ffuf"] },
  "WSTG-BUSL-05": { objective: "Test whether limits (transaction limits, coupon use, vote counts) can be circumvented or bypassed.", tools: ["Burp Suite","Manual testing","Race conditions"] },
  "WSTG-BUSL-06": { objective: "Attempt to skip, repeat, or reorder workflow steps (checkout bypass, payment skip, multi-step form abuse).", tools: ["Burp Suite","Manual testing","Postman"] },
  "WSTG-BUSL-07": { objective: "Test defences against application misuse, scraping, automation, and abuse of legitimate features.", tools: ["Burp Suite","Manual testing","Custom scripts"] },
  "WSTG-BUSL-08": { objective: "Upload unexpected file types to test for MIME type bypass, extension bypass, and content type confusion.", tools: ["Burp Suite","Manual testing","Custom scripts"] },
  "WSTG-BUSL-09": { objective: "Upload files containing malicious payloads (webshells, EICAR, XML bombs) to test server-side execution.", tools: ["Burp Suite","Weevely","Manual testing","EICAR"] },
  // Client-Side
  "WSTG-CLNT-01": { objective: "Test for DOM-based XSS where user input flows into dangerous sink functions (eval, innerHTML, document.write).", tools: ["DOM Invader (Burp)","Manual JS review","DalFox","XSStrike"] },
  "WSTG-CLNT-02": { objective: "Test for unsafe JavaScript execution via eval, Function(), and dynamic script loading with user input.", tools: ["Burp Suite","Manual JS review","DevTools"] },
  "WSTG-CLNT-03": { objective: "Test for HTML injection in client-rendered content that could lead to phishing or data theft.", tools: ["Burp Suite","Manual testing"] },
  "WSTG-CLNT-04": { objective: "Test for open redirect vulnerabilities via URL parameters, affecting phishing and OAuth flows.", tools: ["Burp Suite","Manual testing","OpenRedireX"] },
  "WSTG-CLNT-05": { objective: "Test for CSS injection — attacker-controlled CSS that exfiltrates data or alters page appearance.", tools: ["Burp Suite","Manual payloads"] },
  "WSTG-CLNT-06": { objective: "Test for client-side resource manipulation (JS, CSS, images loaded from attacker-controlled sources).", tools: ["Burp Suite","DevTools","Manual testing"] },
  "WSTG-CLNT-07": { objective: "Review CORS configuration for overly permissive origins (*, null), credential inclusion, and method exposure.", tools: ["Burp Suite","corsy","Manual testing","curl"] },
  "WSTG-CLNT-08": { objective: "Test Flash/SWF files (legacy) for cross-domain policy issues and parameter injection.", tools: ["Decompilers","Manual analysis"] },
  "WSTG-CLNT-09": { objective: "Test for Clickjacking — can the application be framed by a malicious page to trick user clicks?", tools: ["Burp Suite","Manual iframe test","ClickjackPoc"] },
  "WSTG-CLNT-10": { objective: "Test WebSocket connections for injection, authentication bypass, and lack of origin validation.", tools: ["Burp Suite","wscat","Manual testing"] },
  "WSTG-CLNT-11": { objective: "Test postMessage implementations for missing origin checks and untrusted data deserialization.", tools: ["Burp Suite","Manual JS review","DevTools"] },
  "WSTG-CLNT-12": { objective: "Audit browser storage (localStorage, sessionStorage, IndexedDB, cookies) for sensitive data in cleartext.", tools: ["DevTools","Manual inspection","Burp Suite"] },
  "WSTG-CLNT-13": { objective: "Test for Cross-Site Script Inclusion — sensitive JSON/JSONP responses accessible from attacker-controlled pages.", tools: ["Burp Suite","Manual testing"] },
  "WSTG-APIT-01": { objective: "Test GraphQL for introspection exposure, query batching abuse, deeply nested queries (DoS), and injection flaws.", tools: ["InQL (Burp)","Altair","GraphQL Voyager","clairvoyance"] },
  // Network
  "NET-SCAN-01": { objective: "Perform a full TCP port scan to identify all open services on the target.", tools: ["Nmap","masscan","rustscan"] },
  "NET-SCAN-02": { objective: "Perform a UDP port scan to identify DNS, SNMP, TFTP, and other UDP services.", tools: ["Nmap -sU","udp-proto-scanner"] },
  "NET-ENUM-01": { objective: "Enumerate service banners and versions to identify exact software and known CVEs.", tools: ["Nmap -sV","curl","netcat","Metasploit"] },
  "NET-ENUM-02": { objective: "Fingerprint the operating system using TTL analysis, TCP/IP stack behaviour, and banner information.", tools: ["Nmap -O","p0f","Metasploit"] },
  "NET-VULN-01": { objective: "Run automated vulnerability scanning against all discovered services to identify known weaknesses.", tools: ["Nmap NSE","Nessus","OpenVAS","Nuclei"] },
  "NET-VULN-02": { objective: "Attempt exploitation of known CVEs identified in enumeration against unpatched services.", tools: ["Metasploit","Exploit-DB","searchsploit","Manual PoC"] },
  "NET-CRED-01": { objective: "Test network services (SSH, FTP, Telnet, RDP, SNMP) for default or weak credentials.", tools: ["Hydra","Medusa","Metasploit","CrackMapExec"] },
  "NET-SNIFF-01": { objective: "Perform passive/active traffic sniffing and ARP poisoning to capture cleartext credentials and sessions.", tools: ["Wireshark","tcpdump","ettercap","Bettercap"] },
  "NET-FW-01":   { objective: "Analyse firewall rules and ACLs for overly permissive rules, bidirectional gaps, and bypass techniques.", tools: ["Nmap","hping3","Firewall rule review","Manual analysis"] },
  // Active Directory
  "AD-ENUM-01": { objective: "Enumerate users, groups, OUs, and policies via LDAP queries (anonymous or authenticated).", tools: ["ldapsearch","BloodHound","ldapdomaindump","enum4linux-ng"] },
  "AD-ENUM-02": { objective: "Enumerate SMB shares for sensitive files, misconfigurations, and anonymous access.", tools: ["smbclient","CrackMapExec","enum4linux-ng","smbmap"] },
  "AD-ENUM-03": { objective: "Enumerate DNS records and SPNs to map services and Kerberoastable accounts.", tools: ["dig","BloodHound","Impacket GetUserSPNs","dnsenum"] },
  "AD-KERB-01": { objective: "Request service tickets for accounts with SPNs and attempt offline password cracking (Kerberoasting).", tools: ["Impacket GetUserSPNs","Rubeus","hashcat","john"] },
  "AD-KERB-02": { objective: "Request AS-REP for accounts without pre-auth enabled and crack offline (AS-REP Roasting).", tools: ["Impacket GetNPUsers","Rubeus","hashcat","john"] },
  "AD-CRED-01": { objective: "Spray a single password against many accounts to avoid lockout while gaining initial access.", tools: ["CrackMapExec","Kerbrute","Spray","Manual"] },
  "AD-CRED-02": { objective: "Use captured NTLM hash to authenticate without cracking (Pass-the-Hash).", tools: ["Impacket","CrackMapExec","Mimikatz","Evil-WinRM"] },
  "AD-CRED-03": { objective: "Use stolen Kerberos tickets to authenticate as another user (Pass-the-Ticket).", tools: ["Rubeus","Mimikatz","Impacket"] },
  "AD-PRIV-01": { objective: "Identify misconfigured ACLs (GenericAll, WriteDACL, ForceChangePassword) using BloodHound attack paths.", tools: ["BloodHound","SharpHound","PowerView","ADACLScanner"] },
  "AD-PRIV-02": { objective: "Exploit unconstrained or constrained Kerberos delegation to impersonate privileged users.", tools: ["Rubeus","Impacket","BloodHound","PowerView"] },
  "AD-PRIV-03": { objective: "Replicate AD credentials using DCSync to extract NTLM hashes for all accounts including krbtgt.", tools: ["Impacket secretsdump","Mimikatz","CrackMapExec"] },
  "AD-PRIV-04": { objective: "Forge Kerberos Golden (krbtgt) or Silver (service account) tickets for persistent privileged access.", tools: ["Mimikatz","Impacket ticketer","Rubeus"] },
  // Infrastructure
  "INF-CREDS-01": { objective: "Test all infrastructure services for vendor-default or weak credentials.", tools: ["Hydra","Metasploit","CrackMapExec","Shodan","Default creds DB"] },
  "INF-PATCH-01": { objective: "Identify unpatched software, EOL systems, and missing security updates across infrastructure.", tools: ["Nessus","OpenVAS","Qualys","Nuclei"] },
  "INF-CONFIG-01": { objective: "Identify misconfigured services: FTP anonymous login, NFS world-export, SNMP community strings.", tools: ["Nmap NSE","Nessus","Manual testing","Metasploit"] },
  "INF-CONFIG-02": { objective: "Identify exposed management interfaces (SSH, RDP, Telnet, WinRM, IPMI) accessible from untrusted networks.", tools: ["Nmap","Shodan","Censys","Masscan"] },
  "INF-CLOUD-01": { objective: "Identify cloud misconfigurations: open S3 buckets, overpermissive IAM, public snapshots, metadata SSRF.", tools: ["ScoutSuite","Prowler","Pacu","cloudsploit","aws cli"] },
  "INF-CLOUD-02": { objective: "Test container and Kubernetes misconfigurations: exposed API server, privileged pods, host path mounts.", tools: ["kube-bench","trivy","kubectl","kubeaudit","Peirates"] },
  "INF-LOG-01":   { objective: "Verify that security-relevant events are logged, alerts are configured, and logs are tamper-resistant.", tools: ["Manual review","SIEM queries","Log analysis","auditd"] },
};

const STATUS_CYCLE = ["pending", "in_progress", "done", "n/a"];

function wstgRef(wstgId) {
  const parts = wstgId.split("-");
  if (parts.length < 3 || parts[0] !== "WSTG") return null;
  const chapter = WSTG_CHAPTER[parts[1]];
  if (!chapter) return null;
  return `https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/${chapter}`;
}

// ── ChecklistCard ─────────────────────────────────────────────────────────────
function ChecklistCard({ item, onUpdate }) {
  const [notes, setNotes] = useState(item.notes || "");
  const [expanded, setExpanded] = useState(false);

  const meta = CHECKLIST_META[item.wstg_id];
  const refUrl = wstgRef(item.wstg_id);

  const cycleStatus = (e) => {
    e.stopPropagation();
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];
    onUpdate(item.id, next, notes);
  };

  const statusConfig = {
    done:        { bar: "bg-teal-500",   ring: "border-teal-900/60",  bg: "bg-teal-950/10",    pill: "bg-teal-950 text-teal-400 border-teal-900", dot: "bg-teal-400",   icon: "check_circle", label: "Done"        },
    in_progress: { bar: "bg-yellow-500", ring: "border-yellow-900/60",bg: "bg-yellow-950/10",  pill: "bg-yellow-950 text-yellow-400 border-yellow-900", dot: "bg-yellow-400 animate-pulse", icon: "pending", label: "In Progress" },
    pending:     { bar: "bg-slate-700",  ring: "border-[#1f1f1f]",    bg: "bg-[#0d0d0d]",      pill: "bg-[#141414] text-slate-600 border-[#2a2a2a]", dot: "bg-slate-700",  icon: "radio_button_unchecked", label: "Pending" },
    "n/a":       { bar: "bg-slate-800",  ring: "border-[#1a1a1a]",    bg: "bg-[#0a0a0a]",      pill: "bg-[#111] text-slate-700 border-[#222]",      dot: "bg-slate-800",  icon: "block", label: "N/A" },
  };
  const cfg = statusConfig[item.status] || statusConfig.pending;

  return (
    <div className={`flex rounded-lg overflow-hidden border transition-all ${cfg.ring} ${cfg.bg}`}>
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${cfg.bar}`} />

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-primary shrink-0">{item.wstg_id}</span>
              <span className="text-[9px] uppercase tracking-wider text-slate-600 bg-[#111] px-1.5 py-0.5 rounded shrink-0">{item.category}</span>
              {item.notes && (
                <span className="text-[9px] text-slate-500 shrink-0" title="Has notes">✎</span>
              )}
            </div>
            <p className={`text-xs leading-snug ${item.status === "done" ? "line-through text-slate-600" : "text-slate-200"}`}>
              {item.title}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Clickable status pill */}
            <button
              onClick={cycleStatus}
              title="Click to advance status"
              className={`flex items-center gap-1.5 text-[9px] font-bold uppercase border rounded-full px-2 py-0.5 transition-all hover:brightness-125 ${cfg.pill}`}
            >
              <span className={`size-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </button>
            <span className={`material-symbols-outlined text-[15px] text-slate-700 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              expand_more
            </span>
          </div>
        </div>

        {/* Expanded panel */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-[#1a1a1a] space-y-3">
            {/* Objective */}
            {meta?.objective && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Objective</p>
                <p className="text-xs text-slate-400 leading-relaxed">{meta.objective}</p>
              </div>
            )}

            {/* Tools */}
            {meta?.tools?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Common Tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.tools.map((t) => (
                    <span key={t} className="text-[10px] font-mono bg-[#111] border border-[#222] text-slate-400 px-2 py-0.5 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Notes / Evidence</p>
              <textarea
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded px-2.5 py-2 text-xs font-mono text-slate-300 resize-none h-20 outline-none focus:border-primary/30 placeholder-slate-700 leading-relaxed"
                placeholder="PoC, evidence, findings, tool output..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => onUpdate(item.id, item.status, notes)}
              />
            </div>

            {/* Footer: status selector + OWASP link */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-1">
                {STATUS_CYCLE.map((s) => (
                  <button
                    key={s}
                    onClick={() => onUpdate(item.id, s, notes)}
                    className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                      item.status === s
                        ? statusConfig[s].pill
                        : "border-[#1f1f1f] text-slate-700 hover:text-slate-400 hover:border-[#333]"
                    }`}
                  >
                    {s === "in_progress" ? "in progress" : s === "n/a" ? "n/a" : s}
                  </button>
                ))}
              </div>
              {refUrl && (
                <a
                  href={refUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] text-primary/70 hover:text-primary font-mono transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                  OWASP WSTG
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ChecklistView ─────────────────────────────────────────────────────────────
function ChecklistView({ projectId, items, setItems, onEvidenceUpdate }) {
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");

  const categories = ["All", ...Array.from(new Set(items.map((i) => i.category)))];

  const countByStatus = (s) => items.filter((i) => i.status === s).length;
  const statusFilters = [
    { id: "all",         label: "All",         count: items.length },
    { id: "pending",     label: "Pending",     count: countByStatus("pending") },
    { id: "in_progress", label: "In Progress", count: countByStatus("in_progress") },
    { id: "done",        label: "Done",        count: countByStatus("done") },
    { id: "n/a",         label: "N/A",         count: countByStatus("n/a") },
  ];

  const filtered = items.filter(
    (i) =>
      (catFilter === "All" || i.category === catFilter) &&
      (statusFilter === "all" || i.status === statusFilter),
  );

  const updateItem = async (itemId, status, notes) => {
    try {
      await axios.put(`${API_URL}/projects/${projectId}/checklist/${itemId}/`, { status, notes });
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status, notes } : i)));
      if (notes && notes.trim()) onEvidenceUpdate?.();
    } catch { /* ignore */ }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset all checklist items to pending?")) return;
    await axios.post(`${API_URL}/projects/${projectId}/checklist/reset/`);
    const resp = await axios.get(`${API_URL}/projects/${projectId}/checklist/`);
    setItems(resp.data);
  };

  const done = countByStatus("done");
  const inProgress = countByStatus("in_progress");
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const pctColor = pct >= 70 ? "bg-teal-500" : pct >= 30 ? "bg-yellow-500" : "bg-slate-600";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1f1f1f] bg-[#0a0a0a] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Pentest Checklist</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {done}/{items.length} complete · {inProgress} in progress · {pct}%
            </p>
          </div>
          <button onClick={resetAll} className="text-[10px] text-slate-700 hover:text-red-400 font-mono transition-colors">
            Reset
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mb-4">
          <div className={`h-1.5 rounded-full transition-all duration-700 ${pctColor}`} style={{ width: `${pct}%` }} />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {categories.map((cat) => {
            const count = cat === "All" ? items.length : items.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
                  catFilter === cat
                    ? "bg-primary text-black"
                    : "bg-[#1a1a1a] text-slate-600 hover:text-slate-300 hover:bg-[#222]"
                }`}
              >
                {cat}
                <span className={`text-[8px] ${catFilter === cat ? "text-black/60" : "text-slate-700"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Status pills with counts */}
        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all flex items-center gap-1 ${
                statusFilter === id
                  ? id === "done"        ? "text-teal-400 border-teal-900 bg-teal-950/40"
                  : id === "in_progress" ? "text-yellow-400 border-yellow-900 bg-yellow-950/40"
                  : id === "pending"     ? "text-slate-400 border-slate-800 bg-slate-900/40"
                  :                        "text-slate-400 border-slate-800 bg-slate-900/40"
                  : "text-slate-700 border-transparent hover:text-slate-500"
              }`}
            >
              {label}
              <span className="text-[8px] opacity-60">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-1.5">
        {filtered.map((item) => (
          <ChecklistCard key={item.id} item={item} onUpdate={updateItem} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-500 py-12 text-xs font-mono">No items match current filters</div>
        )}
      </div>
    </div>
  );
}

// ── Main Workspace ────────────────────────────────────────────────────────────
export default function Workspace() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // null | uploading | success | error
  const [activeView, setActiveView] = useState("graph"); // graph | report | checklist
  const [rightPanel, setRightPanel] = useState("chat"); // chat | node
  const [reportMarkdown, setReportMarkdown] = useState("");
  const [reportSyncedAt, setReportSyncedAt] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [chatLogs, setChatLogs] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const cyRef = useRef(null);
  const fileInputRef = useRef(null);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      // Allow the CSS transition to complete before telling cytoscape to resize
      setTimeout(() => {
        cyRef.current?.resize();
        cyRef.current?.fit();
      }, 250);
      return next;
    });
  };

  // Memoize SimpleMDE options — prevents remount (and preview reset) on every re-render
  const simpleMdeOptions = useMemo(() => ({
    spellChecker: false,
    status: false,
    minHeight: "calc(100vh - 100px)",
  }), []);

  // Track node count separately so layout only re-runs when topology changes, not on data updates
  const nodeCount = useMemo(
    () => elements.filter((e) => e.data && e.data.type === "host").length,
    [elements],
  );

  useEffect(() => {
    fetchProject();
    fetchGraph();
    fetchChatHistory();
    fetchChecklist();
    const interval = setInterval(fetchGraph, 5000);
    return () => clearInterval(interval);
  }, [id]);

  // Auto-switch right panel when a node is selected
  useEffect(() => {
    if (selectedNode) setRightPanel("node");
  }, [selectedNode]);

  const fetchProject   = async () => { try { const r = await axios.get(`${API_URL}/projects/${id}`);             setProject(r.data);       } catch { /* ignore */ } };
  const fetchGraph     = async () => { try { const r = await axios.get(`${API_URL}/projects/${id}/graph`);        setElements(r.data.elements); } catch { /* ignore */ } };
  const fetchChatHistory = async () => { try { const r = await axios.get(`${API_URL}/projects/${id}/chat/`);    setChatLogs(r.data);       } catch { /* ignore */ } };
  const fetchChecklist = async () => { try { const r = await axios.get(`${API_URL}/projects/${id}/checklist/`);  setChecklistItems(r.data); } catch { /* ignore */ } };

  const fetchReport = async () => {
    try {
      const draftRes = await axios.get(`${API_URL}/projects/${id}/report/draft`);
      if (draftRes.data.draft) {
        setReportMarkdown(draftRes.data.draft);
        setReportSyncedAt(draftRes.data.last_synced_at || null);
        return;
      }
      const r = await axios.get(`${API_URL}/projects/${id}/report`);
      setReportMarkdown(r.data.markdown);
      setReportSyncedAt(null);
    } catch { /* ignore */ }
  };

  const syncReport = async () => {
    setIsSyncing(true);
    try {
      await axios.post(`${API_URL}/projects/${id}/report/sync`);
      setTimeout(fetchReport, 1500); // give background task time to run
    } catch { /* ignore */ } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus("uploading");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const resp = await axios.post(`${API_URL}/projects/${id}/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus("success");
      setTimeout(() => { fetchGraph(); setUploadStatus(null); }, 2000);
    } catch {
      setUploadStatus("error");
      setTimeout(() => setUploadStatus(null), 3000);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportPdf = () => {
    const el = document.createElement("div");
    const preview = document.querySelector(".editor-preview");
    el.innerHTML = preview ? preview.innerHTML : `<pre>${reportMarkdown}</pre>`;
    html2pdf().from(el).save(`PwnCortex_${project?.name || "Report"}.pdf`);
  };

  // Derived stats
  const hostNodes    = elements.filter((e) => e.data?.type === "host");
  const allVulns     = hostNodes.flatMap((n) => n.data?.vulnerabilities || []);
  const critCount    = allVulns.filter((v) => v.severity?.toLowerCase() === "critical").length;
  const highCount    = allVulns.filter((v) => v.severity?.toLowerCase() === "high").length;
  const openPortCount = hostNodes.flatMap((n) => (n.data?.ports || []).filter((p) => p.state === "open")).length;

  return (
    <div className="h-full flex flex-col font-display bg-[#0a0a0a]">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-[#1f1f1f] bg-[#0d0d0d] px-4 shrink-0 h-11">
        <div className="flex items-center gap-4 h-full">
          <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80 shrink-0">
            <span className="material-symbols-outlined text-xl">hub</span>
            <span className="text-xs font-bold tracking-widest uppercase hidden sm:block">PwnCortex</span>
          </Link>
          <div className="h-4 w-px bg-[#2a2a2a]" />
          <span className="text-xs font-mono text-slate-500 truncate max-w-48" title={project?.name}>
            {project?.name || "—"}
          </span>
          {/* Nav tabs */}
          <nav className="flex h-full ml-1">
            {[
              { id: "graph",     icon: "account_tree", label: "Graph"     },
              { id: "notes",     icon: "note_alt",     label: "Notes"     },
              { id: "report",    icon: "description",  label: "Report"    },
              { id: "checklist", icon: "checklist",    label: "Checklist" },
              { id: "ai-chat",   icon: "psychology",   label: "AI Chat"   },
            ].map(({ id: vid, icon, label }) => (
              <button
                key={vid}
                onClick={() => { setActiveView(vid); if (vid === "report") fetchReport(); }}
                className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeView === vid
                    ? "text-primary border-primary"
                    : "text-slate-400 border-transparent hover:text-slate-200 hover:border-[#444]"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Views ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">

        {/* ── GRAPH VIEW ────────────────────────────────────────────────────── */}
        {activeView === "graph" && (
          <div className="flex h-full">
            {/* Left: Upload + Stats */}
            <aside className={`shrink-0 border-r border-[#1f1f1f] bg-[#0d0d0d] flex flex-col transition-all duration-200 overflow-hidden ${sidebarCollapsed ? "w-8" : "w-48"}`}>
              {/* Collapse toggle */}
              <button
                onClick={toggleSidebar}
                className="flex items-center justify-center h-8 border-b border-[#1f1f1f] text-slate-600 hover:text-primary transition-colors shrink-0"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {sidebarCollapsed ? "chevron_right" : "chevron_left"}
                </span>
              </button>
              {!sidebarCollapsed && (<>
              <div className="p-3 border-b border-[#1f1f1f]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Ingest</p>
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" id="file-upload" accept=".xml,.json,.md,.txt" />
                <label
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full py-5 border border-dashed rounded-lg cursor-pointer transition-all text-center ${
                    uploadStatus === "uploading" ? "border-primary/60 bg-primary/5 text-primary animate-pulse" :
                    uploadStatus === "success"   ? "border-teal-600 bg-teal-950/30 text-teal-400" :
                    uploadStatus === "error"     ? "border-red-700 bg-red-950/30 text-red-400" :
                    "border-[#2a2a2a] hover:border-primary/40 hover:bg-primary/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl mb-1">
                    {uploadStatus === "uploading" ? "sync" : uploadStatus === "success" ? "check_circle" : uploadStatus === "error" ? "error" : "cloud_upload"}
                  </span>
                  <span className="text-[9px] font-mono whitespace-pre-line leading-snug px-1">
                    {uploadStatus === "uploading" ? "Processing..." :
                     uploadStatus === "success"   ? "Imported!" :
                     uploadStatus === "error"     ? "Upload failed" :
                     "XML · JSON\nMD · TXT"}
                  </span>
                </label>
              </div>
              <div className="p-3 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Scope</p>
                <StatRow icon="devices"    label="Hosts"      value={hostNodes.length} />
                <StatRow icon="lan"        label="Open Ports" value={openPortCount} />
                <StatRow icon="bug_report" label="Vulns"      value={allVulns.length} color={allVulns.length > 0 ? "text-red-400" : "text-slate-300"} />
                {critCount > 0 && <StatRow icon="emergency" label="Critical" value={critCount} color="text-red-500" />}
                {highCount > 0 && <StatRow icon="warning"   label="High"     value={highCount} color="text-orange-400" />}
              </div>
              <div className="p-3 mt-auto border-t border-[#1f1f1f]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Legend</p>
                {[
                  { color: "bg-red-500",    label: "Critical" },
                  { color: "bg-orange-400", label: "High"     },
                  { color: "bg-yellow-400", label: "Medium"   },
                  { color: "bg-teal-500",   label: "Low"      },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 mb-1">
                    <span className={`size-2 rounded-full border ${color}`} />
                    <span className="text-[9px] font-mono text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
              </>)}
            </aside>

            {/* Center: Graph */}
            <section className="flex-1 relative topology-canvas overflow-hidden">
              {elements.length > 0 ? (
                <CytoscapeComponent
                  key={nodeCount}
                  elements={elements}
                  style={{ width: "100%", height: "100%" }}
                  stylesheet={cytoscapeStylesheet}
                  minZoom={0.3}
                  maxZoom={4}
                  layout={{
                    name: "concentric",
                    padding: 70,
                    animate: false,
                    concentric: (node) => (node.data("type") === "project" ? 10 : 1),
                    levelWidth: () => 1,
                    minNodeSpacing: 30,
                    equidistant: true,
                    startAngle: (3 / 2) * Math.PI,
                    sweep: 2 * Math.PI,
                  }}
                  cy={(cy) => {
                    cyRef.current = cy;
                    cy.on("tap", "node", (evt) => setSelectedNode(evt.target.data()));
                    cy.on("tap", (evt) => {
                      if (evt.target === cy) { setSelectedNode(null); setRightPanel("chat"); }
                    });
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-600 border border-[#1f1f1f] p-8 rounded-xl bg-[#0d0d0d]/80 backdrop-blur">
                    <span className="material-symbols-outlined text-4xl block mb-3">radar</span>
                    <p className="text-xs font-mono">No hosts detected yet.</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">Upload an Nmap XML or scan results.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Right: Chat + Node */}
            <aside className="w-[330px] shrink-0 border-l border-[#1f1f1f] bg-[#0d0d0d] flex flex-col">
              <div className="flex border-b border-[#1f1f1f] shrink-0">
                {[
                  { id: "chat", icon: "psychology", label: "AI Analyst" },
                  { id: "node", icon: "dns",        label: selectedNode ? selectedNode.label : "Node" },
                ].map(({ id: pid, icon, label }) => (
                  <button
                    key={pid}
                    onClick={() => setRightPanel(pid)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                      rightPanel === pid
                        ? "text-primary border-primary bg-primary/5"
                        : "text-slate-600 border-transparent hover:text-slate-400"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{icon}</span>
                    <span className="truncate max-w-24">{label}</span>
                    {pid === "node" && selectedNode && (
                      <span className={`size-1.5 rounded-full ml-0.5 ${
                        selectedNode.risk_level === "critical" ? "bg-red-500" :
                        selectedNode.risk_level === "high"     ? "bg-orange-400" : "bg-teal-400"
                      }`} />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {rightPanel === "chat" ? (
                  <ChatPanel
                    projectId={id}
                    logs={chatLogs}
                    setLogs={setChatLogs}
                    isLoading={isChatLoading}
                    setIsLoading={setIsChatLoading}
                  />
                ) : (
                  <NodePanel node={selectedNode} projectId={id} />
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ── REPORT VIEW ───────────────────────────────────────────────────── */}
        {activeView === "report" && (
          <div className="flex flex-col h-full bg-[#0a0a0a]">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1f1f1f] bg-[#0d0d0d] shrink-0">
              <div>
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Engagement Report</h2>
                <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                  {project?.name}
                  {reportSyncedAt && (
                    <span className="ml-2 text-teal-700">
                      · synced {new Date(reportSyncedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={syncReport}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-teal-900/60 text-teal-600 rounded hover:border-teal-600 hover:text-teal-400 disabled:opacity-30 transition-all"
                  title="Sync verified notes into the report draft"
                >
                  <span className={`material-symbols-outlined text-[13px] ${isSyncing ? "animate-spin" : ""}`}>sync</span>
                  Sync Notes
                </button>
                <button
                  onClick={fetchReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-[#2a2a2a] text-slate-400 rounded hover:border-primary/40 hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-[13px]">refresh</span>
                  Regenerate
                </button>
                <button
                  onClick={exportPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-black rounded hover:bg-primary/90 transition-all"
                >
                  <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>
                  Export PDF
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <SimpleMdeReact
                value={reportMarkdown}
                onChange={setReportMarkdown}
                options={simpleMdeOptions}
              />
            </div>
          </div>
        )}

        {/* ── NOTES VIEW ────────────────────────────────────────────────────── */}
        {activeView === "notes" && <NotesView projectId={id} />}

        {/* ── AI CHAT VIEW ─────────────────────────────────────────────────── */}
        {activeView === "ai-chat" && <AIChatView projectId={id} />}

        {/* ── CHECKLIST VIEW ────────────────────────────────────────────────── */}
        {activeView === "checklist" && (
          <ChecklistView
            projectId={id}
            items={checklistItems}
            setItems={setChecklistItems}
            onEvidenceUpdate={() => { fetchReport(); fetchGraph(); }}
          />
        )}
      </main>

      {/* ── Status Bar ──────────────────────────────────────────────────────── */}
      <footer className="h-6 bg-[#080808] border-t border-[#161616] px-4 flex items-center justify-end text-[9px] font-mono text-slate-500 shrink-0">
        <div className="flex items-center gap-4">
          <span>NODES: {hostNodes.length}</span>
          <span>VULNS: {allVulns.length}</span>
          <span className="text-slate-400">{project?.name || "—"}</span>
        </div>
      </footer>
    </div>
  );
}
