import React, { useState } from 'react';
import { Icon } from '../shared/Icon';

interface TopbarSearchProps {
  onSubmit: (query: string) => void;
}

export const TopbarSearch: React.FC<TopbarSearchProps> = ({ onSubmit }) => {
  const [q, setQ] = useState("");
  const [, setFocused] = useState(false);

  return (
    <div className="tb-search-trigger" style={{ paddingLeft: 0, paddingRight: 8 }}>
      <span style={{ paddingLeft: 10 }}><Icon name="search" /></span>
      <input 
        id="topbar-search"
        name="q"
        style={{ background: "transparent", border: 0, outline: 0, color: "var(--text)", flex: 1, height: 28, fontSize: 12 }}
        placeholder="Semantic search · ask anything"
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => {
          if (e.key === "Enter" && q.trim()) { onSubmit(q.trim()); }
        }} 
      />
      <span className="kbd">⌘K</span>
    </div>
  );
};
