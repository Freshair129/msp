// Genesis — Embedding 2D map (scatter, clustered by type)
function EmbeddingView({ notes, focusId, onOpen, similarityQuery }) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 800, h: 600 });
  const [hover, setHover] = React.useState(null);
  const camRef = React.useRef({ x: 0, y: 0, z: 1.6 });
  const dragRef = React.useRef({ panning: false, lastX: 0, lastY: 0 });

  React.useEffect(() => {
    const ro = new ResizeObserver(es => {
      for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Animate redraw
  React.useEffect(() => {
    let raf;
    const tick = () => { draw(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, notes, focusId, similarityQuery, hover]);

  const focus = focusId ? window.GKS.NOTE_BY_ID[focusId] : null;
  const sims = React.useMemo(() => {
    if (!focus) return {};
    const out = {};
    notes.forEach(n => { out[n.id] = window.GKS.D.similarity(focus.id, n.id); });
    return out;
  }, [focus, notes]);

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr) { canvas.width = size.w * dpr; canvas.height = size.h * dpr; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // grid
    ctx.strokeStyle = "rgba(40,46,66,0.5)";
    ctx.lineWidth = 1;
    const cam = camRef.current;
    const step = 50 * cam.z;
    const cx = size.w / 2, cy = size.h / 2;
    const offX = (-cam.x * cam.z + cx) % step;
    const offY = (-cam.y * cam.z + cy) % step;
    for (let x = offX; x < size.w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke();
    }
    for (let y = offY; y < size.h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke();
    }

    // Cluster halos by type
    const clusters = {};
    notes.forEach(n => { (clusters[n.type] = clusters[n.type] || []).push(n); });
    Object.entries(clusters).forEach(([type, items]) => {
      const meta = window.GKS.TYPE_META[type]; if (!meta) return;
      // centroid + radius
      let mx = 0, my = 0;
      items.forEach(n => { mx += n.embed[0]; my += n.embed[1]; });
      mx /= items.length; my /= items.length;
      let r = 0;
      items.forEach(n => { const dx = n.embed[0]-mx, dy = n.embed[1]-my; r = Math.max(r, Math.sqrt(dx*dx+dy*dy)); });
      const sx = cx + (mx - cam.x) * cam.z;
      const sy = cy + (my - cam.y) * cam.z;
      const sr = (r + 30) * cam.z;
      const grad = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
      grad.addColorStop(0, meta.raw + "22");
      grad.addColorStop(1, meta.raw + "00");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
      // label
      ctx.fillStyle = meta.raw;
      ctx.font = "600 11px JetBrains Mono, ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(meta.label, sx, sy - sr - 6);
    });

    // points
    notes.forEach(n => {
      const meta = window.GKS.TYPE_META[n.type]; if (!meta) return;
      const sx = cx + (n.embed[0] - cam.x) * cam.z;
      const sy = cy + (n.embed[1] - cam.y) * cam.z;
      const sim = focus ? sims[n.id] : (similarityQuery?.[n.id] ?? 0);
      const isFocus = n.id === focusId;
      const r = isFocus ? 7 : (4 + sim * 3);
      const alpha = focus ? Math.max(0.2, sim) : 1;
      ctx.globalAlpha = alpha;
      // similarity ring
      if (sim > 0.1 && !isFocus) {
        ctx.beginPath();
        ctx.arc(sx, sy, r + 4 + sim * 6, 0, Math.PI*2);
        ctx.strokeStyle = meta.raw + "55";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI*2);
      ctx.fillStyle = meta.raw;
      ctx.shadowColor = meta.raw; ctx.shadowBlur = isFocus ? 16 : 4;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (isFocus) {
        ctx.lineWidth = 2; ctx.strokeStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx, sy, r + 3, 0, Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    // Lines from focus to top-K similars
    if (focus) {
      const fx = cx + (focus.embed[0] - cam.x) * cam.z;
      const fy = cy + (focus.embed[1] - cam.y) * cam.z;
      const top = notes
        .filter(n => n.id !== focus.id)
        .map(n => ({ n, s: sims[n.id] }))
        .sort((a,b) => b.s - a.s)
        .slice(0, 5);
      top.forEach(({ n, s }) => {
        const tx = cx + (n.embed[0] - cam.x) * cam.z;
        const ty = cy + (n.embed[1] - cam.y) * cam.z;
        ctx.strokeStyle = "rgba(124,92,255," + (0.15 + s * 0.4).toFixed(2) + ")";
        ctx.lineWidth = 0.6 + s * 1.4;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
      });
    }
  };

  const pickNote = (mx, my) => {
    const cam = camRef.current;
    const cx = size.w/2, cy = size.h/2;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const sx = cx + (n.embed[0] - cam.x) * cam.z;
      const sy = cy + (n.embed[1] - cam.y) * cam.z;
      const dx = mx - sx, dy = my - sy;
      if (dx*dx + dy*dy < 64) return n;
    }
    return null;
  };

  const onMouseDown = (e) => {
    dragRef.current.panning = true;
    const r = canvasRef.current.getBoundingClientRect();
    dragRef.current.lastX = e.clientX - r.left; dragRef.current.lastY = e.clientY - r.top;
  };
  const onMouseMove = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (dragRef.current.panning) {
      camRef.current.x -= (mx - dragRef.current.lastX) / camRef.current.z;
      camRef.current.y -= (my - dragRef.current.lastY) / camRef.current.z;
      setHover(null);
    } else {
      const hit = pickNote(mx, my);
      setHover(hit ? { id: hit.id, x: mx, y: my } : null);
    }
    dragRef.current.lastX = mx; dragRef.current.lastY = my;
  };
  const onMouseUp = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const hit = pickNote(mx, my);
    if (hit) onOpen?.(hit.id);
    dragRef.current.panning = false;
  };
  const onWheel = (e) => {
    e.preventDefault();
    const cam = camRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const cx = size.w/2, cy = size.h/2;
    const wx = cam.x + (mx - cx) / cam.z;
    const wy = cam.y + (my - cy) / cam.z;
    cam.z = Math.max(0.4, Math.min(3.6, cam.z * factor));
    cam.x = wx - (mx - cx) / cam.z;
    cam.y = wy - (my - cy) / cam.z;
  };

  return (
    <div className="embed-wrap" ref={wrapRef}>
      <canvas ref={canvasRef}
              className="embed-canvas"
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
          {focus && (
            <div style={{ color:"var(--text-dim)", fontFamily:"var(--font-mono)", fontSize:10, marginTop:2 }}>
              cos·sim = {(sims[hover.id] || 0).toFixed(3)}
            </div>
          )}
        </div>
      )}
      <div className="embed-legend">
        2D projection · UMAP-like<br/>
        {notes.length} vectors · 1536-dim → 2D
      </div>
      <div className="embed-axes">
        <div className="axis">x · <b>semantic-1</b></div>
        <div className="axis">y · <b>semantic-2</b></div>
        <div className="axis" style={{ marginTop: 6, color: "var(--accent)" }}>
          {focus ? `anchored on ${focus.title}` : "click a point to anchor"}
        </div>
      </div>
    </div>
  );
}

window.EmbeddingView = EmbeddingView;
