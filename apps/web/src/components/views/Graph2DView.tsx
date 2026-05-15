import React, { useRef, useState, useEffect } from 'react';
import type { Note, Edge, NoteType } from '../../types/gks';
import { GKS_SERVICE } from '../../services/gksService';

interface Graph2DViewProps {
  notes: Note[];
  edges: Edge[];
  focusId: string | null;
  onOpen?: (id: string) => void;
}

interface SimNode extends Note {
  x: number;
  y: number;
  vx: number;
  vy: number;
  deg: number;
}

interface SimLink {
  source: SimNode;
  target: SimNode;
}

export const Graph2DView: React.FC<Graph2DViewProps> = ({ notes, edges, focusId, onOpen }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [nodeSize, setNodeSize] = useState(1.0);

  // Simulation state
  const simRef = useRef<{ nodes: SimNode[]; links: SimLink[] }>({ nodes: [], links: [] });
  const transform = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef({ lx: 0, ly: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Initialize simulation
  useEffect(() => {
    const nodeMap = new Map<string, SimNode>();
    const simNodes: SimNode[] = notes.map(n => {
      const sn: SimNode = {
        ...n,
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        deg: 0,
      };
      nodeMap.set(n.id, sn);
      return sn;
    });

    const simLinks: SimLink[] = edges
      .map(e => {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (s && t) {
          s.deg++;
          t.deg++;
          return { source: s, target: t };
        }
        return null;
      })
      .filter((l): l is SimLink => !!l);

    simRef.current = { nodes: simNodes, links: simLinks };
  }, [notes, edges]);

  // Resize handler
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { nodes, links } = simRef.current;
    const { x, y, k } = transform.current;
    const CX = size.w / 2 + x, CY = size.h / 2 + y;

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, size.w, size.h);

    const neighbors = new Set<string>();
    if (focusId) {
      links.forEach(l => {
        if (l.source.id === focusId) neighbors.add(l.target.id);
        if (l.target.id === focusId) neighbors.add(l.source.id);
      });
    }

    // Edges
    for (const l of links) {
      const isFocus = focusId && (l.source.id === focusId || l.target.id === focusId);
      const isDim = focusId && !isFocus;
      ctx.strokeStyle = isFocus ? 'rgba(124, 92, 255, 0.8)' : `rgba(70, 75, 90, ${isDim ? 0.15 : 0.35})`;
      ctx.lineWidth = isFocus ? 1.5 : 0.75;
      ctx.beginPath();
      ctx.moveTo(CX + l.source.x * k, CY + l.source.y * k);
      ctx.lineTo(CX + l.target.x * k, CY + l.target.y * k);
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const isFocus = n.id === focusId;
      const isNbr = neighbors.has(n.id);
      const isDim = focusId && !isFocus && !isNbr;
      const r = Math.max(2, (3 + Math.sqrt(n.deg) * 1.5) * k * nodeSize);

      const meta = GKS_SERVICE.TYPE_META[n.type as NoteType] || { raw: '#6b7390' };
      
      ctx.beginPath();
      ctx.arc(CX + n.x * k, CY + n.y * k, r, 0, Math.PI * 2);
      ctx.fillStyle = meta.raw;
      ctx.globalAlpha = isDim ? 0.2 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isFocus || isNbr || (k > 1.2 && n.deg >= 10)) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `${isFocus ? '600' : '400'} 10px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(n.title, CX + n.x * k, CY + n.y * k + r + 12);
      }
    }
  }, [size, focusId, nodeSize]);

  // Animation Loop
  useEffect(() => {
    let raf: number;
    let alpha = 1.0; // Simulation energy

    const tick = () => {
      const { nodes, links } = simRef.current;
      if (!nodes.length) return;

      // Simulation Physics
      if (alpha > 0.01) {
        const repulsion = -150 * alpha;
        const linkForce = 0.045 * alpha;
        const centerForce = 0.008 * alpha;
        const friction = 0.82;

        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d2 = dx * dx + dy * dy + 0.1;
            if (d2 > 400 * 400) continue;
            const d = Math.sqrt(d2);
            const f = repulsion / d2;
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
          }
        }

        // Links
        for (const l of links) {
          const dx = l.target.x - l.source.x;
          const dy = l.target.y - l.source.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const f = (d - 100) * linkForce;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          l.source.vx += fx; l.source.vy += fy;
          l.target.vx -= fx; l.target.vy -= fy;
        }

        // Integration & Centering
        for (const n of nodes) {
          n.vx -= n.x * centerForce;
          n.vy -= n.y * centerForce;
          n.vx *= friction;
          n.vy *= friction;
          n.x += n.vx;
          n.y += n.vy;
        }

        alpha *= 0.992; // Cool down
      }

      draw();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, focusId, draw]);

  // Interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    drag.current = { lx: e.clientX, ly: e.clientY };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - drag.current.lx;
      const dy = e.clientY - drag.current.ly;
      transform.current.x += dx;
      transform.current.y += dy;
      drag.current.lx = e.clientX;
      drag.current.ly = e.clientY;
    } else {
      // Hover detection
      const canvas = canvasRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const { x, y, k } = transform.current;
      const CX = size.w / 2 + x, CY = size.h / 2 + y;

      let hit = null;
      for (const n of simRef.current.nodes) {
        const nx = CX + n.x * k, ny = CY + n.y * k;
        const r = Math.max(5, (3 + Math.sqrt(n.deg) * 1.5) * k);
        const dx = mx - nx, dy = my - ny;
        if (dx * dx + dy * dy < (r + 6) * (r + 6)) {
          hit = n; break;
        }
      }
      setHover(hit ? { id: hit.id, x: mx, y: my } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = Math.abs(e.clientX - drag.current.lx);
      const dy = Math.abs(e.clientY - drag.current.ly);
      if (dx < 4 && dy < 4) {
        // Was a click
        if (hover) onOpen?.(hover.id);
      }
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    transform.current.k = Math.max(0.1, Math.min(5, transform.current.k * delta));
  };

  return (
    <div className="graph-wrap" ref={wrapRef} style={{ background: '#111' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
      <div className="graph-overlay" style={{ pointerEvents: 'none' }}>
        <h4>Obsidian Style · 2D Force</h4>
        <div style={{ color: 'var(--text-mute)', fontSize: 11 }}>
          drag to pan · scroll to zoom · click to focus
        </div>
      </div>
      <div className="graph-controls">
        <div className="row">
          <label>Node size</label>
          <input type="range" min="0.3" max="3" step="0.1" value={nodeSize}
                 onChange={e => setNodeSize(+e.target.value)} />
        </div>
      </div>
      {hover && (
        <div className="node-hover" style={{ left: hover.x, top: hover.y }}>
          <b>{hover.id}</b>
        </div>
      )}
    </div>
  );
};
