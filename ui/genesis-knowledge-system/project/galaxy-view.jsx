// Genesis — Galaxy Knowledge Cosmos View
// Spiral-arm particle galaxy: knowledge nodes are glowing stars embedded in the galaxy body.
// Canvas 2D + manual 3D perspective projection (same camera model as graph-3d.jsx).
// Controls: drag to orbit · scroll to zoom · click a star to fly there · auto-orbit toggle.

function GalaxyView({ notes, edges, focusId, onOpen }) {
  const wrapRef   = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const [hover,   setHover]   = React.useState(null);
  const [pinned,  setPinned]  = React.useState(null); // currently focused node id
  const [params,  setParams]  = React.useState({
    autoRotate:    true,
    speed:         0.35,
    showParticles: true,
    showLabels:    true,
  });

  // ── Camera (live / target) ──────────────────────────────────────────────────
  const cam    = React.useRef({ yaw: 0.3,  pitch: -0.42, dist: 950 });
  const camTgt = React.useRef({ yaw: 0.3,  pitch: -0.42, dist: 950 });
  const lookAt    = React.useRef({ x: 0, y: 0, z: 0 });
  const lookAtTgt = React.useRef({ x: 0, y: 0, z: 0 });

  // ── Galaxy data (built once per notes/edges change) ─────────────────────────
  const dataRef = React.useRef(null);

  React.useEffect(() => {
    // Ring radii and arm-bias per node type
    const TYPE_RING = {
      MOC:     { rMin:   0, rMax:  55, armBias: 0   },
      CONCEPT: { rMin:  45, rMax: 130, armBias: 0.5 },
      FEAT:    { rMin: 100, rMax: 210, armBias: 1   },
      FLOW:    { rMin: 150, rMax: 270, armBias: 2   },
      ENTITY:  { rMin: 200, rMax: 370, armBias: 0.5 },
    };

    function hash(s) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }

    const nodeMap = {};
    const ARM_COUNT = 3;

    const knodes = notes.map(n => {
      const ring = TYPE_RING[n.type] || TYPE_RING.ENTITY;
      const h1 = hash(n.id);
      const h2 = hash(n.id + "_arm");
      const h3 = hash(n.id + "_y");

      const radius   = ring.rMin + (h1 % 10000) / 10000 * (ring.rMax - ring.rMin);
      const armIdx   = (h2 % ARM_COUNT + Math.floor(ring.armBias)) % ARM_COUNT;
      const baseAng  = (armIdx / ARM_COUNT) * Math.PI * 2;
      const spinAng  = baseAng + radius * 0.013 + ((h2 % 1000) / 1000 - 0.5) * 0.8;
      const scatter  = ((h1 % 1000) / 1000 - 0.5) * radius * 0.22;

      const x = Math.cos(spinAng) * radius + scatter;
      const z = Math.sin(spinAng) * radius + scatter;
      const y = ((h3 % 1000) / 1000 - 0.5) * (7 + radius * 0.014);

      const nd = { id: n.id, type: n.type, title: n.title, x, y, z, deg: 0, radius };
      nodeMap[n.id] = nd;
      return nd;
    });

    // degree count
    edges.forEach(e => {
      if (nodeMap[e.source]) nodeMap[e.source].deg++;
      if (nodeMap[e.target]) nodeMap[e.target].deg++;
    });

    const klinks = edges.filter(e => nodeMap[e.source] && nodeMap[e.target]);

    // ── Background particle galaxy ──────────────────────────────────────────
    const PART_N = 11000;
    const particles = [];
    const rng = (() => { let s = 0x9e3779b9; return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; })();

    for (let i = 0; i < PART_N; i++) {
      const arm    = i % ARM_COUNT;
      const rFrac  = Math.pow(rng(), 0.5);          // denser toward center
      const radius = rFrac * 400;
      const baseA  = (arm / ARM_COUNT) * Math.PI * 2;
      const spinA  = baseA + radius * 0.013 + (rng() - 0.5) * 2.0;
      const scat   = (rng() - 0.5) * radius * 0.28;
      const x = Math.cos(spinA) * radius + scat;
      const z = Math.sin(spinA) * radius + scat;
      const y = (rng() - 0.5) * (5 + radius * 0.014);

      // warm core (orange/yellow), cooler arms (pink/purple)
      const t   = rFrac;
      const col = {
        r: Math.round(255 * (1 - t * 0.25)),
        g: Math.round(160 * (1 - t * 0.65) + t * 30),
        b: Math.round(60  + t * 140),
      };
      const alpha = 0.25 + rng() * 0.5;
      const sz    = 0.4 + rng() * (radius < 80 ? 1.6 : 0.9);
      particles.push({ x, y, z, ...col, alpha, sz });
    }

    dataRef.current = { knodes, klinks, nodeMap, particles };
  }, [notes, edges]);

  // ── Resize observer ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    const ro = new ResizeObserver(es => {
      for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // ── 3D projection (identical to graph-3d.jsx) ────────────────────────────────
  const project = (x, y, z) => {
    const c = cam.current, la = lookAt.current;
    x -= la.x; y -= la.y; z -= la.z;
    const cy_ = Math.cos(c.yaw),  sy_ = Math.sin(c.yaw);
    const x1  =  cy_*x + sy_*z;
    const z1  = -sy_*x + cy_*z;
    const cp  = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const y2  = cp*y - sp*z1;
    const z2  = sp*y + cp*z1;
    const zEye = z2 + c.dist;
    if (zEye <= 1) return null;
    const s = 700 / zEye;
    return { sx: x1*s, sy: y2*s, depth: zEye, scale: s };
  };

  // ── Pick ────────────────────────────────────────────────────────────────────
  const pickNode = (mx, my) => {
    const data = dataRef.current; if (!data) return null;
    const cx = size.w/2, cy_ = size.h/2;
    let best = null, bestD = Infinity;
    for (const n of data.knodes) {
      const p = project(n.x, n.y, n.z); if (!p) continue;
      const x = cx + p.sx, y = cy_ + p.sy;
      const r = Math.max(5, (4 + Math.sqrt(n.deg)*1.5) * p.scale);
      const dx = mx-x, dy = my-y;
      if (dx*dx+dy*dy < (r+10)*(r+10) && p.depth < bestD) { best = n; bestD = p.depth; }
    }
    return best;
  };

  // ── Mouse / touch handlers ───────────────────────────────────────────────────
  const drag = React.useRef({ down: false, lx: 0, ly: 0 });

  const onMouseDown = e => { drag.current = { down: true, lx: e.clientX, ly: e.clientY }; };
  const onMouseMove = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (drag.current.down) {
      const dx = e.clientX - drag.current.lx, dy = e.clientY - drag.current.ly;
      camTgt.current.yaw   += dx * 0.005;
      camTgt.current.pitch += dy * 0.005;
      camTgt.current.pitch = Math.max(-1.45, Math.min(0.05, camTgt.current.pitch));
      drag.current.lx = e.clientX; drag.current.ly = e.clientY;
      setParams(p => p.autoRotate ? { ...p, autoRotate: false } : p);
      setHover(null);
    } else {
      const hit = pickNode(mx, my);
      setHover(hit ? { id: hit.id, x: mx, y: my } : null);
    }
  };
  const onMouseUp = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const moved = Math.abs(e.clientX - drag.current.lx) > 4 || Math.abs(e.clientY - drag.current.ly) > 4;
    drag.current.down = false;
    if (!moved) {
      const hit = pickNode(mx, my);
      if (hit) {
        setPinned(hit.id);
        lookAtTgt.current  = { x: hit.x, y: hit.y, z: hit.z };
        camTgt.current.dist = 200;
        onOpen?.(hit.id);
      }
    }
  };
  const onWheel = e => {
    e.preventDefault();
    camTgt.current.dist = Math.max(100, Math.min(2200, camTgt.current.dist * Math.exp(e.deltaY * 0.001)));
  };

  // ── Animation + draw loop ────────────────────────────────────────────────────
  React.useEffect(() => {
    let raf, t0 = performance.now(), time = 0;
    const tick = now => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now; time += dt;

      if (params.autoRotate) camTgt.current.yaw += dt * 0.06 * params.speed;

      // Lerp camera
      const c = cam.current, ct = camTgt.current;
      c.yaw   += (ct.yaw   - c.yaw)   * 0.08;
      c.pitch += (ct.pitch - c.pitch) * 0.08;
      c.dist  += (ct.dist  - c.dist)  * 0.08;
      const la = lookAt.current, lt = lookAtTgt.current;
      la.x += (lt.x - la.x) * 0.07;
      la.y += (lt.y - la.y) * 0.07;
      la.z += (lt.z - la.z) * 0.07;

      draw(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, params, focusId]);

  // ── Draw ─────────────────────────────────────────────────────────────────────
  const draw = time => {
    const canvas = canvasRef.current; if (!canvas) return;
    const data = dataRef.current;     if (!data)   return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr) { canvas.width = size.w * dpr; canvas.height = size.h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = size.w, H = size.h, CX = W/2, CY = H/2;

    // ── deep space background
    const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#05030a");
    bg.addColorStop(1, "#010106");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── distant star-field (cheap deterministic)
    for (let i = 0; i < 220; i++) {
      const sx  = (i * 1297 + 511) % W;
      const sy  = (i * 859  + 307) % H;
      const twi = 0.3 + Math.sin(time * 1.3 + i * 0.53) * 0.25;
      const sr  = i % 9 === 0 ? 1.4 : 0.6;
      ctx.fillStyle = `rgba(210,215,240,${twi * 0.55})`;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
    }

    // ── galaxy core glow
    const corePrj = project(0, 0, 0);
    if (corePrj) {
      const px = CX + corePrj.sx, py = CY + corePrj.sy;
      const gr = ctx.createRadialGradient(px, py, 0, px, py, 160 * corePrj.scale);
      gr.addColorStop(0,   "rgba(255,215,120,0.40)");
      gr.addColorStop(0.25,"rgba(255,100, 60,0.15)");
      gr.addColorStop(0.6, "rgba(120, 40,160,0.06)");
      gr.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(px, py, 160 * Math.max(0.5, corePrj.scale), 0, Math.PI*2);
      ctx.fill();
    }

    // ── background particle galaxy ────────────────────────────────────────────
    if (params.showParticles) {
      for (const p of data.particles) {
        const prj = project(p.x, p.y, p.z); if (!prj) continue;
        if (prj.depth > cam.current.dist + 600) continue;
        const px  = CX + prj.sx, py = CY + prj.sy;
        const df  = Math.max(0, Math.min(1, 1 - (prj.depth - 350) / 1400));
        const al  = p.alpha * df;
        if (al < 0.015) continue;
        const sz  = Math.max(0.3, p.sz * prj.scale * 0.75);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${al})`;
        ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI*2); ctx.fill();
      }
    }

    // ── neighbours for focus/pinned
    const pinN   = pinned ? data.nodeMap[pinned] : null;
    const nbrs   = new Set();
    if (pinN) {
      data.klinks.forEach(l => {
        if (l.source === pinN.id) nbrs.add(l.target);
        if (l.target === pinN.id) nbrs.add(l.source);
      });
    }

    // ── project all knowledge nodes
    const prjMap = new Map();
    for (const n of data.knodes) {
      const p = project(n.x, n.y, n.z);
      if (p) prjMap.set(n.id, p);
    }

    // ── edges (draw before nodes)
    for (const l of data.klinks) {
      const pa = prjMap.get(l.source), pb = prjMap.get(l.target);
      if (!pa || !pb) continue;
      const hot = pinN && (l.source === pinN.id || l.target === pinN.id);
      const dim = pinN && !hot;
      const ax = CX + pa.sx, ay = CY + pa.sy;
      const bx = CX + pb.sx, by = CY + pb.sy;
      const raw = window.GKS.TYPE_META[data.nodeMap[l.source]?.type]?.raw || "#888";
      const al  = dim ? 0.05 : (hot ? 0.75 : 0.18);
      ctx.strokeStyle = gxHexA(raw, al);
      ctx.lineWidth   = hot ? 1.6 : 0.7;
      const mx = (ax+bx)/2, my = (ay+by)/2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my - 8, bx, by);
      ctx.stroke();

      // signal pulse on hot edges
      if (hot) {
        const t2 = (time * 0.9) % 1, u = 1-t2;
        const sx = u*u*ax + 2*u*t2*mx + t2*t2*bx;
        const sy_ = u*u*ay + 2*u*t2*(my-8) + t2*t2*by;
        ctx.shadowColor = raw; ctx.shadowBlur = 8;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx, sy_, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // ── nodes (depth-sorted, far → near)
    const sorted = data.knodes
      .map(n => ({ n, p: prjMap.get(n.id) }))
      .filter(o => o.p)
      .sort((a, b) => b.p.depth - a.p.depth);

    for (const { n, p } of sorted) {
      const meta  = window.GKS.TYPE_META[n.type];
      const x = CX + p.sx, y = CY + p.sy;
      const isFocus = pinN && n.id === pinN.id;
      const isNbr   = pinN && nbrs.has(n.id);
      const dim     = pinN && !isFocus && !isNbr;
      const df      = Math.max(0.12, Math.min(1, 850 / p.depth));
      const al      = (dim ? 0.14 : 1) * df;
      const pulse   = 1 + Math.sin(time * 2.2 + n.radius * 0.012) * 0.13;
      const r       = Math.max(3, (3.5 + Math.sqrt(n.deg) * 1.6) * Math.max(0.3, p.scale));

      // outer star halo
      const haloR = r * (isFocus ? 8 : 5) * pulse;
      const halo  = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      halo.addColorStop(0,   gxHexA(meta.raw, 0.75 * al));
      halo.addColorStop(0.4, gxHexA(meta.raw, 0.18 * al));
      halo.addColorStop(1,   gxHexA(meta.raw, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(x, y, haloR, 0, Math.PI*2); ctx.fill();

      // diffraction spikes (for prominent stars)
      if ((isFocus || n.deg >= 4) && p.scale > 0.45) {
        ctx.save(); ctx.translate(x, y);
        ctx.strokeStyle = gxHexA(meta.raw, 0.55 * al);
        ctx.lineWidth = 0.9;
        const spikeLen = r * (isFocus ? 22 : 11) * pulse;
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * Math.PI + time * 0.08;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang)*r,         Math.sin(ang)*r);
          ctx.lineTo(Math.cos(ang)*spikeLen,   Math.sin(ang)*spikeLen);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang+Math.PI)*r,        Math.sin(ang+Math.PI)*r);
          ctx.lineTo(Math.cos(ang+Math.PI)*spikeLen, Math.sin(ang+Math.PI)*spikeLen);
          ctx.stroke();
        }
        ctx.restore();
      }

      // star core
      ctx.shadowColor = meta.raw;
      ctx.shadowBlur  = isFocus ? 28 : (isNbr ? 14 : 8);
      ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI*2);
      ctx.fillStyle = gxHexA(meta.raw, al);
      ctx.fill();
      // white-hot nucleus
      ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${0.92 * al})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // focus ring (animated)
      if (isFocus) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, r * 3.2 + Math.sin(time * 4) * 2, 0, Math.PI*2);
        ctx.stroke();
      }

      // label
      const showLabel = params.showLabels && p.scale > 0.45 &&
        (isFocus || isNbr || n.deg >= 5 || p.scale > 1.1);
      if (showLabel) {
        ctx.font = `${isFocus ? "600 " : ""}11px "Space Grotesk", system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = `rgba(230,232,240,${Math.min(1, al * 1.5)})`;
        ctx.fillText(n.title, x, y + r * pulse + 4);
      }
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="graph-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { drag.current.down = false; setHover(null); }}
        onWheel={onWheel}
      />

      {hover && (
        <div className="node-hover" style={{ left: hover.x, top: hover.y }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {window.GKS.typeDot(window.GKS.NOTE_BY_ID[hover.id]?.type)}
            <b>{window.GKS.NOTE_BY_ID[hover.id]?.title}</b>
          </div>
          <div style={{ color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:10, marginTop:2 }}>
            {hover.id}
          </div>
        </div>
      )}

      <div className="graph-overlay">
        <h4>Galaxy · Knowledge Cosmos</h4>
        <div style={{ color:"var(--text-mute)", fontSize:11, marginBottom:6 }}>
          drag to orbit · scroll to zoom · click star to focus
        </div>
        {Object.entries(window.GKS.TYPE_META).map(([t, m]) => (
          <div className="legend-row" key={t}>
            <span className="swatch" style={{ background: m.raw }}/>
            <span>{m.label}</span>
          </div>
        ))}
      </div>

      <div className="graph-controls">
        <div className="row">
          <label>Auto-orbit</label>
          <span className={"toggle" + (params.autoRotate ? " on" : "")}
                onClick={() => setParams(p => ({ ...p, autoRotate: !p.autoRotate }))}/>
        </div>
        <div className="row">
          <label>Speed</label>
          <input type="range" min="0" max="2" step="0.05" value={params.speed}
                 onChange={e => setParams(p => ({ ...p, speed: +e.target.value }))}/>
        </div>
        <div className="row">
          <label>Particles</label>
          <span className={"toggle" + (params.showParticles ? " on" : "")}
                onClick={() => setParams(p => ({ ...p, showParticles: !p.showParticles }))}/>
        </div>
        <div className="row">
          <label>Labels</label>
          <span className={"toggle" + (params.showLabels ? " on" : "")}
                onClick={() => setParams(p => ({ ...p, showLabels: !p.showLabels }))}/>
        </div>
        {pinned && (
          <div className="row">
            <button
              style={{ fontSize:11, color:"var(--text-mute)", padding:"2px 0", cursor:"pointer" }}
              onClick={() => {
                setPinned(null);
                lookAtTgt.current = { x:0, y:0, z:0 };
                camTgt.current.dist = 950;
              }}>
              ← Reset view
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gxHexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

window.GalaxyView = GalaxyView;
