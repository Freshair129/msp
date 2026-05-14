import React, { useState } from 'react';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  model: string;
  setModel: (m: string) => void;
  embedModel: string;
  setEmbedModel: (m: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  open, onClose, model, setModel, embedModel, setEmbedModel 
}) => {
  const [section, setSection] = useState("model");
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
          <button className={section === "model" ? "active" : ""} onClick={() => setSection("model")}>LLM Model</button>
          <button className={section === "embed" ? "active" : ""} onClick={() => setSection("embed")}>Embeddings</button>
          <button className={section === "appearance" ? "active" : ""} onClick={() => setSection("appearance")}>Appearance</button>
          <button className={section === "indexing" ? "active" : ""} onClick={() => setSection("indexing")}>Indexing</button>
          <button className={section === "about" ? "active" : ""} onClick={() => setSection("about")}>About</button>
        </div>
        <div className="settings-main scroll-thin">
          {section === "model" && (
            <>
              <h2>LLM model</h2>
              <p className="sub">Used for chat and semantic search re-ranking.</p>
              {MODELS.map(m => (
                <div key={m.id} className={"model-card" + (model === m.id ? " sel" : "")} onClick={() => setModel(m.id)}>
                  <div style={{ 
                    width: 12, height: 12, borderRadius: "50%", 
                    background: model === m.id ? "var(--accent)" : "var(--bg-3)", 
                    boxShadow: model === m.id ? "0 0 8px var(--accent)" : "none" 
                  }}/>
                  <div>
                    <div className="name">{m.name}</div>
                    <div className="desc">{m.desc}</div>
                  </div>
                  <div className="meta">{m.meta}</div>
                </div>
              ))}
            </>
          )}
          {section === "embed" && (
            <>
              <h2>Embedding model</h2>
              <p className="sub">Used to build the semantic index of your notes.</p>
              {EMBEDS.map(m => (
                <div key={m.id} className={"model-card" + (embedModel === m.id ? " sel" : "")} onClick={() => setEmbedModel(m.id)}>
                  <div style={{ 
                    width: 12, height: 12, borderRadius: "50%", 
                    background: embedModel === m.id ? "var(--accent)" : "var(--bg-3)", 
                    boxShadow: embedModel === m.id ? "0 0 8px var(--accent)" : "none" 
                  }}/>
                  <div>
                    <div className="name">{m.name}</div>
                    <div className="desc">{m.desc}</div>
                  </div>
                  <div className="meta">{m.meta}</div>
                </div>
              ))}
            </>
          )}
          {section === "about" && (
            <>
              <h2>Genesis Knowledge System</h2>
              <p className="sub">v0.4.2 · build 2026.05.13</p>
              <p style={{ color: "var(--text-mute)", lineHeight: 1.7 }}>
                A second brain with a real graph. Notes are markdown with <code>[[wikilinks]]</code>.
                Cross-references are computed on save. All inference can run local or via Claude.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
