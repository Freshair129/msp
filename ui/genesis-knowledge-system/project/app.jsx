// Genesis — Main app shell
const { useState: aState, useEffect: aEffect, useMemo: aMemo, useRef: aRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "nova",
  "density": "comfy",
  "showStatus": true,
  "accent": "#7c5cff"
}/*EDITMODE-END*/;

const THEMES = {
  nova:   { accent: "#7c5cff", soft: "rgba(124,92,255,0.16)" },           // electric purple
  citrus: { accent: "#fbbf24", soft: "rgba(251,191,36,0.18)" },          // amber
  bloom:  { accent: "#f472b6", soft: "rgba(244,114,182,0.20)" },         // pink
  mono:   { accent: "#a4a9be", soft: "rgba(164,169,190,0.16)" },         // gray
  cyber:  { accent: "#4dd6e8", soft: "rgba(77,214,232,0.18)" },          // cyan
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.nova;
  document.documentElement.style.setProperty("--accent", t.accent);
  document.documentElement.style.setProperty("--accent-soft", t.soft);
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  aEffect(() => { applyTheme(tweaks.theme); }, [tweaks.theme]);
  aEffect(() => { document.documentElement.style.setProperty("--accent", tweaks.accent || THEMES[tweaks.theme]?.accent || "#7c5cff"); }, [tweaks.accent]);

  // Tabs (multi-doc model)
  const [tabs, setTabs] = aState([
    { kind: "graph",  id: "__graph__",         title: "Knowledge Graph" },
    { kind: "note",   id: "MOC--product",      title: "MOC — Product" },
  ]);
  const [activeTabIdx, setActiveTabIdx] = aState(1);
  const active = tabs[activeTabIdx];

  // Sidebar mode
  const [sbMode, setSbMode] = aState("files");
  // Graph mode (2D | 3D)
  const [graphMode, setGraphMode] = aState("3d");
  const [activeTags, setActiveTags] = aState([]);
  const toggleTag = (t) => setActiveTags(arr => arr.includes(t) ? arr.filter(x => x !== t) : [...arr, t]);

  // Filtered notes by tag
  const filteredNotes = aMemo(() => {
    if (activeTags.length === 0) return window.GKS.D.notes;
    return window.GKS.D.notes.filter(n => activeTags.every(t => n.tags.includes(t)));
  }, [activeTags]);
  const filteredEdges = aMemo(() => {
    const ids = new Set(filteredNotes.map(n => n.id));
    return window.GKS.D.edges.filter(e => ids.has(e.source) && ids.has(e.target));
  }, [filteredNotes]);

  // Open a note/view
  const openId = (id) => {
    // Special views
    const isView = id?.startsWith("__");
    if (isView) {
      const titles = { "__graph__":"Knowledge Graph", "__embed__":"Embedding Map", "__daily__":"Daily Notes", "__chat__":"Ask Genesis", "__settings__":"Settings", "__mcp__":"Agents & MCP" };
      if (id === "__settings__") { setShowSettings(true); return; }
      const existing = tabs.findIndex(t => t.id === id);
      if (existing >= 0) { setActiveTabIdx(existing); return; }
      const kind = id.slice(2, -2); // "graph", "embed", "daily", "chat"
      setTabs(ts => [...ts, { kind, id, title: titles[id] }]);
      setActiveTabIdx(tabs.length);
      return;
    }
    const note = window.GKS.NOTE_BY_ID[id]; if (!note) return;
    const existing = tabs.findIndex(t => t.id === id);
    if (existing >= 0) { setActiveTabIdx(existing); return; }
    setTabs(ts => [...ts, { kind: "note", id, title: note.title }]);
    setActiveTabIdx(tabs.length);
  };

  const closeTab = (i) => {
    setTabs(ts => {
      const next = ts.filter((_, idx) => idx !== i);
      if (next.length === 0) return [{ kind: "graph", id: "__graph__", title: "Knowledge Graph" }];
      return next;
    });
    setActiveTabIdx(idx => Math.max(0, Math.min(idx, tabs.length - 2)));
  };

  // Command palette
  const [paletteOpen, setPaletteOpen] = aState(false);
  const [showSettings, setShowSettings] = aState(false);
  aEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(o => !o); }
      else if (e.key === "Escape") { setPaletteOpen(false); }
      else if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); setShowSettings(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Semantic search state (results shown in right rail)
  const [semantic, setSemantic] = aState({ query: "", hits: [], state: "idle" });

  const runSemanticFromTopbar = async (q) => {
    setSemantic({ query: q, hits: [], state: "loading" });
    setRailFocus("semantic");
    try {
      const candidates = window.GKS.D.notes
        .map(n => ({ n, s: window.GKS.searchScore(q, n) }))
        .sort((a,b) => b.s - a.s)
        .slice(0, 12);
      const list = candidates.map(c => `- ${c.n.id} :: ${c.n.title} :: ${window.GKS.snippet(c.n.body, 140)}`).join("\n");
      const prompt = `Re-rank these notes by relevance to the QUERY. Return ONLY a JSON array of {"id","score","why"} (max 8), sorted by score.\n\nQUERY: "${q}"\n\nCANDIDATES:\n${list}`;
      const raw = await window.claude.complete(prompt);
      const match = raw.match(/\[[\s\S]*\]/);
      let arr = [];
      if (match) { try { arr = JSON.parse(match[0]); } catch (e) {} }
      if (!arr.length) arr = candidates.slice(0,6).map(c => ({ id: c.n.id, score: Math.min(1, c.s*2), why: "lexical match" }));
      arr = arr.filter(r => window.GKS.NOTE_BY_ID[r.id]);
      setSemantic({ query: q, hits: arr, state: "done" });
    } catch (e) {
      const candidates = window.GKS.D.notes
        .map(n => ({ id: n.id, score: window.GKS.searchScore(q, n), why: "lexical" }))
        .filter(r => r.score > 0.05)
        .sort((a,b) => b.score - a.score)
        .slice(0, 8);
      setSemantic({ query: q, hits: candidates, state: "done" });
    }
  };

  const [model, setModel] = aState("haiku-4-5");
  const [embedModel, setEmbedModel] = aState("voyage-3-large");
  const [railFocus, setRailFocus] = aState(null); // hint to right-rail

  // Focused note id (used by graph / embed / rail to highlight)
  const focusNoteId = active?.kind === "note" ? active.id : null;

  return (
    <div className="app">
      {/* Window chrome (desktop-app feel) */}
      <div className="chrome">
        <div className="tl">
          <span className="tl-dot red"/>
          <span className="tl-dot yellow"/>
          <span className="tl-dot green"/>
        </div>
        <div className="chrome-title">
          <b>Genesis</b> &nbsp;—&nbsp; gks · {active?.title || "Knowledge"}
        </div>
        <div className="chrome-right">
          <span className="chrome-pill"><span className="pulse"/>{window.MCP_SERVERS.filter(s => s.status==="connected").length} MCP</span>
          <span>{model}</span>
          <span>v0.4.2</span>
        </div>
      </div>
      {/* Top bar */}
      <div className="topbar">
        <div className="tb-brand">
          <span className="tb-logo"/>
          Genesis <small>v0.4.2</small>
        </div>
        <div className="tb-tabs">
          {tabs.map((t, i) => (
            <span key={t.id} className={"tb-tab" + (i === activeTabIdx ? " active" : "")}
                  onClick={() => setActiveTabIdx(i)}
                  data-screen-label={`tab-${t.kind}-${t.id}`}>
              {t.kind === "note" && window.GKS.typeDot(window.GKS.NOTE_BY_ID[t.id]?.type)}
              {t.kind === "graph" && <Icon name="graph"/>}
              {t.kind === "embed" && <Icon name="embed"/>}
              {t.kind === "daily" && <Icon name="calendar"/>}
              {t.kind === "chat" && <Icon name="chat"/>}
              <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</span>
              <span className="x" onClick={(e) => { e.stopPropagation(); closeTab(i); }}><Icon name="x"/></span>
            </span>
          ))}
        </div>
        <TopbarSearch onSubmit={runSemanticFromTopbar}/>
        <div className="tb-right">
          <button className="tb-iconbtn" title="Open graph (⌘G)" onClick={() => openId("__graph__")}><Icon name="graph"/></button>
          <button className="tb-iconbtn" title="Open embedding map" onClick={() => openId("__embed__")}><Icon name="embed"/></button>
          <button className="tb-iconbtn" title="Ask Genesis" onClick={() => openId("__chat__")}><Icon name="chat"/></button>
          <button className="tb-iconbtn" title="Agents & MCP" onClick={() => openId("__mcp__")}><Icon name="settings"/></button>
          <button className="tb-iconbtn" title="Command Palette (⌘K)" onClick={() => setPaletteOpen(true)}><Icon name="search"/></button>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar activeId={focusNoteId}
               onOpen={openId}
               activeTags={activeTags}
               toggleTag={toggleTag}
               mode={sbMode}
               setMode={setSbMode}
               onOpenSettings={() => setShowSettings(true)}/>

      {/* Main */}
      <main className="main">
        <div className="main-header">
          <div className="crumb">
            {active?.kind === "note" && (
              <>
                <span>{window.GKS.TYPE_META[window.GKS.NOTE_BY_ID[active.id]?.type]?.label}</span>
                <span style={{ margin: "0 6px" }}>/</span>
                <b>{active.title}</b>
              </>
            )}
            {active?.kind === "graph" && (
              <>
                <span>VIEW</span><span style={{ margin:"0 6px" }}>/</span><b>Knowledge Graph</b>
                <span style={{ marginLeft: 12, color:"var(--text-dim)" }}>
                  {filteredNotes.length} nodes · {filteredEdges.length} edges
                  {activeTags.length > 0 && <span> · filtered by {activeTags.map(t => "#"+t).join(", ")}</span>}
                </span>
                <div style={{ marginLeft: 14, display:"flex", gap: 2, background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius: 7, padding: 2 }}>
                  <button style={{ height: 22, padding: "0 9px", borderRadius: 5, fontSize: 11, color: graphMode==="2d" ? "var(--accent)" : "var(--text-mute)", background: graphMode==="2d" ? "var(--accent-soft)" : "transparent", fontFamily: "var(--font-mono)" }}
                          onClick={() => setGraphMode("2d")}>2D</button>
                  <button style={{ height: 22, padding: "0 9px", borderRadius: 5, fontSize: 11, color: graphMode==="3d" ? "var(--accent)" : "var(--text-mute)", background: graphMode==="3d" ? "var(--accent-soft)" : "transparent", fontFamily: "var(--font-mono)" }}
                          onClick={() => setGraphMode("3d")}>3D · neural</button>
                  <button style={{ height: 22, padding: "0 9px", borderRadius: 5, fontSize: 11, color: graphMode==="galaxy" ? "var(--accent)" : "var(--text-mute)", background: graphMode==="galaxy" ? "var(--accent-soft)" : "transparent", fontFamily: "var(--font-mono)" }}
                          onClick={() => setGraphMode("galaxy")}>🌌 galaxy</button>
                </div>
              </>
            )}
            {active?.kind === "embed" && (
              <><span>VIEW</span><span style={{ margin:"0 6px" }}>/</span><b>Embedding Map</b></>
            )}
            {active?.kind === "daily" && (
              <><span>VIEW</span><span style={{ margin:"0 6px" }}>/</span><b>Daily Notes</b></>
            )}
            {active?.kind === "chat" && (
              <><span>VIEW</span><span style={{ margin:"0 6px" }}>/</span><b>Ask Genesis · {model}</b></>
            )}
            {active?.kind === "mcp" && (
              <><span>VIEW</span><span style={{ margin:"0 6px" }}>/</span><b>Agents & MCP</b></>
            )}
          </div>
          <div className="view-switch">
            {[
              { k:"note", id: focusNoteId || tabs.find(t=>t.kind==="note")?.id || "MOC--product", label:"Editor", icon:"note" },
              { k:"graph", id:"__graph__", label:"Graph", icon:"graph" },
              { k:"embed", id:"__embed__", label:"Embeddings", icon:"embed" },
              { k:"chat", id:"__chat__", label:"Ask", icon:"chat" },
              { k:"mcp", id:"__mcp__", label:"Agents", icon:"settings" },
            ].map(v => (
              <button key={v.k}
                      className={active?.kind === v.k ? "active" : ""}
                      onClick={() => openId(v.id)}>
                <Icon name={v.icon}/>
                <span style={{ marginLeft: 6 }}>{v.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="main-body">
          {active?.kind === "note"  && <Editor note={window.GKS.NOTE_BY_ID[active.id]} onOpen={openId}/>}
          {active?.kind === "graph" && graphMode === "2d" && <GraphView notes={filteredNotes} edges={filteredEdges} focusId={null} onOpen={openId} tweaks={tweaks}/>}
          {active?.kind === "graph" && graphMode === "3d"     && <Graph3DView  notes={filteredNotes} edges={filteredEdges} focusId={null} onOpen={openId}/>}
          {active?.kind === "graph" && graphMode === "galaxy" && <GalaxyView   notes={filteredNotes} edges={filteredEdges} focusId={null} onOpen={openId}/>}
          {active?.kind === "embed" && <EmbeddingView notes={filteredNotes} focusId={focusNoteId} onOpen={openId}/>}
          {active?.kind === "daily" && <Daily onOpen={openId}/>}
          {active?.kind === "chat"  && <Chat activeId={focusNoteId} onOpen={openId} model={model}/>}
          {active?.kind === "mcp"   && <MCPView onOpen={openId}/>}
        </div>
      </main>

      {/* Right rail */}
      <RightRail activeId={focusNoteId} onOpen={openId}
                 semanticHits={semantic.hits} semanticState={semantic.state} semanticQuery={semantic.query}/>

      {/* Status bar */}
      <div className="status">
        <span className="pulse"/>
        <span>graph synced · {window.GKS.D.notes.length} notes · {window.GKS.D.edges.length} edges</span>
        <span className="sep">·</span>
        <span>vector store: {embedModel} · 487 chunks</span>
        <span className="sep">·</span>
        <span>llm: {model}</span>
        <span className="sep">·</span>
        <span style={{ color: "var(--c-moc)" }}>● mcp: {window.MCP_SERVERS.filter(s=>s.status==="connected").length} agents</span>
        <span className="right">
          <span>autosave on</span>
          <span className="sep">·</span>
          <span>⌘K palette</span>
          <span className="sep">·</span>
          <span>UTC+07</span>
        </span>
      </div>

      <CommandPalette open={paletteOpen}
                      onClose={() => setPaletteOpen(false)}
                      onOpen={openId}
                      onSemantic={(q, hits) => setSemantic({ query: q, hits, state: "done" })}
                      model={model}/>

      <Settings open={showSettings} onClose={() => setShowSettings(false)}
                model={model} setModel={setModel}
                embedModel={embedModel} setEmbedModel={setEmbedModel}/>

      {/* Tweaks (variations) */}
      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title="Theme">
          <TweakColor label="Accent" value={tweaks.accent}
                      options={["#7c5cff", "#fbbf24", "#f472b6", "#4dd6e8", "#a4a9be", "#4ade80"]}
                      onChange={v => setTweak("accent", v)}/>
          <TweakRadio label="Preset" value={tweaks.theme}
                      options={[
                        { value: "nova",   label: "Nova" },
                        { value: "cyber",  label: "Cyber" },
                        { value: "bloom",  label: "Bloom" },
                        { value: "citrus", label: "Citrus" },
                        { value: "mono",   label: "Mono" },
                      ]}
                      onChange={v => { setTweak({ theme: v, accent: THEMES[v].accent }); }}/>
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio label="Density" value={tweaks.density}
                      options={[
                        { value: "comfy", label: "Comfy" },
                        { value: "compact", label: "Compact" },
                      ]}
                      onChange={v => setTweak("density", v)}/>
          <TweakToggle label="Status bar" value={tweaks.showStatus} onChange={v => setTweak("showStatus", v)}/>
        </TweakSection>
        <TweakSection title="Quick actions">
          <TweakButton label="Open graph view" onClick={() => openId("__graph__")}/>
          <TweakButton label="Open embedding map" onClick={() => openId("__embed__")}/>
          <TweakButton label="Open AI chat" onClick={() => openId("__chat__")}/>
          <TweakButton label="Open command palette ⌘K" onClick={() => setPaletteOpen(true)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// Top-bar search trigger that submits a semantic search on enter
function TopbarSearch({ onSubmit }) {
  const [q, setQ] = aState("");
  const [focused, setFocused] = aState(false);
  return (
    <div className="tb-search-trigger" style={{ paddingLeft: 0, paddingRight: 8 }}>
      <span style={{ paddingLeft: 10 }}><Icon name="search"/></span>
      <input style={{ background:"transparent", border:0, outline:0, color:"var(--text)", flex:1, height:28, fontSize:12 }}
             placeholder="Semantic search · ask anything"
             value={q}
             onChange={e => setQ(e.target.value)}
             onFocus={() => setFocused(true)}
             onBlur={() => setFocused(false)}
             onKeyDown={e => {
               if (e.key === "Enter" && q.trim()) { onSubmit(q.trim()); }
             }}/>
      <span className="kbd">⌘K</span>
    </div>
  );
}

// Apply density-driven CSS variable bumps
function applyDensity(d) {
  if (d === "compact") {
    document.documentElement.style.setProperty("--radius", "8px");
    document.body.style.fontSize = "12.5px";
  } else {
    document.documentElement.style.setProperty("--radius", "10px");
    document.body.style.fontSize = "13px";
  }
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App/>);
