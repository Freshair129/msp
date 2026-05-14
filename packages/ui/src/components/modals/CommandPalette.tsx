import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GKS_SERVICE } from '../../services/gksService';
import { TypeDot } from '../shared/TypeDot';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onSemantic?: (query: string, hits: any[]) => void;
  model: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  open, onClose, onOpen, onSemantic, model 
}) => {
  const [mode, setMode] = useState<'notes' | 'semantic' | 'commands'>('notes');
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [semanticResults, setSemanticResults] = useState<any[] | null>(null);
  const [semanticBusy, setSemanticBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => { setSel(0); }, [q, mode]);

  const localResults = useMemo(() => {
    if (!q.trim()) return GKS_SERVICE.D.notes.slice(0, 10).map(n => ({ n, score: 0 }));
    return GKS_SERVICE.D.notes
      .map(n => ({ n, score: GKS_SERVICE.searchScore(q, n) }))
      .filter(r => r.score > 0.02)
      .sort((a,b) => b.score - a.score)
      .slice(0, 12);
  }, [q]);

  const commands = [
    { id: "view-graph",   title: "View graph",          sub: "Open the knowledge graph",        do: () => { onOpen("__graph__"); } },
    { id: "view-embed",   title: "View embedding map",  sub: "2D projection of all notes",       do: () => { onOpen("__embed__"); } },
    { id: "view-daily",   title: "View daily notes",    sub: "Timeline view",                   do: () => { onOpen("__daily__"); } },
    { id: "view-chat",    title: "Ask Genesis",         sub: "AI chat over your notes",          do: () => { onOpen("__chat__"); } },
    { id: "reindex",      title: "Re-embed all notes",  sub: "Rebuild semantic index",           do: () => alert("Re-indexing queued") },
    { id: "settings",     title: "Open settings",       sub: "LLM, embeddings, appearance",      do: () => { onOpen("__settings__"); } },
  ];
  const commandFiltered = commands.filter(c => !q || (c.title+c.sub).toLowerCase().includes(q.toLowerCase()));

  const runSemantic = async () => {
    const query = q.trim(); if (!query) return;
    setSemanticBusy(true);
    setSemanticResults(null);
    
    // Simulating semantic ranking
    setTimeout(() => {
      const candidates = GKS_SERVICE.D.notes
        .map(n => ({ id: n.id, score: GKS_SERVICE.searchScore(query, n), why: "semantic match" }))
        .filter(r => r.score > 0.1)
        .sort((a,b) => b.score - a.score)
        .slice(0, 8);
      setSemanticResults(candidates);
      onSemantic?.(query, candidates);
      setSemanticBusy(false);
    }, 1000);
  };

  const rows = mode === "notes" ? localResults.map(({n, score}) => ({
    key: n.id,
    icon: <TypeDot type={n.type} />,
    title: n.title, sub: n.id,
    score: score > 0 ? Math.round(score*100) + "%" : null,
    onPick: () => { onOpen(n.id); onClose(); },
  })) : mode === "semantic" ? (semanticResults || []).map(r => {
    const n = GKS_SERVICE.NOTE_BY_ID[r.id]; if (!n) return null;
    return {
      key: r.id,
      icon: <TypeDot type={n.type} />,
      title: n.title,
      sub: r.why || n.id,
      score: Math.round(r.score*100) + "%",
      onPick: () => { onOpen(r.id); onClose(); },
    };
  }).filter((x): x is any => x !== null) : commandFiltered.map(c => ({
    key: c.id,
    icon: <span style={{ width: 14, color: "var(--accent)", textAlign: "center" }}>⟶</span>,
    title: c.title, sub: c.sub,
    onPick: () => { c.do(); onClose(); },
  }));

  const onKey = (e: React.KeyboardEvent) => {
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
          <button className={mode==="semantic" ? "active" : ""} onClick={() => setMode("semantic")}>SEMANTIC · {model}</button>
          <button className={mode==="commands" ? "active" : ""} onClick={() => setMode("commands")}>COMMANDS</button>
          {mode === "semantic" && (
            <button style={{ marginLeft: "auto", color: "var(--accent)" }} onClick={runSemantic} disabled={!q.trim() || semanticBusy}>
              {semanticBusy ? "Searching…" : "Run ↵"}
            </button>
          )}
        </div>
        <div className="cmd-results scroll-thin">
          {mode === "semantic" && !semanticResults && !semanticBusy && (
            <div className="empty">Type a question, press <span className="kbd">↵</span> to run semantic search.</div>
          )}
          {mode === "semantic" && semanticBusy && (
            <div className="empty"><span className="spin"/> Re-ranking with {model}…</div>
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
      </div>
    </div>
  );
};
