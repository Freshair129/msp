import React from 'react';
import type { Note, NoteType } from '../../types/gks';
import { GKS_SERVICE } from '../../services/gksService';

interface EditorProps {
  note: Note | null;
  onOpen: (id: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ note, onOpen }) => {
  if (!note) return <div className="empty" style={{ marginTop: 100 }}>Select a note from the sidebar.</div>;
  const meta = GKS_SERVICE.TYPE_META[note.type as NoteType] || { raw: "#6b7390", label: note.type || "UNKNOWN" };

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
        <span className="fm-chip">links-out <b>{GKS_SERVICE.D.adj[note.id]?.out?.size || 0}</b></span>
        <span className="fm-chip">links-in <b>{GKS_SERVICE.D.adj[note.id]?.in?.size || 0}</b></span>
        {note.tags.map((t: string) => <span key={t} className="fm-chip" style={{ color: "var(--text-mute)" }}>#{t}</span>)}
      </div>
      {GKS_SERVICE.renderBody(note.body, onOpen)}
    </div>
  );
};
