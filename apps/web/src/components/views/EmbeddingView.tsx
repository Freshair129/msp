import React from 'react';
import type { Note, NoteType } from '../../types/gks';
import { TypeDot } from '../shared/TypeDot';
import { GKS_SERVICE } from '../../services/gksService';

interface EmbeddingViewProps {
  notes: Note[];
  focusId: string | null;
  onOpen?: (id: string) => void;
}

export const EmbeddingView: React.FC<EmbeddingViewProps> = ({ notes, focusId, onOpen }) => {
  return (
    <div className="embed-view">
      <div className="embed-canvas">
        <svg viewBox="-350 -350 700 700" preserveAspectRatio="xMidYMid meet">
          {/* Background grid */}
          <circle cx="0" cy="0" r="300" fill="none" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="-300" y1="0" x2="300" y2="0" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="-300" x2="0" y2="300" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />

          {/* Clusters */}
          {notes.map(n => {
            const [x, y] = n.embed || [0, 0];
            const meta = GKS_SERVICE.TYPE_META[n.type as NoteType] || { raw: "#6b7390" };
            const isFocus = n.id === focusId;
            return (
              <g 
                key={n.id} 
                className={"embed-node" + (isFocus ? " focus" : "")}
                onClick={() => onOpen?.(n.id)}
              >
                <circle 
                  cx={x} cy={y} r={isFocus ? 6 : 3} 
                  fill={meta.raw} 
                  style={{ filter: `drop-shadow(0 0 6px ${meta.raw})` }} 
                />
                {(isFocus || notes.length < 20) && (
                  <text 
                    x={x} y={y + 12} 
                    textAnchor="middle" 
                    fontSize="10" 
                    fill="var(--text-dim)"
                  >
                    {n.title}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="embed-overlay">
        <h4>Semantic projection</h4>
        <p className="sub">2D cluster map based on tag overlap and type anchoring.</p>
        <div className="legend">
          {Object.entries(GKS_SERVICE.TYPE_META).map(([t, m]) => (
            <div key={t} className="legend-item">
              <TypeDot type={t as NoteType} size={6} />
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
