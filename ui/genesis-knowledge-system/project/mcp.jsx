// Genesis — MCP / Agents panel
// Shows MCP servers, agent activity log, and lets you trigger agent runs

const MCP_SERVERS = [
  { id: "claude-code", name: "Claude Code", desc: "Code-aware agent over your repo", status: "connected", icon: "code",
    tools: ["read_file", "write_file", "shell", "git", "grep"], lastUsed: "2 min ago", calls: 38 },
  { id: "filesystem", name: "Filesystem", desc: "~/Notes/genesis", status: "connected", icon: "folder",
    tools: ["read", "write", "watch"], lastUsed: "just now", calls: 412 },
  { id: "git",        name: "Git",        desc: "vault repo · main", status: "connected", icon: "git",
    tools: ["log", "diff", "commit"], lastUsed: "1h ago", calls: 4 },
  { id: "github",     name: "GitHub",     desc: "yourname/notes", status: "connected", icon: "github",
    tools: ["issues", "prs", "search"], lastUsed: "yesterday", calls: 12 },
  { id: "linear",     name: "Linear",     desc: "GEN workspace · OAuth", status: "connected", icon: "linear",
    tools: ["issues", "create"], lastUsed: "3h ago", calls: 7 },
  { id: "memory",     name: "Memory",     desc: "Long-term knowledge graph", status: "connected", icon: "brain",
    tools: ["recall", "remember", "forget"], lastUsed: "5 min ago", calls: 144 },
  { id: "web",        name: "Web Search", desc: "Tavily · 500/mo", status: "connected", icon: "globe",
    tools: ["search", "fetch"], lastUsed: "12 min ago", calls: 22 },
  { id: "obsidian",   name: "Vault Sync", desc: "Local markdown sync", status: "syncing", icon: "sync",
    tools: ["pull", "push"], lastUsed: "now", calls: 9 },
  { id: "postgres",   name: "Postgres",   desc: "research_db @ localhost", status: "offline", icon: "db",
    tools: ["query"], lastUsed: "—", calls: 0 },
];

const AGENT_ACTIVITY = [
  { t: "14:22:08", agent: "claude-code", action: "Reviewed [[FEAT--inventory-system]]", result: "ok", detail: "Suggested 3 schema changes to ENTITY--stock-movement" },
  { t: "14:21:51", agent: "memory",      action: "Recalled 'open requirements'",         result: "ok", detail: "Surfaced 4 related concepts" },
  { t: "14:20:13", agent: "claude-code", action: "Generated FLOW--procurement diagram",  result: "ok", detail: "Wrote 217 lines of mermaid + linked back to PO" },
  { t: "14:18:02", agent: "filesystem",  action: "Watched ~/Notes/genesis",              result: "ok", detail: "Detected 2 file changes — re-indexed" },
  { t: "14:15:44", agent: "web",         action: "Searched 'inventory reconciliation'",  result: "ok", detail: "Pulled 3 sources into [[CONCEPT--audit-trail]]" },
  { t: "14:11:30", agent: "git",         action: "Committed 'note(MOC): reorg pillars'", result: "ok", detail: "12 files changed, 84 insertions" },
  { t: "14:08:17", agent: "linear",      action: "Created issue GEN-148",                result: "ok", detail: "Linked from [[CONCEPT--open-requirements]]" },
];

function MCPIcon({ name }) {
  const c = { width: 14, height: 14, stroke: "currentColor", fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "code")   return <svg viewBox="0 0 24 24" {...c}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
  if (name === "folder") return <svg viewBox="0 0 24 24" {...c}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
  if (name === "git")    return <svg viewBox="0 0 24 24" {...c}><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M16.5 13.5L8 8"/></svg>;
  if (name === "github") return <svg viewBox="0 0 24 24" {...c}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
  if (name === "linear") return <svg viewBox="0 0 24 24" {...c}><path d="M3 17l9-12 9 12-9 4-9-4z"/></svg>;
  if (name === "brain")  return <svg viewBox="0 0 24 24" {...c}><path d="M9 3a3 3 0 0 0-3 3v.5a3 3 0 0 0-2 5.5 3 3 0 0 0 2 5.5V18a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M15 3a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 5.5 3 3 0 0 1-2 5.5V18a3 3 0 0 1-6 0"/></svg>;
  if (name === "globe")  return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>;
  if (name === "sync")   return <svg viewBox="0 0 24 24" {...c}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
  if (name === "db")     return <svg viewBox="0 0 24 24" {...c}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>;
  return <svg viewBox="0 0 24 24" {...c}><circle cx="12" cy="12" r="9"/></svg>;
}

function StatusDot({ status }) {
  const map = {
    connected: { c: "#4ade80", glow: "#4ade80" },
    syncing:   { c: "#fbbf24", glow: "#fbbf24" },
    offline:   { c: "#5a5f73", glow: "transparent" },
    error:     { c: "#f87171", glow: "#f87171" },
  };
  const m = map[status] || map.offline;
  return <span style={{
    display:"inline-block", width: 7, height: 7, borderRadius: "50%",
    background: m.c, boxShadow: m.glow !== "transparent" ? `0 0 8px ${m.glow}` : "none",
    animation: status === "syncing" ? "pulse 1.4s ease-in-out infinite" : "none",
    flex: "none",
  }}/>;
}

