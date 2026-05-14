import React, { useState, useRef, useEffect } from 'react';
import { GKS_SERVICE } from '../../services/gksService';

interface Message {
  who: 'user' | 'bot';
  text: string;
  sources?: string[];
}

interface ChatProps {
  activeId: string | null;
  onOpen: (id: string) => void;
  model: string;
}

export const Chat: React.FC<ChatProps> = ({ onOpen, model }) => {
  const [messages, setMessages] = useState<Message[]>([
    { who: "bot",
      text: "Ask me anything about your knowledge base. I'll pull cited notes from the graph and synthesize.",
      sources: [] }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const q = input.trim(); if (!q || busy) return;
    setInput("");
    setBusy(true);
    
    // Simulating retrieval
    const ranked = GKS_SERVICE.D.notes
      .map(n => ({ n, s: GKS_SERVICE.searchScore(q, n) }))
      .sort((a,b) => b.s - a.s)
      .slice(0, 5);

    setMessages(m => [...m, { who: "user", text: q }]);

    // Simulated delay for "AI" response
    setTimeout(() => {
      setMessages(m => [...m, { 
        who: "bot", 
        text: `Based on your notes, here is the synthesis of "${q}". You might want to check the linked references for more details.`, 
        sources: ranked.filter(r => r.s > 0.1).map(r => r.n.id) 
      }]);
      setBusy(false);
    }, 1500);
  };

  return (
    <div className="chat">
      <div className="chat-stream scroll-thin" ref={streamRef}>
        {messages.map((m, i) => (
          <div key={i} className={"msg " + m.who}>
            <div className="who">{m.who === "user" ? "you" : "genesis · " + (model || "haiku")}</div>
            <div className="bubble">{GKS_SERVICE.renderInline(m.text, onOpen)}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                {m.sources.map(s => {
                  const n = GKS_SERVICE.NOTE_BY_ID[s]; if (!n) return null;
                  const meta = GKS_SERVICE.TYPE_META[n.type] || { raw: "#6b7390" };
                  return (
                    <span key={s} className="src-chip" onClick={() => onOpen(s)}>
                      <span className="dot" style={{ background: meta.raw, boxShadow: `0 0 4px ${meta.raw}44` }}/>
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
        <textarea 
          placeholder="Ask anything · context will be pulled from your notes"
          value={input}
          rows={2}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={busy || !input.trim()}>
          {busy ? <span className="spin"/> : "Send ↵"}
        </button>
      </div>
    </div>
  );
};
