// Genesis — shared helpers and primitives
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, Fragment } = React;

const TYPE_META = {
  ENTITY:  { color: "var(--c-entity)",  raw: "#4dd6e8", label: "ENTITY"  },
  FEAT:    { color: "var(--c-feat)",    raw: "#a78bfa", label: "FEATURE" },
  FLOW:    { color: "var(--c-flow)",    raw: "#f472b6", label: "FLOW"    },
  CONCEPT: { color: "var(--c-concept)", raw: "#fbbf24", label: "CONCEPT" },
  MOC:     { color: "var(--c-moc)",     raw: "#4ade80", label: "MOC"     },
};

const D = window.GKS_DATA;
const NOTE_BY_ID = Object.fromEntries(D.notes.map(n => [n.id, n]));

function snippet(text, len = 110) {
  const flat = text.replace(/^#.*$/gm, "").replace(/\[\[([^\]|]+)\]\]/g, "$1").replace(/\s+/g, " ").trim();
  return flat.length > len ? flat.slice(0, len) + "…" : flat;
}

// Render a markdown-ish note body to React nodes, turning [[wikilinks]] into clickable spans
function renderBody(body, onOpen) {
  const lines = body.split(/\n/);
  const out = [];
  let i = 0;
  let listBuf = null;
  const flushList = () => {
    if (!listBuf) return;
    out.push(<ul key={"u"+out.length}>{listBuf.map((li, k) => <li key={k}>{renderInline(li, onOpen)}</li>)}</ul>);
    listBuf = null;
  };
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (/^# /.test(line)) {
      flushList();
      // handled by parent (frontmatter renders the title); skip
    } else if (/^## /.test(line)) {
      flushList();
      out.push(<h2 key={"h"+i}>{line.slice(3)}</h2>);
    } else if (/^>\s?/.test(line)) {
      flushList();
      out.push(<blockquote key={"q"+i}>{renderInline(line.replace(/^>\s?/,""), onOpen)}</blockquote>);
    } else if (/^[-*]\s+/.test(line)) {
      if (!listBuf) listBuf = [];
      listBuf.push(line.replace(/^[-*]\s+/,""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(<p key={"p"+i}>{renderInline(line, onOpen)}</p>);
    }
    i++;
  }
  flushList();
  return out;
}

function renderInline(text, onOpen) {
  const parts = [];
  const re = /\[\[([A-Z]+--[a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const id = m[1];
    const label = m[2] || (NOTE_BY_ID[id]?.title ?? id);
    const dead = !NOTE_BY_ID[id];
    parts.push(
      <span key={m.index}
            className={"wikilink" + (dead ? " dead" : "")}
            onClick={(e) => { e.stopPropagation(); if (!dead) onOpen?.(id); }}>
        {label}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function typeDot(type, size = 8, glow = true) {
  const c = TYPE_META[type]?.color || "var(--text-dim)";
  return <span className="dot" style={{ background: c, boxShadow: glow ? `0 0 8px ${c}` : "none", width: size, height: size }} />;
}

// Cosine similarity for simple "embedding"-like search (deterministic, used as fallback)
// Build a sparse bag of terms from note tags + title + body
function bagFor(note) {
  const txt = (note.title + " " + note.tags.join(" ") + " " + note.body)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const counts = {};
  txt.split(/\s+/).forEach(w => { if (w && w.length > 2) counts[w] = (counts[w]||0)+1; });
  return counts;
}
const NOTE_BAGS = Object.fromEntries(D.notes.map(n => [n.id, bagFor(n)]));

function bagCosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const k in a) { na += a[k]*a[k]; if (b[k]) dot += a[k]*b[k]; }
  for (const k in b) { nb += b[k]*b[k]; }
  return dot / (Math.sqrt(na)*Math.sqrt(nb) || 1);
}

function searchScore(query, note) {
  if (!query.trim()) return 0;
  const q = bagFor({ title: query, tags: [], body: query });
  const cos = bagCosine(q, NOTE_BAGS[note.id]);
  const titleHit = note.title.toLowerCase().includes(query.toLowerCase()) ? 0.25 : 0;
  return Math.min(1, cos * 1.8 + titleHit);
}

window.GKS = {
  TYPE_META, D, NOTE_BY_ID, snippet, renderBody, renderInline, typeDot,
  NOTE_BAGS, bagFor, bagCosine, searchScore,
};