function MCPView({ onOpen }) {
  return (
    <div style={{ height: "100%", overflow: "auto", padding: "28px max(28px, calc((100% - 920px)/2))" }} className="scroll-thin">
      <div style={{ display:"flex", alignItems:"baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ margin:0, fontSize: 22 }}>Agents & MCP</h1>
        <span style={{ fontFamily:"var(--font-mono)", fontSize: 11, color:"var(--text-dim)" }}>
          {MCP_SERVERS.filter(s => s.status==="connected").length} of {MCP_SERVERS.length} connected
        </span>
      </div>
      <div style={{ color:"var(--text-mute)", marginBottom: 24, fontSize: 12.5 }}>
        Model Context Protocol servers let Claude Code and other agents read & write your knowledge base.
      </div>

      <div className="panel-title">Connected servers</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 24 }}>
        {MCP_SERVERS.map(s => (
          <div key={s.id} style={{
            padding: 12, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "var(--bg-3)", display:"flex", alignItems:"center", justifyContent:"center",
                color: s.status === "connected" ? "var(--accent)" : "var(--text-mute)",
              }}>
                <MCPIcon name={s.icon}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                <div style={{ color:"var(--text-mute)", fontSize: 11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.desc}</div>
              </div>
              <StatusDot status={s.status}/>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap: 4, marginTop: 10 }}>
              {s.tools.map(t => (
                <span key={t} style={{
                  fontFamily:"var(--font-mono)", fontSize: 10,
                  padding: "2px 6px", borderRadius: 4,
                  background: "var(--bg-3)", color: "var(--text-mute)",
                }}>{t}</span>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop: 10, fontFamily:"var(--font-mono)", fontSize: 10, color:"var(--text-dim)" }}>
              <span>{s.calls} calls today</span>
              <span>{s.lastUsed}</span>
            </div>
          </div>
        ))}
        <div style={{
          padding: 12, background: "transparent", border: "1px dashed var(--border-strong)", borderRadius: 10,
          display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-mute)",
          cursor:"pointer", minHeight: 116, fontSize: 12.5,
        }}>
          + Add MCP server
        </div>
      </div>

      <div className="panel-title">Agent activity · live</div>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {AGENT_ACTIVITY.map((a, i) => (
          <div key={i} style={{
            display:"grid", gridTemplateColumns:"82px 130px 1fr auto", gap: 14, alignItems:"center",
            padding: "10px 14px", borderTop: i ? "1px solid var(--border)" : 0,
          }}>
            <span style={{ fontFamily:"var(--font-mono)", color:"var(--text-dim)", fontSize: 11 }}>{a.t}</span>
            <span style={{ display:"inline-flex", alignItems:"center", gap: 6, fontFamily:"var(--font-mono)", fontSize: 11 }}>
              <StatusDot status="connected"/>
              <span style={{ color:"var(--accent)" }}>{a.agent}</span>
            </span>
            <div>
              <div style={{ fontSize: 12.5 }}>{window.GKS.renderInline(a.action, onOpen)}</div>
              <div style={{ color:"var(--text-mute)", fontSize: 11, marginTop: 2 }}>{a.detail}</div>
            </div>
            <span style={{ fontFamily:"var(--font-mono)", fontSize: 10, color:"var(--c-moc)" }}>{a.result.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div className="panel-title" style={{ marginTop: 24 }}>Quick agents</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {[
          { name: "Summarize this graph", desc: "claude-code · 3-5 sentences", icon: "brain" },
          { name: "Find duplicate notes", desc: "memory · semantic clustering", icon: "sync" },
          { name: "Generate flow diagram", desc: "claude-code · mermaid output", icon: "code" },
          { name: "Tag untagged notes", desc: "claude-code · suggest tags", icon: "folder" },
          { name: "Backfill broken links", desc: "filesystem + claude-code", icon: "git" },
          { name: "Daily research digest", desc: "web + memory · 9am cron", icon: "globe" },
        ].map((q, i) => (
          <div key={i} style={{
            padding: 12, background: "var(--bg-2)", border:"1px solid var(--border)", borderRadius: 10,
            cursor: "pointer", display:"flex", gap: 10, alignItems:"center",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: "var(--accent-soft)",
              display:"flex", alignItems:"center", justifyContent:"center", color: "var(--accent)",
            }}><MCPIcon name={q.icon}/></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{q.name}</div>
              <div style={{ color:"var(--text-mute)", fontSize: 11 }}>{q.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact MCP status panel for right rail
function MCPRailPanel({ onOpenFull }) {
  return (
    <>
      <div className="panel-title">MCP Servers</div>
      {MCP_SERVERS.slice(0, 6).map(s => (
        <div key={s.id} style={{
          display:"flex", alignItems:"center", gap: 8,
          padding: "7px 10px", background:"var(--bg-2)", border:"1px solid var(--border)",
          borderRadius: 7, marginBottom: 6,
        }}>
          <span style={{ color: s.status === "connected" ? "var(--accent)" : "var(--text-mute)" }}>
            <MCPIcon name={s.icon}/>
          </span>
          <div style={{ flex:1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
            <div style={{ color:"var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.lastUsed}</div>
          </div>
          <StatusDot status={s.status}/>
        </div>
      ))}
      <button onClick={onOpenFull} style={{
        width: "100%", padding: "8px 10px",
        background: "var(--accent-soft)", color: "var(--accent)",
        borderRadius: 7, fontSize: 12, fontWeight: 600, marginTop: 4,
      }}>
        Open full view →
      </button>

      <div className="panel-title" style={{ marginTop: 18 }}>Recent agent activity</div>
      {AGENT_ACTIVITY.slice(0, 5).map((a, i) => (
        <div key={i} style={{
          padding: "8px 10px", background: "var(--bg-2)", border:"1px solid var(--border)",
          borderRadius: 7, marginBottom: 6,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 2 }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>{a.agent}</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{a.t}</span>
          </div>
          <div style={{ fontSize: 11.5 }}>{a.action.replace(/\[\[|\]\]/g, "")}</div>
        </div>
      ))}
    </>
  );
}

window.MCPView = MCPView;
window.MCPRailPanel = MCPRailPanel;
window.MCP_SERVERS = MCP_SERVERS;
