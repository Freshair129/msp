import React, { useState, useMemo, useCallback } from 'react';
import { GKS_SERVICE } from '../../services/gksService';
import { Icon } from '../shared/Icon';
import { TypeDot } from '../shared/TypeDot';
import type { Note } from '../../types/gks';

interface SidebarProps {
  activeId: string | null;
  onOpen: (id: string) => void;
  activeTags: string[];
  toggleTag: (tag: string) => void;
  mode: 'files' | 'tags' | 'daily';
  setMode: (mode: 'files' | 'tags' | 'daily') => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  onOpen,
  activeTags,
  toggleTag,
  mode,
  setMode,
  onOpenSettings
}) => {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "src": true, "adr": true, "concept": true });
  const notes = GKS_SERVICE.D.notes;

  const toggleFolder = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Build tree structure
  const tree = useMemo(() => {
    const root: any = { children: {}, files: [] };
    const q = filter.toLowerCase();

    notes.forEach(n => {
      if (q && !n.title.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q)) return;
      
      const p = n.path || "root/" + n.id;
      const parts = p.split(/[\\/]/);
      let curr = root;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const folder = parts[i];
        if (!curr.children[folder]) curr.children[folder] = { children: {}, files: [] };
        curr = curr.children[folder];
      }
      curr.files.push(n);
    });
    return root;
  }, [notes, filter]);

  const renderTree = useCallback((node: any, path: string = "", depth: number = 0) => {
    const folders = Object.keys(node.children).sort();
    const files = node.files.sort((a: any, b: any) => a.title.localeCompare(b.title));

    return (
      <>
        {folders.map(f => {
          const fullPath = path ? `${path}/${f}` : f;
          const isExp = expanded[fullPath];
          return (
            <div key={fullPath} className="tree-group">
              <div 
                className="tree-item folder" 
                style={{ paddingLeft: depth * 12 + 8 }}
                onClick={() => toggleFolder(fullPath)}
              >
                <span className={`chev ${isExp ? "open" : ""}`}>▸</span>
                <Icon name="folder" />
                <span className="label">{f}</span>
              </div>
              {isExp && renderTree(node.children[f], fullPath, depth + 1)}
            </div>
          );
        })}
        {files.map((n: Note) => (
          <div 
            key={n.id}
            className={"tree-item" + (n.id === activeId ? " active" : "")}
            style={{ paddingLeft: depth * 12 + 24 }}
            onClick={() => onOpen(n.id)}
          >
            <TypeDot type={n.type} size={6} />
            <span className="label">{n.title}</span>
            <span className="meta">{GKS_SERVICE.D.adj[n.id]?.out?.size || 0}</span>
          </div>
        ))}
      </>
    );
  }, [expanded, activeId, onOpen]);

  return (
    <aside className="sidebar">
      <div className="sb-nav">
        <button className={mode === "files" ? "active" : ""} onClick={() => setMode("files")} title="Files">
          <Icon name="folder" />
        </button>
        <button className={mode === "tags" ? "active" : ""} onClick={() => setMode("tags")} title="Tags">
          <Icon name="hash" />
        </button>
        <button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")} title="Daily">
          <Icon name="calendar" />
        </button>
        <button onClick={onOpenSettings} title="Settings">
          <Icon name="settings" />
        </button>
      </div>
      <div className="sb-search">
        <input 
          placeholder={mode === "tags" ? "Filter tags…" : "Filter files…"}
          value={filter} 
          onChange={e => setFilter(e.target.value)} 
        />
      </div>
      <div className="sb-body scroll-thin">
        {mode === "files" && (
          <div className="tree-view">
            {renderTree(tree)}
          </div>
        )}
        {mode === "tags" && (
          <>
            <div className="sb-section"><span>All tags</span><span className="count">{GKS_SERVICE.D.tags.length}</span></div>
            {GKS_SERVICE.D.tags
              .filter(([t]) => !filter || t.includes(filter.toLowerCase()))
              .map(([t, c]) => (
                <div 
                  key={t}
                  className={"tag-item" + (activeTags.includes(t) ? " active" : "")}
                  onClick={() => toggleTag(t)}
                >
                  <span className="hash">#</span>{t}
                  <span className="count">{c}</span>
                </div>
              ))}
          </>
        )}
        {mode === "daily" && (
          <>
            <div className="sb-section"><span>Recent days</span><span className="count">{GKS_SERVICE.D.daily.length}</span></div>
            {GKS_SERVICE.D.daily.map(d => (
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
};
