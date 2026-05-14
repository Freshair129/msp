// Genesis — Force-directed knowledge graph (canvas)
const { useState: gUseState, useEffect: gUseEffect, useRef: gUseRef, useMemo: gUseMemo, useCallback: gUseCallback } = React;

function GraphView({ notes, edges, focusId, onOpen, tweaks }) {
  const canvasRef = gUseRef(null);
  const wrapRef = gUseRef(null);
  const [hover, setHover] = gUseState(null); // { id, x, y }
  const [size, setSize] = gUseState({ w: 800, h: 600 });
  const [running, setRunning] = gUseState(true);
  const [params, setParams] = gUseState({ repel: 1100, link: 0.05, center: 0.012, distance: 80, labels: true, arrows: true });

  // Init particle simulation
  const simRef = gUseRef(null);
  gUseEffect(() => {
    const byId = Object.fromEntries(notes.map(n => [n.id, n]));
    const nodes = notes.map((n, i) => {
      const angle = (i / notes.length) * Math.PI * 2;
      const r = 180 + (i % 5) * 30;
      return {
        id: n.id, type: n.type, title: n.title,
        x: Math.cos(angle)*r, y: Math.sin(angle)*r,
        vx: 0, vy: 0,
        deg: 1,
        pinned: false,
      };
    });
    const links = edges.filter(e => byId[e.source] && byId[e.target]).map(e => ({ source: e.source, target: e.target }));
    nodes.forEach(n => { n.deg = links.reduce((a,l) => a + (l.source===n.id||l.target===n.id ? 1 : 0), 0); });
    simRef.current = { nodes, links, byNode: Object.fromEntries(nodes.map(n => [n.id, n])) };
  }, [notes, edges]);

  // Size to container
  gUseEffect(() => {
    const ro = new ResizeObserver(es => {
      for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Camera (pan + zoom)
  const camRef = gUseRef({ x: 0, y: 0, z: 1, target: null });
  gUseEffect(() => {
    if (!focusId || !simRef.current) return;
    const n = simRef.current.byNode[focusId];
    if (n) camRef.current.target = { x: n.x, y: n.y };
  }, [focusId]);

  // Animation loop
  gUseEffect(() => {
    let raf;
    const tick = () => {
      const sim = simRef.current;
      if (!sim) { raf = requestAnimationFrame(tick); return; }
      const { nodes, links } = sim;
      const dragId = dragRef.current.draggingNode;
      if (running) {
        // Repel
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i+1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d2 = dx*dx + dy*dy + 0.01;
            const f = params.repel / d2;
            const d = Math.sqrt(d2);
            const fx = (dx/d) * f, fy = (dy/d) * f;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
          }
        }
        // Link springs
        for (const l of links) {
          const a = sim.byNode[l.source], b = sim.byNode[l.target];
          if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 0.01;
          const diff = (d - params.distance) * params.link;
          const fx = (dx/d) * diff, fy = (dy/d) * diff;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
        // Center pull
        for (const n of nodes) {
          n.vx += -n.x * params.center;
          n.vy += -n.y * params.center;
          n.vx *= 0.82; n.vy *= 0.82;
          if (n.id !== dragId) { n.x += n.vx; n.y += n.vy; }
        }
      }

      // Animate camera target
      if (camRef.current.target) {
        camRef.current.x += (camRef.current.target.x - camRef.current.x) * 0.08;
        camRef.current.y += (camRef.current.target.y - camRef.current.y) * 0.08;
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, params, size]);

  // Draw
  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr) { canvas.width = size.w * dpr; canvas.height = size.h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const cam = camRef.current;
    const cx = size.w / 2, cy = size.h / 2;
    const toScreen = (x, y) => [cx + (x - cam.x) * cam.z, cy + (y - cam.y) * cam.z];

    const sim = simRef.current; if (!sim) return;

    const focus = focusId ? sim.byNode[focusId] : null;
    const neighborSet = new Set();
    if (focus) {
      sim.links.forEach(l => {
        if (l.source === focusId) neighborSet.add(l.target);
        if (l.target === focusId) neighborSet.add(l.source);
      });
    }

    // Edges
    ctx.lineWidth = 1;
    for (const l of sim.links) {
      const a = sim.byNode[l.source], b = sim.byNode[l.target];
      if (!a || !b) continue;
      const [ax, ay] = toScreen(a.x, a.y);
      const [bx, by] = toScreen(b.x, b.y);
      const hot = focus && (a.id === focusId || b.id === focusId);
      ctx.strokeStyle = hot ? "rgba(124,92,255,0.55)" : (focus ? "rgba(60,66,86,0.25)" : "rgba(60,66,86,0.45)");
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (params.arrows && hot) {
        const ang = Math.atan2(by - ay, bx - ax);
        const ar = 6;
        ctx.fillStyle = "rgba(124,92,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(ang)*ar - Math.cos(ang+Math.PI/2)*ar*0.5, by - Math.sin(ang)*ar - Math.sin(ang+Math.PI/2)*ar*0.5);
        ctx.lineTo(bx - Math.cos(ang)*ar + Math.cos(ang+Math.PI/2)*ar*0.5, by - Math.sin(ang)*ar + Math.sin(ang+Math.PI/2)*ar*0.5);
        ctx.closePath(); ctx.fill();
      }
    }

    // Nodes
    for (const n of sim.nodes) {
      const [x, y] = toScreen(n.x, n.y);
      const meta = window.GKS.TYPE_META[n.type] || { raw: "#888" };
      const r = Math.max(4, 4 + Math.sqrt(n.deg) * 1.6) * (cam.z * 0.6 + 0.4);
      const isFocus = n.id === focusId;
      const isNeighbor = focus && neighborSet.has(n.id);
      const dim = focus && !isFocus && !isNeighbor;
      ctx.globalAlpha = dim ? 0.25 : 1;
      // halo
      if (isFocus || hover?.id === n.id) {
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.fillStyle = meta.raw + "22";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = meta.raw;
      ctx.shadowColor = meta.raw; ctx.shadowBlur = isFocus ? 18 : (isNeighbor ? 10 : 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      // ring on focus
      if (isFocus) {
        ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Label
      if (params.labels && (cam.z > 0.55 || isFocus || isNeighbor || n.deg >= 4)) {
        ctx.font = `${isFocus ? "600 " : ""}${Math.max(10, 11 * (cam.z*0.5 + 0.6))}px "Space Grotesk", system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = dim ? "#5a5f73" : (isFocus ? "#e6e8f0" : "#a4a9be");
        ctx.fillText(n.title, x, y + r + 4);
      }
    }
  };

  // Pan / zoom / drag
  const dragRef = gUseRef({ panning: false, draggingNode: null, lastX: 0, lastY: 0 });

  const pickNode = (mx, my) => {
    const sim = simRef.current; if (!sim) return null;
    const cam = camRef.current;
    const cx = size.w / 2, cy = size.h / 2;
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const n = sim.nodes[i];
      const x = cx + (n.x - cam.x) * cam.z;
      const y = cy + (n.y - cam.y) * cam.z;
      const r = Math.max(4, 4 + Math.sqrt(n.deg) * 1.6) * (cam.z * 0.6 + 0.4);
      const dx = mx - x, dy = my - y;
      if (dx*dx + dy*dy < (r + 5)*(r + 5)) return n;
    }
    return null;
  };

  const onMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = pickNode(mx, my);
    if (hit) {
      dragRef.current.draggingNode = hit.id;
    } else {
      dragRef.current.panning = true;
    }
    dragRef.current.lastX = mx; dragRef.current.lastY = my;
    camRef.current.target = null;
  };
  const onMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cam = camRef.current;
    if (dragRef.current.draggingNode) {
      const sim = simRef.current;
      const n = sim.byNode[dragRef.current.draggingNode];
      const dx = (mx - dragRef.current.lastX) / cam.z;
      const dy = (my - dragRef.current.lastY) / cam.z;
      n.x += dx; n.y += dy; n.vx = 0; n.vy = 0;
    } else if (dragRef.current.panning) {
      cam.x -= (mx - dragRef.current.lastX) / cam.z;
      cam.y -= (my - dragRef.current.lastY) / cam.z;
      setHover(null);
    } else {
      const hit = pickNode(mx, my);
      setHover(hit ? { id: hit.id, x: mx, y: my } : null);
    }
    dragRef.current.lastX = mx; dragRef.current.lastY = my;
  };
  const onMouseUp = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wasDragging = dragRef.current.draggingNode || dragRef.current.panning;
    const movedFar = Math.abs(mx - dragRef.current.lastX) > 4 || Math.abs(my - dragRef.current.lastY) > 4;
    if (!movedFar) {
      const hit = pickNode(mx, my);
      if (hit) onOpen?.(hit.id);
    }
    dragRef.current.draggingNode = null;
    dragRef.current.panning = false;
  };
  const onWheel = (e) => {
    e.preventDefault();
    const cam = camRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = size.w / 2, cy = size.h / 2;
    const wx = cam.x + (mx - cx) / cam.z;
    const wy = cam.y + (my - cy) / cam.z;
    cam.z = Math.max(0.25, Math.min(3.2, cam.z * factor));
    cam.x = wx - (mx - cx) / cam.z;
    cam.y = wy - (my - cy) / cam.z;
  };

  const counts = gUseMemo(() => {
    const c = {};
    notes.forEach(n => { c[n.type] = (c[n.type]||0)+1; });
    return c;
  }, [notes]);

  return (
    <div className="graph-wrap" ref={wrapRef}>
      <canvas ref={canvasRef}
              className="graph-canvas"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
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
        <h4>Legend · {notes.length} nodes</h4>
        {Object.entries(window.GKS.TYPE_META).map(([t, m]) => (
          <div className="legend-row" key={t}>
            <span className="swatch" style={{ background: m.raw, color: m.raw }}/>
            <span>{m.label}</span>
            <span className="count">{counts[t] || 0}</span>
          </div>
        ))}
        <div className="legend-row" style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
          <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10 }}>{edges.length} edges · drag · scroll to zoom</span>
        </div>
      </div>
      <div className="graph-controls">
        <div className="row">
          <label>Repel</label>
          <input type="range" min="300" max="2400" value={params.repel} onChange={e => setParams(p => ({...p, repel: +e.target.value}))}/>
        </div>
        <div className="row">
          <label>Link</label>
          <input type="range" min="0.01" max="0.20" step="0.005" value={params.link} onChange={e => setParams(p => ({...p, link: +e.target.value}))}/>
        </div>
        <div className="row">
          <label>Distance</label>
          <input type="range" min="30" max="180" value={params.distance} onChange={e => setParams(p => ({...p, distance: +e.target.value}))}/>
        </div>
        <div className="row">
          <label>Center</label>
          <input type="range" min="0" max="0.05" step="0.002" value={params.center} onChange={e => setParams(p => ({...p, center: +e.target.value}))}/>
        </div>
        <div className="row">
          <label>Labels</label>
          <span className={"toggle" + (params.labels ? " on" : "")} onClick={() => setParams(p => ({...p, labels: !p.labels}))}/>
        </div>
        <div className="row">
          <label>Arrows</label>
          <span className={"toggle" + (params.arrows ? " on" : "")} onClick={() => setParams(p => ({...p, arrows: !p.arrows}))}/>
        </div>
        <div className="row">
          <label>Simulate</label>
          <span className={"toggle" + (running ? " on" : "")} onClick={() => setRunning(r => !r)}/>
        </div>
      </div>
    </div>
  );
}

window.GraphView = GraphView;
