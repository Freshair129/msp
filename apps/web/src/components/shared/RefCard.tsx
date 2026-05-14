import React from 'react';
import { GKS_SERVICE } from '../../services/gksService';
import { TypeDot } from './TypeDot';

interface RefCardProps {
  id: string;
  kind?: 'in' | 'out';
  score?: number;
  sourceId?: string;
  onOpen?: (id: string) => void;
}

export const RefCard: React.FC<RefCardProps> = ({ id, kind, score, sourceId, onOpen }) => {
  const n = GKS_SERVICE.NOTE_BY_ID[id];
  if (!n) return null;
  const meta = GKS_SERVICE.TYPE_META[n.type] || { raw: "#6b7390", label: n.type || "UNKNOWN" };

  // when showing a backlink, find the line in the source that mentions this id
  let snip = GKS_SERVICE.snippet(n.body);
  if (kind === "in" && sourceId) {
    const src = GKS_SERVICE.NOTE_BY_ID[id];
    const lines = src.body.split("\n").filter(l => l.includes(`[[${sourceId}]]`));
    if (lines[0]) snip = lines[0].replace(/^[#>\-\s]+/, "").trim();
  }

  return (
    <div className="ref-card" onClick={() => onOpen?.(id)}>
      <div className="ref-title">
        <TypeDot type={n.type} glow={true} />
        {n.title}
      </div>
      <div className="ref-meta">
        <span style={{ color: meta.raw }}>{meta.label}</span>
        <span>·</span>
        <span>{n.id}</span>
        {typeof score === "number" && (
          <>
            <span style={{ flex: 1 }} />
            <div className="sim-bar">
              <span style={{ width: (score * 100).toFixed(0) + "%" }} />
            </div>
            <span>{(score * 100).toFixed(0)}%</span>
          </>
        )}
      </div>
      <div className="ref-snippet">{GKS_SERVICE.renderInline(snip, onOpen)}</div>
    </div>
  );
};
