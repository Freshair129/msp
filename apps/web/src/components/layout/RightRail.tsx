import React, { useState } from 'react';
import { GKS_SERVICE } from '../../services/gksService';
import { RefCard } from '../shared/RefCard';

interface RightRailProps {
  activeId: string | null;
  onOpen: (id: string) => void;
  semanticHits: any[];
  semanticState: 'idle' | 'loading' | 'done';
  semanticQuery: string;
}

export const RightRail: React.FC<RightRailProps> = ({
  activeId,
  onOpen,
  semanticHits,
  semanticState,
  semanticQuery
}) => {
  const [tab, setTab] = useState<'links' | 'related' | 'semantic' | 'agents'>('links');
  const note = activeId ? GKS_SERVICE.NOTE_BY_ID[activeId] : null;

  const out = note ? [...(GKS_SERVICE.D.adj[note.id]?.out || [])] : [];
  const ins = note ? [...(GKS_SERVICE.D.adj[note.id]?.in || [])] : [];
  
  const related = note ? GKS_SERVICE.D.notes
    .filter(n => n.id !== note.id)
    .map(n => ({ n, s: GKS_SERVICE.similarity(note.id, n.id) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8) : [];

  return (
    <aside className="rail">
      <div className="rail-tabs">
        <button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}>Links</button>
        <button className={tab === "related" ? "active" : ""} onClick={() => setTab("related")}>Related</button>
        <button className={tab === "semantic" ? "active" : ""} onClick={() => setTab("semantic")}>Semantic</button>
        <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>Agents</button>
      </div>
      <div className="rail-body scroll-thin">
        {tab === "links" && note && (
          <>
            <div className="panel-title">↳ Outbound · {out.length}</div>
            {out.length === 0 && <div className="empty">No outbound links</div>}
            {out.map(id => <RefCard key={id} id={id} kind="out" onOpen={onOpen} />)}
            <div className="panel-title" style={{ marginTop: 18 }}>↰ Backlinks · {ins.length}</div>
            {ins.length === 0 && <div className="empty">No backlinks yet</div>}
            {ins.map(id => <RefCard key={id} id={id} kind="in" onOpen={onOpen} sourceId={note.id} />)}
          </>
        )}
        {tab === "links" && !note && <div className="empty">Open a note to see its links</div>}

        {tab === "related" && note && (
          <>
            <div className="panel-title">Related notes (by embedding sim)</div>
            {related.map(({ n, s }) => <RefCard key={n.id} id={n.id} score={s} onOpen={onOpen} />)}
          </>
        )}
        {tab === "related" && !note && <div className="empty">Open a note to see related</div>}

        {tab === "semantic" && (
          <SemanticPanel hits={semanticHits} state={semanticState} query={semanticQuery} onOpen={onOpen} />
        )}
        {tab === "agents" && <div className="empty">MCP Agents Panel Coming Soon</div>}
      </div>
    </aside>
  );
};

interface SemanticPanelProps {
  hits: any[];
  state: 'idle' | 'loading' | 'done';
  query: string;
  onOpen: (id: string) => void;
}

const SemanticPanel: React.FC<SemanticPanelProps> = ({ hits, state, query, onOpen }) => {
  if (state === "idle" && (!hits || hits.length === 0)) {
    return (
      <div className="empty">
        Press <span className="kbd">⌘K</span> · Semantic mode<br />
        <span style={{ color: "var(--text-dim)" }}>or run a query from the top bar.</span>
      </div>
    );
  }
  return (
    <>
      <div className="panel-title">Query</div>
      <div style={{ padding: "8px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
        {query || "—"}
      </div>
      <div className="panel-title">
        Top matches {state === "loading" && <span className="spin" style={{ verticalAlign: "middle", marginLeft: 6 }} />}
      </div>
      {(hits || []).map(h => <RefCard key={h.id} id={h.id} score={h.score} onOpen={onOpen} />)}
      {state === "done" && (!hits || hits.length === 0) && <div className="empty">No matches above threshold.</div>}
    </>
  );
};
