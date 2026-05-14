// Genesis — Note editor, sidebar, right rail, daily, chat, palette, settings
const sUseState = React.useState, sUseEffect = React.useEffect, sUseRef = React.useRef, sUseMemo = React.useMemo;

// ── Sidebar (file tree + tags) ────────────────────────────────
function Sidebar({ activeId, onOpen, activeTags, toggleTag, mode, setMode, onOpenSettings }) {
  const [filter, setFilter] = sUseState("");
  const notes = window.GKS.D.notes;
  const filtered = sUseMemo(() => {
    const q = filter.toLowerCase();
    return notes.filter(n =>
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [filter, notes]);

  const groups = sUseMemo(() => {
    const g = { MOC: [], FEAT: [], FLOW: [], CONCEPT: [], ENTITY: [] };
    filtered.forEach(n => g[n.type]?.push(n));
    Object.values(g).forEach(arr => arr.sort((a,b) => a.title.localeCompare(b.title)));
    return g;
  }, [filtered]);

  return (
    <aside className="sidebar">
      <div className="sb-nav">
        <button className={mode==="files" ? "active" : ""} onClick={() => setMode("files")} title="Notes">
          <Icon name="layers"/>
        </button>
        <button className={mode==="tags" ? "active" : ""} onClick={() => setMode("tags")} title="Tags">
          <Icon name="hash"/>
        </button>
        <button className={mode==="daily" ? "active" : ""} onClick={() => setMode("daily")} title="Daily">
          <Icon name="calendar"/>
        </button>
        <button onClick={onOpenSettings} title="Settings">
          <Icon name="settings"/>
        </button>
      </div>
      <div className="sb-search">
        <input placeholder={mode==="tags" ? "Filter tags…" : "Filter notes…"}
               value={filter} onChange={e => setFilter(e.target.value)}/>
      </div>
      <div className="sb-body scroll-thin">
        {mode === "files" && (
          <>
            {Object.entries(groups).map(([type, arr]) => arr.length > 0 && (
              <div key={type} style={{ display: "contents" }}>
                <div className="sb-section">
                  <span>{window.GKS.TYPE_META[type]?.label}</span>
                  <span className="count">{arr.length}</span>
                </div>
                {arr.map(n => (
                  <div key={n.id}
                       className={"tree-item" + (n.id === activeId ? " active" : "")}
                       onClick={() => onOpen(n.id)}
                       title={n.id}>
                    {window.GKS.typeDot(n.type, 7)}
                    <span className="label">{n.title}</span>
                    <span className="meta">{(window.GKS.D.adj[n.id]?.out.size || 0)}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
        {mode === "tags" && (
          <>
            <div className="sb-section"><span>All tags</span><span className="count">{window.GKS.D.tags.length}</span></div>
            {window.GKS.D.tags
              .filter(([t]) => !filter || t.includes(filter.toLowerCase()))
              .map(([t, c]) => (
                <div key={t}
                     className={"tag-item" + (activeTags.includes(t) ? " active" : "")}
                     onClick={() => toggleTag(t)}>
                  <span className="hash">#</span>{t}
                  <span className="count">{c}</span>
                </div>
              ))}
          </>
        )}
        {mode === "daily" && (
          <>
            <div className="sb-section"><span>Recent days</span><span className="count">{window.GKS.D.daily.length}</span></div>
            {window.GKS.D.daily.map(d => (
              <div key={d.date} className="tree-item" onClick={() => onOpen("__daily__")}>
                <span className="chev">▸</span>
                <span className="label">{d.title}</span>
                <span className="meta">{d.date.slice(5)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

// ── Right rail (Backlinks / Related / AI) ────────────────────
function RightRail({ activeId, onOpen, semanticHits, semanticState, semanticQuery }) {
  const [tab, setTab] = sUseState("links");
  const note = activeId && window.GKS.NOTE_BY_ID[activeId];
  const out = note ? [...(window.GKS.D.adj[note.id]?.out || [])] : [];
  const ins = note ? [...(window.GKS.D.adj[note.id]?.in || [])]   : [];
  const related = note ? window.GKS.D.notes
    .filter(n => n.id !== note.id)
    .map(n => ({ n, s: window.GKS.D.similarity(note.id, n.id) }))
    .sort((a,b) => b.s - a.s)
    .slice(0, 8) : [];

  return (
    <aside className="rail">
      <div className="rail-tabs">
        <button className={tab==="links" ? "active" : ""} onClick={() => setTab("links")}>Links</button>
        <button className={tab==="related" ? "active" : ""} onClick={() => setTab("related")}>Related</button>
        <button className={tab==="semantic" ? "active" : ""} onClick={() => setTab("semantic")}>Semantic</button>
        <button className={tab==="agents" ? "active" : ""} onClick={() => setTab("agents")}>Agents</button>
      </div>
      <div className="rail-body scroll-thin">
        {tab === "links" && note && (
          <>
            <div className="panel-title">↳ Outbound · {out.length}</div>
            {out.length === 0 && <div className="empty">No outbound links</div>}
            {out.map(id => <RefCard key={id} id={id} kind="out" onOpen={onOpen}/>)}
            <div className="panel-title" style={{ marginTop: 18 }}>↰ Backlinks · {ins.length}</div>
            {ins.length === 0 && <div className="empty">No backlinks yet</div>}
            {ins.map(id => <RefCard key={id} id={id} kind="in" onOpen={onOpen} sourceId={note.id}/>)}
          </>
        )}
        {tab === "links" && !note && <div className="empty">Open a note to see its links</div>}

        {tab === "related" && note && (
          <>
            <div className="panel-title">Related notes (by embedding sim)</div>
            {related.map(({ n, s }) => <RefCard key={n.id} id={n.id} score={s} onOpen={onOpen}/>)}
          </>
        )}
        {tab === "related" && !note && <div className="empty">Open a note to see related</div>}

        {tab === "semantic" && (
          <SemanticPanel hits={semanticHits} state={semanticState} query={semanticQuery} onOpen={onOpen}/>
        )}
        {tab === "agents" && <MCPRailPanel onOpenFull={() => onOpen("__mcp__")}/>}
      </div>
    </aside>
  );
}

function RefCard({ id, kind, score, sourceId, onOpen }) {
  const n = window.GKS.NOTE_BY_ID[id]; if (!n) return null;
  const meta = window.GKS.TYPE_META[n.type];
  // when showing a backlink, find the line in the source that mentions this id
  let snip = window.GKS.snippet(n.body);
  if (kind === "in" && sourceId) {
    const src = window.GKS.NOTE_BY_ID[id];
    const lines = src.body.split("\n").filter(l => l.includes(`[[${sourceId}]]`));
    if (lines[0]) snip = lines[0].replace(/^[#>\-\s]+/, "").trim();
  }
  return (
    <div className="ref-card" onClick={() => onOpen(id)}>
      <div className="ref-title">
        <span className="dot" style={{ background: meta.raw, boxShadow: `0 0 8px ${meta.raw}` }}/>
        {n.title}
      </div>
      <div className="ref-meta">
        <span style={{ color: meta.raw }}>{meta.label}</span>
        <span>·</span>
        <span>{n.id}</span>
        {typeof score === "number" && (
          <>
            <span style={{ flex:1 }}/>
            <div className="sim-bar"><span style={{ width: (score*100).toFixed(0)+"%" }}/></div>
            <span>{(score*100).toFixed(0)}%</span>
          </>
        )}
      </div>
      <div className="ref-snippet">{window.GKS.renderInline(snip, onOpen)}</div>
    </div>
  );
}

function SemanticPanel({ hits, state, query, onOpen }) {
  if (state === "idle" && (!hits || hits.length === 0)) {
    return <div className="empty">Press <span className="kbd">⌘K</span> · Semantic mode<br/><span style={{ color: "var(--text-dim)" }}>or run a query from the top bar.</span></div>;
  }
  return (
    <>
      <div className="panel-title">
        Query
      </div>
      <div style={{ padding: "8px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
        {query || "—"}
      </div>
      <div className="panel-title">
        Top matches {state === "loading" && <span className="spin" style={{ verticalAlign: "middle", marginLeft: 6 }}/>}
      </div>
      {(hits || []).map(h => <RefCard key={h.id} id={h.id} score={h.score} onOpen={onOpen}/>)}
      {state === "done" && (!hits || hits.length===0) && <div className="empty">No matches above threshold.</div>}
    </>
  );
}

// ── Editor ─────────────────────────────────────────────────────
function Editor({ note, onOpen }) {
  if (!note) return <div className="empty" style={{ marginTop: 100 }}>Select a note from the sidebar.</div>;
  const meta = window.GKS.TYPE_META[note.type];
  return (
    <div className="editor scroll-thin">
      <h1>
        <span className="type-chip" style={{ color: meta.raw, borderColor: meta.raw + "55" }}>
          {meta.label}
        </span>
        {note.title}
      </h1>
      <div className="frontmatter">
        <span className="fm-chip">id <b>{note.id}</b></span>
        <span className="fm-chip">links-out <b>{window.GKS.D.adj[note.id]?.out.size || 0}</b></span>
        <span className="fm-chip">links-in <b>{window.GKS.D.adj[note.id]?.in.size || 0}</b></span>
        {note.tags.map(t => <span key={t} className="fm-chip" style={{ color: "var(--text-mute)" }}>#{t}</span>)}
      </div>
      {window.GKS.renderBody(note.body, onOpen)}
    </div>
  );
}

// ── Daily timeline ────────────────────────────────────────────
function Daily({ onOpen }) {
  return (
    <div className="daily scroll-thin">
      <h1>Daily notes</h1>
      <div className="sub">Stream of consciousness — auto-linked into the graph.</div>
      {window.GKS.D.daily.map(d => (
        <div className="day" key={d.date}>
          <div className="date">{d.date}<b>{d.title}</b></div>
          <div>
            <ul>
              {d.entries.map((e, i) => <li key={i}>{window.GKS.renderInline(e, onOpen)}</li>)}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AI Chat ───────────────────────────────────────────────────
function Chat({ activeId, onOpen, model }) {
  const [messages, setMessages] = sUseState([
    { who: "bot",
      text: "Ask me anything about your knowledge base. I'll pull cited notes from the graph and synthesize.",
      sources: [] }
  ]);
  const [input, setInput] = sUseState("");
  const [busy, setBusy] = sUseState(false);
  const streamRef = sUseRef(null);

  sUseEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const q = input.trim(); if (!q || busy) return;
    setInput("");
    setBusy(true);
    // Retrieve top-K by lexical-bag similarity (fast, no roundtrip needed)
    const ranked = window.GKS.D.notes
      .map(n => ({ n, s: window.GKS.searchScore(q, n) }))
      .sort((a,b) => b.s - a.s)
      .slice(0, 5);
    const ctx = ranked.map(({n}) => `## ${n.title} (${n.id})\nTags: ${n.tags.join(", ")}\n${n.body}`).join("\n\n");

    setMessages(m => [...m, { who: "user", text: q }]);

    try {
      const prompt = `You are Genesis, an assistant for a product-design knowledge base. Answer the user's question USING ONLY the notes below. Be concise (3-5 sentences max). When citing a note, use its id like [[TYPE--slug]]. If notes don't cover it, say so.\n\nNOTES:\n${ctx}\n\nQUESTION: ${q}`;
      const resp = await window.claude.complete(prompt);
      setMessages(m => [...m, { who: "bot", text: resp, sources: ranked.map(r => r.n.id) }]);
    } catch (e) {
      setMessages(m => [...m, { who: "bot", text: "⚠️ Couldn't reach the model. Showing local matches.\n\n" + ranked.map(r => `• ${r.n.title}`).join("\n"), sources: ranked.map(r => r.n.id) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat-stream scroll-thin" ref={streamRef}>
        {messages.map((m, i) => (
          <div key={i} className={"msg " + m.who}>
            <div className="who">{m.who === "user" ? "you" : "genesis · " + (model||"haiku")}</div>
            <div className="bubble">{window.GKS.renderInline(m.text, onOpen)}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                {m.sources.map(s => {
                  const n = window.GKS.NOTE_BY_ID[s]; if (!n) return null;
                  const meta = window.GKS.TYPE_META[n.type];
                  return (
                    <span key={s} className="src-chip" onClick={() => onOpen(s)}>
                      <span className="dot" style={{ background: meta.raw, boxShadow: `0 0 6px ${meta.raw}` }}/>
                      {n.title}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg bot"><div className="who">genesis</div><div className="bubble"><span className="spin"/> retrieving · embedding · synthesizing…</div></div>}
      </div>
      <div className="chat-input">
        <textarea placeholder="Ask anything · context will be pulled from your notes"
                  value={input}
                  rows={2}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}/>
        <button onClick={send} disabled={busy || !input.trim()}>
          {busy ? <span className="spin"/> : "Send ↵"}
        </button>
      </div>
    </div>
  );
}

// ── Command palette ──────────────────────────────────────────
function CommandPalette({ open, onClose, onOpen, onSemantic, model }) {
  const [mode, setMode] = sUseState("notes"); // notes | semantic | commands
  const [q, setQ] = sUseState("");
  const [sel, setSel] = sUseState(0);
  const [semanticResults, setSemanticResults] = sUseState(null);
  const [semanticBusy, setSemanticBusy] = sUseState(false);
  const inputRef = sUseRef(null);

  sUseEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  sUseEffect(() => { setSel(0); }, [q, mode]);

  // Local quick search
  const localResults = sUseMemo(() => {
    if (!q.trim()) return window.GKS.D.notes.slice(0, 10).map(n => ({ n, score: 0 }));
    return window.GKS.D.notes
      .map(n => ({ n, score: window.GKS.searchScore(q, n) }))
      .filter(r => r.score > 0.02)
      .sort((a,b) => b.score - a.score)
      .slice(0, 12);
  }, [q]);

  const commands = [
    { id: "view-graph",   title: "View graph",          sub: "Open the knowledge graph",        do: () => { onOpen("__graph__"); } },
    { id: "view-embed",   title: "View embedding map",  sub: "2D projection of all notes",       do: () => { onOpen("__embed__"); } },
    { id: "view-daily",   title: "View daily notes",    sub: "Timeline view",                   do: () => { onOpen("__daily__"); } },
    { id: "view-chat",    title: "Ask Genesis",         sub: "AI chat over your notes",          do: () => { onOpen("__chat__"); } },
    { id: "reindex",      title: "Re-embed all notes",  sub: "Rebuild semantic index",           do: () => alert("Re-indexing queued · 487 chunks") },
    { id: "settings",     title: "Open settings",       sub: "LLM, embeddings, appearance",      do: () => { onOpen("__settings__"); } },
  ];
  const commandFiltered = commands.filter(c => !q || (c.title+c.sub).toLowerCase().includes(q.toLowerCase()));

  // Semantic search — wired to Claude
  const runSemantic = async () => {
    const query = q.trim(); if (!query) return;
    setSemanticBusy(true);
    setSemanticResults(null);
    try {
      // Build candidate set (top-12 by local bag-cosine)
      const candidates = window.GKS.D.notes
        .map(n => ({ n, s: window.GKS.searchScore(query, n) }))
        .sort((a,b) => b.s - a.s)
        .slice(0, 12);
      // Ask Claude to rank for SEMANTIC relevance and return JSON
      const list = candidates.map(c => `- ${c.n.id} :: ${c.n.title} :: ${window.GKS.snippet(c.n.body, 140)}`).join("\n");
      const prompt = `You are a semantic search ranker. Re-rank these notes by relevance to the QUERY.\nReturn ONLY a JSON array (no prose), max 8 items, format:\n[{"id":"<note-id>","score":0.0-1.0,"why":"<6-word reason>"}, ...]\nSort by score descending.\n\nQUERY: "${query}"\n\nCANDIDATES:\n${list}`;
      const raw = await window.claude.complete(prompt);
      const match = raw.match(/\[[\s\S]*\]/);
      let arr = [];
      if (match) {
        try { arr = JSON.parse(match[0]); } catch (e) {}
      }
      if (!arr.length) {
        // Fallback to local
        arr = candidates.slice(0, 6).map(c => ({ id: c.n.id, score: Math.min(1, c.s * 2), why: "lexical match" }));
      }
      arr = arr.filter(r => window.GKS.NOTE_BY_ID[r.id]);
      setSemanticResults(arr);
      onSemantic?.(query, arr);
    } catch (e) {
      // Local fallback
      const candidates = window.GKS.D.notes
        .map(n => ({ id: n.id, score: window.GKS.searchScore(query, n), why: "lexical" }))
        .filter(r => r.score > 0.05)
        .sort((a,b) => b.score - a.score)
        .slice(0, 8);
      setSemanticResults(candidates);
      onSemantic?.(query, candidates);
    } finally {
      setSemanticBusy(false);
    }
  };

  const rows = mode === "notes" ? localResults.map(({n, score}) => ({
    key: n.id,
    icon: window.GKS.typeDot(n.type),
    title: n.title, sub: n.id,
    score: score > 0 ? Math.round(score*100) + "%" : null,
    onPick: () => { onOpen(n.id); onClose(); },
  })) : mode === "semantic" ? (semanticResults || []).map(r => {
    const n = window.GKS.NOTE_BY_ID[r.id]; if (!n) return null;
    return {
      key: r.id,
      icon: window.GKS.typeDot(n.type),
      title: n.title,
      sub: r.why || n.id,
      score: Math.round(r.score*100) + "%",
      onPick: () => { onOpen(r.id); onClose(); },
    };
  }).filter(Boolean) : commandFiltered.map(c => ({
    key: c.id,
    icon: <span style={{ width: 14, color: "var(--accent)", textAlign: "center" }}>⟶</span>,
    title: c.title, sub: c.sub,
    onPick: () => { c.do(); onClose(); },
  }));

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(rows.length-1, s+1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s-1)); }
    else if (e.key === "Tab") { e.preventDefault();
      setMode(m => m === "notes" ? "semantic" : m === "semantic" ? "commands" : "notes");
    }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "semantic" && (!semanticResults || semanticResults.length === 0)) {
        runSemantic();
      } else {
        rows[sel]?.onPick();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={e => e.stopPropagation()}>
        <input ref={inputRef}
               className="cmd-input"
               placeholder={mode === "semantic" ? "Ask anything — semantic search…" : mode === "commands" ? "Run a command…" : "Find a note…"}
               value={q}
               onChange={e => setQ(e.target.value)}
               onKeyDown={onKey}/>
        <div className="cmd-mode">
          <button className={mode==="notes" ? "active" : ""} onClick={() => setMode("notes")}>FIND</button>
          <button className={mode==="semantic" ? "active" : ""} onClick={() => setMode("semantic")}>SEMANTIC · {model || "haiku"}</button>
          <button className={mode==="commands" ? "active" : ""} onClick={() => setMode("commands")}>COMMANDS</button>
          {mode === "semantic" && (
            <button style={{ marginLeft: "auto", color: "var(--accent)" }} onClick={runSemantic} disabled={!q.trim() || semanticBusy}>
              {semanticBusy ? "Searching…" : "Run ↵"}
            </button>
          )}
        </div>
        <div className="cmd-results scroll-thin">
          {mode === "semantic" && !semanticResults && !semanticBusy && (
            <div className="empty">
              Type a question, press <span className="kbd">↵</span> to run semantic search.<br/>
              <span style={{ color: "var(--text-dim)", fontSize: 11 }}>Powered by an LLM reranker over local lexical recall.</span>
            </div>
          )}
          {mode === "semantic" && semanticBusy && (
            <div className="empty"><span className="spin"/> Re-ranking with {model || "haiku"}…</div>
          )}
          {rows.map((r, i) => (
            <div key={r.key} className={"cmd-row" + (i === sel ? " sel" : "")}
                 onMouseEnter={() => setSel(i)}
                 onClick={r.onPick}>
              {r.icon}
              <div>
                <div className="title">{r.title}</div>
                <div className="sub">{r.sub}</div>
              </div>
              {r.score != null && <div className="score">{r.score}</div>}
            </div>
          ))}
          {rows.length === 0 && mode !== "semantic" && <div className="empty">No matches</div>}
        </div>
        <div className="cmd-footer">
          <span><span className="kbd">↑↓</span> nav</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">Tab</span> switch mode</span>
          <span className="right"><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

// ── Settings modal ───────────────────────────────────────────
function Settings({ open, onClose, model, setModel, embedModel, setEmbedModel }) {
  const [section, setSection] = sUseState("model");
  if (!open) return null;
  const MODELS = [
    { id: "haiku-4-5",   name: "Claude Haiku 4.5",  desc: "Fast · great default", meta: "1024 tok" },
    { id: "sonnet-4-5",  name: "Claude Sonnet 4.5", desc: "Higher fidelity reasoning", meta: "8k tok" },
    { id: "opus-4",      name: "Claude Opus 4",     desc: "Deepest analysis · slow", meta: "8k tok" },
    { id: "local-llama", name: "Local Llama 3.3 70B", desc: "Runs on-device · private", meta: "offline" },
  ];
  const EMBEDS = [
    { id: "voyage-3-large", name: "voyage-3-large",      desc: "Best recall", meta: "1024-dim" },
    { id: "openai-3-large", name: "text-embedding-3-large", desc: "Strong baseline", meta: "3072-dim" },
    { id: "local-bge",      name: "bge-m3 (local)",      desc: "On-device", meta: "1024-dim" },
  ];
  return (
    <div className="settings-modal" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-side">
          <h3>Settings</h3>
          <button className={section==="model" ? "active" : ""} onClick={() => setSection("model")}>LLM Model</button>
          <button className={section==="embed" ? "active" : ""} onClick={() => setSection("embed")}>Embeddings</button>
          <button className={section==="appearance" ? "active" : ""} onClick={() => setSection("appearance")}>Appearance</button>
          <button className={section==="indexing" ? "active" : ""} onClick={() => setSection("indexing")}>Indexing</button>
          <button className={section==="about" ? "active" : ""} onClick={() => setSection("about")}>About</button>
        </div>
        <div className="settings-main scroll-thin">
          {section === "model" && (
            <>
              <h2>LLM model</h2>
              <p className="sub">Used for chat and semantic search re-ranking.</p>
              {MODELS.map(m => (
                <div key={m.id} className={"model-card" + (model === m.id ? " sel" : "")} onClick={() => setModel(m.id)}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: model === m.id ? "var(--accent)" : "var(--bg-3)", boxShadow: model === m.id ? "0 0 8px var(--accent)" : "none" }}/>
                  <div>
                    <div className="name">{m.name}</div>
                    <div className="desc">{m.desc}</div>
                  </div>
                  <div className="meta">{m.meta}</div>
                </div>
              ))}
              <div className="field">
                <label>API key</label>
                <input style={{ width: "100%", height: 32, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px" }}
                       defaultValue="sk-ant-•••••••••••••••••••••••••••3f9"/>
                <div className="help">Stored locally in OS keychain.</div>
              </div>
            </>
          )}
          {section === "embed" && (
            <>
              <h2>Embedding model</h2>
              <p className="sub">Used to build the semantic index of your notes.</p>
              {EMBEDS.map(m => (
                <div key={m.id} className={"model-card" + (embedModel === m.id ? " sel" : "")} onClick={() => setEmbedModel(m.id)}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: embedModel === m.id ? "var(--accent)" : "var(--bg-3)", boxShadow: embedModel === m.id ? "0 0 8px var(--accent)" : "none" }}/>
                  <div>
                    <div className="name">{m.name}</div>
                    <div className="desc">{m.desc}</div>
                  </div>
                  <div className="meta">{m.meta}</div>
                </div>
              ))}
              <div className="field">
                <label>Chunk size</label>
                <input type="number" defaultValue={512} style={{ width: 120, height: 30, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0 10px" }}/>
                <div className="help">Tokens per chunk · 64–2048</div>
              </div>
            </>
          )}
          {section === "appearance" && (
            <>
              <h2>Appearance</h2>
              <p className="sub">Use the floating Tweaks panel (bottom-right) to switch themes live.</p>
              <div className="field">
                <label>Color theme</label>
                <div style={{ color: "var(--text-mute)" }}>Configurable in Tweaks · Nova / Citrus / Mono / Bloom</div>
              </div>
            </>
          )}
          {section === "indexing" && (
            <>
              <h2>Indexing</h2>
              <p className="sub">Genesis maintains a local vector store for your notes.</p>
              <div className="field"><label>Notes indexed</label><div>{window.GKS.D.notes.length}</div></div>
              <div className="field"><label>Chunks</label><div>487</div></div>
              <div className="field"><label>Storage</label><div>14.2 MB · ~/.genesis/vectors.duckdb</div></div>
              <button style={{ background: "var(--accent)", color: "white", borderRadius: 8, padding: "8px 14px", marginTop: 12 }}>Re-index now</button>
            </>
          )}
          {section === "about" && (
            <>
              <h2>Genesis Knowledge System</h2>
              <p className="sub">v0.4.2 · build 2026.05.13</p>
              <p style={{ color: "var(--text-mute)", lineHeight: 1.7 }}>
                A second brain with a real graph. Notes are markdown with <code>[[wikilinks]]</code>.
                Cross-references are computed on save. Embeddings power semantic search and the
                <em> Related Notes</em> panel. All inference can run local or via Claude.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Icons (inline SVG so no asset deps) ──────────────────────
function Icon({ name }) {
  const common = { width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "layers") return <svg viewBox="0 0 24 24" {...common}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>;
  if (name === "hash")   return <svg viewBox="0 0 24 24" {...common}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>;
  if (name === "calendar") return <svg viewBox="0 0 24 24" {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (name === "settings") return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if (name === "graph")  return <svg viewBox="0 0 24 24" {...common}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><line x1="7.4" y1="7.4" x2="10.6" y2="16.6"/><line x1="16.6" y1="7.4" x2="13.4" y2="16.6"/><line x1="8" y1="6" x2="16" y2="6"/></svg>;
  if (name === "note")   return <svg viewBox="0 0 24 24" {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  if (name === "embed")  return <svg viewBox="0 0 24 24" {...common}><circle cx="6" cy="6" r="1.6"/><circle cx="14" cy="9" r="1.6"/><circle cx="9" cy="15" r="1.6"/><circle cx="18" cy="17" r="1.6"/><circle cx="20" cy="7" r="1.6"/></svg>;
  if (name === "chat")   return <svg viewBox="0 0 24 24" {...common}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
  if (name === "search") return <svg viewBox="0 0 24 24" {...common}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
  if (name === "x")      return <svg viewBox="0 0 24 24" {...common}><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>;
  return null;
}

Object.assign(window, { Sidebar, RightRail, RefCard, SemanticPanel, Editor, Daily, Chat, CommandPalette, Settings, Icon });
