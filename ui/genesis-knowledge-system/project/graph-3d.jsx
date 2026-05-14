// Genesis — 3D Brain-Neuron Graph View
// Force-directed graph in 3D with perspective projection on a 2D canvas.
// Neurons glow, edges are curved synapses with pulsing action-potential signals.

function Graph3DView({ notes, edges, focusId, onOpen }) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const [hover, setHover] = React.useState(null);
  const [params, setParams] = React.useState({
    autoRotate: true, signals: true, neurites: true, depth: true, speed: 0.3,
  });

  // Camera state
  const camRef = React.useRef({ yaw: 0.6, pitch: -0.25, dist: 700, target: { x:0, y:0, z:0 } });

  // Sim init
  const simRef = React.useRef(null);
  React.useEffect(() => {
    const byId = Object.fromEntries(notes.map(n => [n.id, n]));
    const R = 280;
    const nodes = notes.map((n, i) => {
      // Fibonacci sphere placement
      const phi = Math.acos(1 - 2*(i+0.5)/notes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return {
        id: n.id, type: n.type, title: n.title,
        x: R * Math.sin(phi)*Math.cos(theta),
        y: R * Math.sin(phi)*Math.sin(theta),
        z: R * Math.cos(phi),
        vx: 0, vy: 0, vz: 0,
        deg: 0,
      };
    });
    const links = edges.filter(e => byId[e.source] && byId[e.target])
      .map(e => ({ source: e.source, target: e.target, phase: Math.random() }));
    nodes.forEach(n => { n.deg = links.filter(l => l.source===n.id||l.target===n.id).length; });
    simRef.current = { nodes, links, byNode: Object.fromEntries(nodes.map(n => [n.id, n])) };
  }, [notes, edges]);

  // Resize
  React.useEffect(() => {
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Drag / zoom
  const dragRef = React.useRef({ down:false, lx:0, ly:0 });
  const onMouseDown = (e) => { dragRef.current = { down:true, lx:e.clientX, ly:e.clientY }; };
  const onMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (dragRef.current.down) {
      const dx = e.clientX - dragRef.current.lx;
      const dy = e.clientY - dragRef.current.ly;
      camRef.current.yaw   += dx * 0.005;
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
  const onMouseUp = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const moved = Math.abs(e.clientX - dragRef.current.lx) > 4 || Math.abs(e.clientY - dragRef.current.ly) > 4;
    dragRef.current.down = false;
    if (!moved) {
      const hit = pickNode(mx, my);
      if (hit) onOpen?.(hit.id);
    }
  };
  const onWheel = (e) => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.001);
    camRef.current.dist = Math.max(220, Math.min(1800, camRef.current.dist * factor));
  };

  // Project 3D -> 2D
  const project = (x, y, z) => {
    const cam = camRef.current;
    // rotate
    const cy = Math.cos(cam.yaw),  sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let x1 =  cy*x + sy*z;
    let z1 = -sy*x + cy*z;
    let y1 =  cp*y - sp*z1;
    let z2 =  sp*y + cp*z1;
    // perspective
    const f = 700;
    const zEye = z2 + cam.dist;
    if (zEye <= 1) return null;
    const s = f / zEye;
    return { sx: x1 * s, sy: y1 * s, depth: zEye, scale: s };
  };

  const pickNode = (mx, my) => {
    const sim = simRef.current; if (!sim) return null;
    const cx = size.w/2, cy = size.h/2;
    let best = null, bestD = Infinity;
    for (const n of sim.nodes) {
      const p = project(n.x, n.y, n.z); if (!p) continue;
      const x = cx + p.sx, y = cy + p.sy;
      const r = nodeR(n, p.scale);
      const dx = mx - x, dy = my - y;
      const d2 = dx*dx + dy*dy;
      if (d2 < (r+6)*(r+6) && p.depth < bestD) { best = n; bestD = p.depth; }
    }
    return best;
  };

  const nodeR = (n, scale) => Math.max(2.4, (3 + Math.sqrt(n.deg) * 1.4) * scale * 0.9);

  // Sim + animation
  React.useEffect(() => {
    let raf, t0 = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const sim = simRef.current;
      if (sim) {
        // 3D force sim
        const nodes = sim.nodes, links = sim.links;
        const REPEL = 2400, LINK_K = 0.05, LINK_D = 110, CENTER = 0.012;
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i+1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = b.x-a.x, dy = b.y-a.y, dz = b.z-a.z;
            let d2 = dx*dx + dy*dy + dz*dz + 0.01;
            const d = Math.sqrt(d2);
            const f = REPEL / d2;
            const fx = (dx/d)*f, fy = (dy/d)*f, fz = (dz/d)*f;
            a.vx -= fx; a.vy -= fy; a.vz -= fz;
            b.vx += fx; b.vy += fy; b.vz += fz;
          }
        }
        for (const l of links) {
          const a = sim.byNode[l.source], b = sim.byNode[l.target]; if (!a||!b) continue;
          const dx = b.x-a.x, dy = b.y-a.y, dz = b.z-a.z;
          const d = Math.sqrt(dx*dx+dy*dy+dz*dz) || 0.01;
          const diff = (d - LINK_D) * LINK_K;
          const fx = (dx/d)*diff, fy = (dy/d)*diff, fz = (dz/d)*diff;
          a.vx += fx; a.vy += fy; a.vz += fz;
          b.vx -= fx; b.vy -= fy; b.vz -= fz;
        }
        for (const n of nodes) {
          n.vx += -n.x * CENTER; n.vy += -n.y * CENTER; n.vz += -n.z * CENTER;
          n.vx *= 0.82; n.vy *= 0.82; n.vz *= 0.82;
          n.x += n.vx; n.y += n.vy; n.z += n.vz;
        }
        // advance signal phases
        if (params.signals) {
          for (const l of links) {
            l.phase += dt * (0.35 + (Math.sin(l.phase*3.0)+1)*0.18) * params.speed * 2;
            if (l.phase > 1) l.phase -= 1;
          }
        }
        if (params.autoRotate) camRef.current.yaw += dt * 0.12 * params.speed;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, params, focusId]);

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr) { canvas.width = size.w * dpr; canvas.height = size.h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background — deep nebula
    const g = ctx.createRadialGradient(size.w*0.5, size.h*0.5, 50, size.w*0.5, size.h*0.5, Math.max(size.w, size.h));
    g.addColorStop(0, "rgba(20,18,40,0.55)");
    g.addColorStop(0.6, "rgba(9,9,18,0.85)");
    g.addColorStop(1, "rgba(5,5,11,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size.w, size.h);

    // Starfield (cheap, deterministic)
    ctx.fillStyle = "rgba(180,190,220,0.5)";
    for (let i = 0; i < 120; i++) {
      const x = ((i*73 + size.w*0.37) % size.w);
      const y = ((i*131 + size.h*0.21) % size.h);
      const r = (i % 5 === 0) ? 1.2 : 0.5;
      ctx.fillRect(x, y, r, r);
    }

    const sim = simRef.current; if (!sim) return;
    const cx = size.w/2, cy = size.h/2;

    // Compute projections once
    const proj = new Map();
    for (const n of sim.nodes) {
      const p = project(n.x, n.y, n.z);
      if (p) proj.set(n.id, p);
    }

    const focus = focusId ? sim.byNode[focusId] : null;
    const neighbors = new Set();
    if (focus) {
      sim.links.forEach(l => {
        if (l.source===focus.id) neighbors.add(l.target);
        if (l.target===focus.id) neighbors.add(l.source);
      });
    }

    // Sort edges by avg depth (paint far first)
    const ordered = sim.links.map(l => {
      const pa = proj.get(l.source), pb = proj.get(l.target);
      if (!pa || !pb) return null;
      return { l, pa, pb, depth: (pa.depth + pb.depth) / 2 };
    }).filter(Boolean).sort((a,b) => b.depth - a.depth);

    // Edges as curved synapses
    for (const { l, pa, pb } of ordered) {
      const a = sim.byNode[l.source], b = sim.byNode[l.target];
      const meta_a = window.GKS.TYPE_META[a.type], meta_b = window.GKS.TYPE_META[b.type];
      const hot = focus && (a.id===focus.id || b.id===focus.id);
      const dim = focus && !hot;
      const ax = cx + pa.sx, ay = cy + pa.sy;
      const bx = cx + pb.sx, by = cy + pb.sy;
      // curve midpoint pulled toward origin in screen space (gives synaptic arc)
      const mx = (ax+bx)/2, my = (ay+by)/2;
      const offMag = 18 + Math.min(60, Math.hypot(bx-ax, by-ay) * 0.08);
      const perpx = -(by - ay), perpy = (bx - ax);
      const plen = Math.hypot(perpx, perpy) || 1;
      const cxm = mx + (perpx/plen) * offMag * 0.3;
      const cym = my + (perpy/plen) * offMag * 0.3;

      const baseColor = `rgba(${hot ? "124,92,255" : "90,100,140"}, ${dim ? 0.10 : (hot ? 0.85 : 0.35)})`;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = hot ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cxm, cym, bx, by);
      ctx.stroke();

      // Pulsing signal traveling along the curve
      if (params.signals && !dim) {
        const phase = l.phase;
        const t = phase;
        // quadratic Bezier point
        const u = 1 - t;
        const px = u*u*ax + 2*u*t*cxm + t*t*bx;
        const py = u*u*ay + 2*u*t*cym + t*t*by;
        // tail
        const tailN = 5;
        for (let k = 0; k < tailN; k++) {
          const tt = Math.max(0, t - k * 0.04);
          const uu = 1 - tt;
          const tx = uu*uu*ax + 2*uu*tt*cxm + tt*tt*bx;
          const ty = uu*uu*ay + 2*uu*tt*cym + tt*tt*by;
          const alpha = (1 - k/tailN) * (hot ? 0.95 : 0.55);
          ctx.beginPath();
          ctx.arc(tx, ty, 1.6 - k*0.18, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
        // head glow with target-type color
        ctx.shadowColor = meta_b.raw;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI*2);
        ctx.fillStyle = meta_b.raw;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Nodes (sort by depth)
    const nodesByDepth = sim.nodes
      .map(n => ({ n, p: proj.get(n.id) })).filter(o => o.p)
      .sort((a,b) => b.p.depth - a.p.depth);

    for (const { n, p } of nodesByDepth) {
      const meta = window.GKS.TYPE_META[n.type];
      const r = nodeR(n, p.scale);
      const x = cx + p.sx, y = cy + p.sy;
      const isFocus = focus && n.id === focus.id;
      const isNbr = focus && neighbors.has(n.id);
      const dim = focus && !isFocus && !isNbr;

      const depthFade = params.depth ? Math.max(0.25, Math.min(1, 800 / p.depth)) : 1;
      const alpha = (dim ? 0.18 : 1) * depthFade;

      // outer glow halo (soft neuron body)
      const grad = ctx.createRadialGradient(x, y, r*0.4, x, y, r*4);
      grad.addColorStop(0, hexA(meta.raw, 0.65 * alpha));
      grad.addColorStop(0.5, hexA(meta.raw, 0.18 * alpha));
      grad.addColorStop(1, hexA(meta.raw, 0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r*4, 0, Math.PI*2); ctx.fill();

      // soma
      ctx.shadowColor = meta.raw; ctx.shadowBlur = isFocus ? 22 : (isNbr ? 12 : 8);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fillStyle = hexA(meta.raw, alpha);
      ctx.fill();
      ctx.shadowBlur = 0;

      // white nucleus
      ctx.beginPath(); ctx.arc(x - r*0.25, y - r*0.25, r*0.35, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${0.55*alpha})`;
      ctx.fill();

      if (isFocus) {
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI*2); ctx.stroke();
      }

      // Neurite stubs (little dendrite hairs) for higher-degree nodes
      if (params.neurites && n.deg >= 3 && !dim) {
        ctx.strokeStyle = hexA(meta.raw, 0.6 * alpha);
        ctx.lineWidth = 0.6;
        for (let i = 0; i < Math.min(8, n.deg); i++) {
          const ang = (i / n.deg) * Math.PI * 2 + (n.x*0.001);
          const L = r * (2 + (i%3));
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(ang)*r, y + Math.sin(ang)*r);
          ctx.lineTo(x + Math.cos(ang)*(r+L), y + Math.sin(ang)*(r+L));
          ctx.stroke();
        }
      }

      // labels — front-most and important
      if (p.scale > 0.7 && (isFocus || isNbr || n.deg >= 5)) {
        ctx.font = `${isFocus ? "600 " : ""}11px "Space Grotesk", system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = `rgba(230,232,240,${alpha})`;
        ctx.fillText(n.title, x, y + r + 4);
      }
    }
  };

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <canvas ref={canvasRef}
              className="graph-canvas"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => { dragRef.current.down = false; setHover(null); }}
              onWheel={onWheel}/>
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
        <h4>Neural cortex · 3D</h4>
        <div style={{ color: "var(--text-mute)", fontSize: 11, marginBottom: 6 }}>
          drag to orbit · scroll to zoom · click to open
        </div>
        {Object.entries(window.GKS.TYPE_META).map(([t, m]) => (
          <div className="legend-row" key={t}>
            <span className="swatch" style={{ background: m.raw, color: m.raw }}/>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <div className="graph-controls">
        <div className="row">
          <label>Auto-orbit</label>
          <span className={"toggle" + (params.autoRotate ? " on" : "")}
                onClick={() => setParams(p => ({...p, autoRotate: !p.autoRotate}))}/>
        </div>
        <div className="row">
          <label>Speed</label>
          <input type="range" min="0" max="2" step="0.05" value={params.speed}
                 onChange={e => setParams(p => ({...p, speed: +e.target.value}))}/>
        </div>
        <div className="row">
          <label>Signals</label>
          <span className={"toggle" + (params.signals ? " on" : "")}
                onClick={() => setParams(p => ({...p, signals: !p.signals}))}/>
        </div>
        <div className="row">
          <label>Neurites</label>
          <span className={"toggle" + (params.neurites ? " on" : "")}
                onClick={() => setParams(p => ({...p, neurites: !p.neurites}))}/>
        </div>
        <div className="row">
          <label>Depth fog</label>
          <span className={"toggle" + (params.depth ? " on" : "")}
                onClick={() => setParams(p => ({...p, depth: !p.depth}))}/>
        </div>
      </div>
    </div>
  );
}

function hexA(hex, a) {
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

window.Graph3DView = Graph3DView;
