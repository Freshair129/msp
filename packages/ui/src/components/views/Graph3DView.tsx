import React, { useRef, useState, useEffect } from 'react';
import type { Note, Edge, NoteType } from '../../types/gks';
import { NOTE_BY_ID } from '../../data/mockData';
import { GKS_SERVICE } from '../../services/gksService';
import { TypeDot } from '../shared/TypeDot';

interface Graph3DViewProps {
  notes: Note[];
  edges: Edge[];
  focusId: string | null;
  onOpen?: (id: string) => void;
}

interface SimNode extends Note {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  deg: number;
}

interface SimLink {
  source: string;
  target: string;
  phase: number;
}

export const Graph3DView: React.FC<Graph3DViewProps> = ({ notes, edges, focusId, onOpen }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ id: string, x: number, y: number } | null>(null);
  const [params, setParams] = useState({
    autoRotate: true, signals: true, neurites: true, depth: true, speed: 0.3,
  });

  // Camera state
  const camRef = useRef({ yaw: 0.6, pitch: -0.25, dist: 700, target: { x: 0, y: 0, z: 0 } });
  const simRef = useRef<{ 
    nodes: SimNode[], 
    links: SimLink[], 
    byNode: Record<string, SimNode> 
  } | null>(null);

  // Sim init
  useEffect(() => {
    const byId = Object.fromEntries(notes.map(n => [n.id, n]));
    const R = 280;
    const simNodes: SimNode[] = notes.map((n, i) => {
      const phi = Math.acos(1 - 2 * (i + 0.5) / notes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return {
        ...n,
        x: R * Math.sin(phi) * Math.cos(theta),
        y: R * Math.sin(phi) * Math.sin(theta),
        z: R * Math.cos(phi),
        vx: 0, vy: 0, vz: 0,
        deg: 0,
      };
    });
    const links: SimLink[] = edges
      .filter(e => byId[e.source] && byId[e.target])
      .map(e => ({ source: e.source, target: e.target, phase: Math.random() }));
    
    simNodes.forEach(n => { 
      n.deg = links.filter(l => l.source === n.id || l.target === n.id).length; 
    });
    
    simRef.current = { 
      nodes: simNodes, 
      links, 
      byNode: Object.fromEntries(simNodes.map(n => [n.id, n])) 
    };
  }, [notes, edges]);

  // Resize
  useEffect(() => {
    const ro = new ResizeObserver(es => { 
      for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); 
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Drag / Interaction
  const dragRef = useRef({ down: false, lx: 0, ly: 0 });
  
  const onMouseDown = (e: React.MouseEvent) => { 
    dragRef.current = { down: true, lx: e.clientX, ly: e.clientY }; 
  };
  
  const project = (x: number, y: number, z: number) => {
    const cam = camRef.current;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const x1 = cy * x + sy * z;
    const z1 = -sy * x + cy * z;
    const y1 = cp * y - sp * z1;
    const z2 = sp * y + cp * z1;
    const f = 700;
    const zEye = z2 + cam.dist;
    if (zEye <= 1) return null;
    const s = f / zEye;
    return { sx: x1 * s, sy: y1 * s, depth: zEye, scale: s };
  };

  const nodeR = (n: SimNode, scale: number) => Math.max(2.4, (3 + Math.sqrt(n.deg) * 1.4) * scale * 0.9);

  const pickNode = (mx: number, my: number) => {
    const sim = simRef.current; if (!sim) return null;
    const cx = size.w / 2, cy = size.h / 2;
    let best = null, bestD = Infinity;
    for (const n of sim.nodes) {
      const p = project(n.x, n.y, n.z); if (!p) continue;
      const x = cx + p.sx, y = cy + p.sy;
      const r = nodeR(n, p.scale);
      const dx = mx - x, dy = my - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < (r + 6) * (r + 6) && p.depth < bestD) { best = n; bestD = p.depth; }
    }
    return best;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (dragRef.current.down) {
      const dx = e.clientX - dragRef.current.lx;
      const dy = e.clientY - dragRef.current.ly;
      camRef.current.yaw += dx * 0.005;
      camRef.current.pitch += dy * 0.005;
      camRef.current.pitch = Math.max(-1.2, Math.min(1.2, camRef.current.pitch));
      dragRef.current.lx = e.clientX; dragRef.current.ly = e.clientY;
      setParams(p => p.autoRotate ? { ...p, autoRotate: false } : p);
      setHover(null);
    } else {
      const hit = pickNode(mx, my);
      setHover(hit ? { id: hit.id, x: mx, y: my } : null);
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const moved = Math.abs(e.clientX - dragRef.current.lx) > 4 || Math.abs(e.clientY - dragRef.current.ly) > 4;
    dragRef.current.down = false;
    if (!moved) {
      const hit = pickNode(mx, my);
      if (hit) onOpen?.(hit.id);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const factor = Math.exp(e.deltaY * 0.001);
    camRef.current.dist = Math.max(220, Math.min(1800, camRef.current.dist * factor));
  };

  // Animation & Draw Loop
  const alphaRef = useRef(1); // Simulation energy level

  useEffect(() => {
    let raf: number, t0 = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const sim = simRef.current;
      
      // Only run physics if there's energy (alpha > 0.01)
      if (sim && alphaRef.current > 0.01) {
        const nodes = sim.nodes, links = sim.links;
        const alpha = alphaRef.current;
        const REPEL = 1800 * alpha, LINK_K = 0.05 * alpha, LINK_D = 110, CENTER = 0.012 * alpha;
        
        // Repulsion (O(N^2)) - we can optimize by only repelling nodes with higher degree
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          // Optimization: skip repulsion for very far or low energy nodes
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            let d2 = dx * dx + dy * dy + dz * dz + 0.1;
            if (d2 > 600 * 600) continue; // Skip far nodes
            const d = Math.sqrt(d2);
            const f = REPEL / d2;
            const fx = (dx / d) * f, fy = (dy / d) * f, fz = (dz / d) * f;
            a.vx -= fx; a.vy -= fy; a.vz -= fz;
            b.vx += fx; b.vy += fy; b.vz += fz;
          }
        }
        
        // Links
        for (const l of links) {
          const a = sim.byNode[l.source], b = sim.byNode[l.target]; if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
          const diff = (d - LINK_D) * LINK_K;
          const fx = (dx / d) * diff, fy = (dy / d) * diff, fz = (dz / d) * diff;
          a.vx += fx; a.vy += fy; a.vz += fz;
          b.vx -= fx; b.vy -= fy; b.vz -= fz;
        }
        
        // Integration
        for (const n of nodes) {
          n.vx += -n.x * CENTER; n.vy += -n.y * CENTER; n.vz += -n.z * CENTER;
          n.vx *= 0.8; n.vy *= 0.8; n.vz *= 0.8;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;
        }
        
        // Cool down
        alphaRef.current *= 0.985;
      }

      if (sim) {
        if (params.signals) {
          for (const l of sim.links) {
            l.phase += dt * (0.35 + (Math.sin(l.phase * 3.0) + 1) * 0.18) * params.speed * 2;
            if (l.phase > 1) l.phase -= 1;
          }
        }
        if (params.autoRotate) camRef.current.yaw += dt * 0.08 * params.speed;
      }
      
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, params, focusId]);

  const hexA = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr) { canvas.width = size.w * dpr; canvas.height = size.h * dpr; }
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // BG
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, size.w, size.h);

    const sim = simRef.current; if (!sim) return;
    const cx = size.w / 2, cy = size.h / 2;

    const projMap = new Map();
    for (const n of sim.nodes) {
      const p = project(n.x, n.y, n.z);
      if (p) projMap.set(n.id, p);
    }

    const neighbors = new Set<string>();
    if (focusId) {
      sim.links.forEach(l => {
        if (l.source === focusId) neighbors.add(l.target);
        if (l.target === focusId) neighbors.add(l.source);
      });
    }

    // Edges
    const ordered = sim.links.map(l => {
      const pa = projMap.get(l.source), pb = projMap.get(l.target);
      if (!pa || !pb) return null;
      return { l, pa, pb, depth: (pa.depth + pb.depth) / 2 };
    }).filter((o): o is any => o !== null).sort((a, b) => b.depth - a.depth);

    for (const { l, pa, pb } of ordered) {
      const a = sim.byNode[l.source], b = sim.byNode[l.target];
      const meta_b = GKS_SERVICE.TYPE_META[b.type as NoteType] || { raw: "#6b7390" };
      const hot = focusId && (a.id === focusId || b.id === focusId);
      const dim = focusId && !hot;
      const ax = cx + pa.sx, ay = cy + pa.sy;
      const bx = cx + pb.sx, by = cy + pb.sy;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const offMag = 18 + Math.min(60, Math.hypot(bx - ax, by - ay) * 0.08);
      const perpx = -(by - ay), perpy = (bx - ax);
      const plen = Math.hypot(perpx, perpy) || 1;
      const cxm = mx + (perpx / plen) * offMag * 0.3;
      const cym = my + (perpy / plen) * offMag * 0.3;

      ctx.strokeStyle = `rgba(${hot ? "124,92,255" : "90,100,140"}, ${dim ? 0.10 : (hot ? 0.85 : 0.35)})`;
      ctx.lineWidth = hot ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cxm, cym, bx, by);
      ctx.stroke();

      if (params.signals && !dim) {
        const t = l.phase;
        const u = 1 - t;
        const px = u * u * ax + 2 * u * t * cxm + t * t * bx;
        const py = u * u * ay + 2 * u * t * cym + t * t * by;
        for (let k = 0; k < 5; k++) {
          const tt = Math.max(0, t - k * 0.04);
          const uu = 1 - tt;
          const tx = uu * uu * ax + 2 * uu * tt * cxm + tt * tt * bx;
          const ty = uu * uu * ay + 2 * uu * tt * cym + tt * tt * by;
          ctx.beginPath();
          ctx.arc(tx, ty, 1.6 - k * 0.18, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${(1 - k / 5) * (hot ? 0.95 : 0.55)})`;
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = meta_b.raw; ctx.fill();
      }
    }

    // Nodes
    const nodesByDepth = sim.nodes.map(n => ({ n, p: projMap.get(n.id) }))
      .filter(o => o.p)
      .sort((a, b) => b.p.depth - a.p.depth);

    for (const { n, p } of nodesByDepth) {
      const meta = GKS_SERVICE.TYPE_META[n.type as NoteType] || { raw: "#6b7390", label: n.type };
      const r = nodeR(n, p.scale);
      const x = cx + p.sx, y = cy + p.sy;
      const isFocus = focusId && n.id === focusId;
      const isNbr = focusId && neighbors.has(n.id);
      const dim = focusId && !isFocus && !isNbr;
      const depthFade = params.depth ? Math.max(0.25, Math.min(1, 800 / p.depth)) : 1;
      const alpha = (dim ? 0.18 : 1) * depthFade;

      // Draw node core
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexA(meta.raw, alpha); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.2})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw labels only for focus, neighbors, or very high degree nodes when zoomed in
      const shouldShowLabel = isFocus || isNbr || (p.scale > 0.8 && n.deg >= 15);

      if (shouldShowLabel) {
        ctx.font = `${isFocus ? "600 " : ""}10px "Inter"`;
        ctx.textAlign = "center"; 
        ctx.fillStyle = `rgba(220, 220, 220, ${alpha * (isFocus ? 1 : 0.7)})`;
        
        // Add a subtle dark backing for readability
        const txt = n.title;
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = `rgba(24, 24, 24, ${alpha * 0.8})`;
        ctx.fillRect(x - tw/2 - 4, y + r + 4, tw + 8, 14);
        
        ctx.fillStyle = `rgba(220, 220, 220, ${alpha})`;
        ctx.fillText(txt, x, y + r + 14);
      }
    }
  };

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <canvas 
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onWheel={onWheel}
      />
      {hover && (
        <div className="node-hover" style={{ left: hover.x, top: hover.y }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <TypeDot type={NOTE_BY_ID[hover.id]?.type as NoteType} />
            <b>{NOTE_BY_ID[hover.id]?.title}</b>
          </div>
          <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 2 }}>
            {hover.id}
          </div>
        </div>
      )}
      <div className="graph-overlay">
        <h4>Neural cortex · 3D</h4>
        {Object.entries(GKS_SERVICE.TYPE_META).map(([t, m]) => (
          <div className="legend-row" key={t}>
            <span className="swatch" style={{ background: m.raw }} />
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <div className="graph-controls">
        <div className="row">
          <label>Auto-orbit</label>
          <span className={"toggle" + (params.autoRotate ? " on" : "")}
                onClick={() => setParams(p => ({ ...p, autoRotate: !p.autoRotate }))} />
        </div>
        <div className="row">
          <label>Speed</label>
          <input type="range" min="0" max="2" step="0.05" value={params.speed}
                 onChange={e => setParams(p => ({ ...p, speed: +e.target.value }))} />
        </div>
        <div className="row">
          <label>Signals</label>
          <span className={"toggle" + (params.signals ? " on" : "")}
                onClick={() => setParams(p => ({ ...p, signals: !p.signals }))} />
        </div>
      </div>
    </div>
  );
};
