// Genesis Knowledge Graph — sample product design corpus
// Naming: TYPE--slug. Types: ENTITY, FEAT, FLOW, CONCEPT, MOC (map of content)

window.GKS_DATA = (function () {
  const notes = [
    // ── MOCs (anchors) ──────────────────────────────────────────
    { id: "MOC--product",         title: "MOC — Product",            type: "MOC",     tags: ["moc","master-data"],
      body: `# MOC — Product\n\nAtlas of the product surface. Everything starts here.\n\n## Pillars\n- [[FEAT--inventory-system]]\n- [[FEAT--finance-system]]\n- [[FEAT--roles-permissions]]\n- [[FEAT--sitemap]]\n\n## Core entities\n[[ENTITY--customer]], [[ENTITY--vendor]], [[ENTITY--user]], [[ENTITY--branch]]\n\n## Flows\n[[FLOW--customer-journey]], [[FLOW--ux-flows]]\n\n> Updated 2026-05-12 · 84 outbound links\n` },

    { id: "MOC--research",        title: "MOC — Research",           type: "MOC",     tags: ["moc","research"],
      body: `# MOC — Research\n\nField studies, customer interviews, observation logs.\n\n- [[CONCEPT--open-requirements]]\n- [[CONCEPT--organization-model]]\n- Recent: 2026-05-09 clinic visit, 2026-05-01 pharmacy ops shadow\n` },

    // ── FEAT (capabilities) ─────────────────────────────────────
    { id: "FEAT--inventory-system", title: "Inventory System", type: "FEAT", tags: ["feature","warehouse","stock"],
      body: `# Inventory System\n\nTracks every [[ENTITY--stock-item]] across [[ENTITY--stock-location]]s through [[ENTITY--stock-movement]] events.\n\nDepends on [[ENTITY--purchase-order]], [[ENTITY--vendor]], [[FEAT--roles-permissions]].\n\n## Open\n- Lot/serial tracking for medical-grade items\n- Reconciliation against [[ENTITY--receipt]]\n` },
    { id: "FEAT--finance-system", title: "Finance System", type: "FEAT", tags: ["feature","finance","money"],
      body: `# Finance System\n\nThe ledger. Every [[ENTITY--point-transaction]], [[ENTITY--payment]], [[ENTITY--invoice]] lands here.\n\n- Multi-currency posting\n- Discounts via [[ENTITY--promotion]]\n- Loyalty: [[CONCEPT--organization-model]]\n` },
    { id: "FEAT--roles-permissions", title: "Roles & Permissions", type: "FEAT", tags: ["feature","access-control","security"],
      body: `# Roles & Permissions\n\nWho can do what, where. Subject = [[ENTITY--user]], Scope = [[ENTITY--branch]] / [[ENTITY--vendor]] / org-wide.\n\nSee [[CONCEPT--organization-model]] for the hierarchy.\n` },
    { id: "FEAT--sitemap", title: "Sitemap", type: "FEAT", tags: ["feature","ux","wireframe"],
      body: `# Sitemap\n\nNavigation skeleton. Cross-cuts every flow in [[FLOW--ux-flows]].\n` },
    { id: "FEAT--ux-flows-bundle", title: "UX Flows Bundle", type: "FEAT", tags: ["feature","ux"],
      body: `# UX Flows Bundle\n\nReference flows shipping in v0.4. See [[FLOW--ux-flows]] and [[FLOW--customer-journey]].\n` },

    // ── FLOW (user journeys) ────────────────────────────────────
    { id: "FLOW--customer-journey", title: "Customer Journey", type: "FLOW", tags: ["flow","customer","journey"],
      body: `# Customer Journey\n\nDiscover → Visit → Receive → Pay → Loyalty.\n\nTouches [[ENTITY--customer]], [[ENTITY--visit]], [[ENTITY--receipt]], [[ENTITY--payment]], [[ENTITY--point-transaction]].\n` },
    { id: "FLOW--ux-flows", title: "UX Flows", type: "FLOW", tags: ["flow","ux","wireframe"],
      body: `# UX Flows\n\nMaster catalog of screen-by-screen flows. Cross-linked from [[FEAT--sitemap]].\n` },
    { id: "FLOW--procurement", title: "Procurement Flow", type: "FLOW", tags: ["flow","procurement"],
      body: `# Procurement Flow\n\nRequisition → [[ENTITY--purchase-order]] → Receive → [[ENTITY--stock-movement]] → Invoice → [[FEAT--finance-system]].\n` },

    // ── CONCEPT (ideas, models) ─────────────────────────────────
    { id: "CONCEPT--open-requirements", title: "Open Requirements", type: "CONCEPT", tags: ["concept","blockers","decisions-needed"],
      body: `# Open Requirements\n\nThings still ambiguous. Drives [[FEAT--inventory-system]] and [[FEAT--finance-system]].\n\n- Multi-tenant boundaries\n- Returns workflow vs. [[ENTITY--receipt]]\n- Audit trail granularity\n` },
    { id: "CONCEPT--organization-model", title: "Organization Model", type: "CONCEPT", tags: ["concept","master-data","hierarchy"],
      body: `# Organization Model\n\nOrg → [[ENTITY--branch]] → [[ENTITY--user]]. Permissions cascade via [[FEAT--roles-permissions]].\n` },
    { id: "CONCEPT--audit-trail", title: "Audit Trail", type: "CONCEPT", tags: ["concept","audit-trail","compliance"],
      body: `# Audit Trail\n\nEvery mutation to [[ENTITY--stock-movement]], [[ENTITY--payment]], [[ENTITY--receipt]] is logged with actor + timestamp.\n` },
    { id: "CONCEPT--before-after", title: "Before / After States", type: "CONCEPT", tags: ["concept","before-after","ux"],
      body: `# Before / After States\n\nDocumenting the delta a flow produces — pairs with every [[FLOW--ux-flows]] entry.\n` },

    // ── ENTITY (domain objects) ─────────────────────────────────
    { id: "ENTITY--customer", title: "Customer", type: "ENTITY", tags: ["entity","customer","crm"],
      body: `# Customer\n\nThe person we serve. Linked to [[ENTITY--visit]], [[ENTITY--receipt]], [[ENTITY--payment]], [[ENTITY--point-transaction]], [[ENTITY--loyalty]].\n` },
    { id: "ENTITY--vendor", title: "Vendor", type: "ENTITY", tags: ["entity","vendor","procurement"],
      body: `# Vendor\n\nUpstream supplier. Source of [[ENTITY--purchase-order]] and [[ENTITY--stock-movement]] inflow.\n` },
    { id: "ENTITY--user", title: "User", type: "ENTITY", tags: ["entity","user","access-control"],
      body: `# User\n\nA human operator. Bound by [[FEAT--roles-permissions]] to a [[ENTITY--branch]].\n` },
    { id: "ENTITY--branch", title: "Branch", type: "ENTITY", tags: ["entity","branch","organization"],
      body: `# Branch\n\nPhysical or logical location. Holds [[ENTITY--stock-location]]s.\n` },
    { id: "ENTITY--visit", title: "Visit", type: "ENTITY", tags: ["entity","visit","customer-journey"],
      body: `# Visit\n\nA customer's session. Produces zero or more [[ENTITY--receipt]]s, [[ENTITY--medical-record]] entries, [[ENTITY--vital-sign]] readings.\n` },
    { id: "ENTITY--receipt", title: "Receipt", type: "ENTITY", tags: ["entity","receipt","finance"],
      body: `# Receipt\n\nProof of [[ENTITY--payment]] against a [[ENTITY--visit]] or [[ENTITY--purchase-order]].\n` },
    { id: "ENTITY--payment", title: "Payment", type: "ENTITY", tags: ["entity","payment","finance"],
      body: `# Payment\n\nMoney moves. Settled against [[ENTITY--invoice]] or [[ENTITY--receipt]].\n` },
    { id: "ENTITY--invoice", title: "Invoice", type: "ENTITY", tags: ["entity","invoice","finance"],
      body: `# Invoice\n\nBill issued to [[ENTITY--customer]] or received from [[ENTITY--vendor]].\n` },
    { id: "ENTITY--point-transaction", title: "Point Transaction", type: "ENTITY", tags: ["entity","loyalty","points"],
      body: `# Point Transaction\n\nLoyalty currency movement. Earned on [[ENTITY--payment]], spent against [[ENTITY--promotion]].\n` },
    { id: "ENTITY--promotion", title: "Promotion", type: "ENTITY", tags: ["entity","promotion","discount"],
      body: `# Promotion\n\nDiscount or campaign. Consumed by [[ENTITY--receipt]] line items.\n` },
    { id: "ENTITY--loyalty", title: "Loyalty", type: "ENTITY", tags: ["entity","loyalty"],
      body: `# Loyalty\n\nA customer's standing — accumulates [[ENTITY--point-transaction]]s.\n` },
    { id: "ENTITY--purchase-order", title: "Purchase Order", type: "ENTITY", tags: ["entity","po","procurement"],
      body: `# Purchase Order\n\nIssued to a [[ENTITY--vendor]]. Triggers [[ENTITY--stock-movement]] on receipt.\n` },
    { id: "ENTITY--requisition", title: "Requisition", type: "ENTITY", tags: ["entity","requisition","procurement"],
      body: `# Requisition\n\nInternal request that becomes a [[ENTITY--purchase-order]] after approval.\n` },
    { id: "ENTITY--stock-item", title: "Stock Item", type: "ENTITY", tags: ["entity","stock","master-data"],
      body: `# Stock Item\n\nA SKU. Lives in [[ENTITY--stock-location]]s, moves via [[ENTITY--stock-movement]].\n` },
    { id: "ENTITY--stock-location", title: "Stock Location", type: "ENTITY", tags: ["entity","stock","warehouse"],
      body: `# Stock Location\n\nShelf, bin, or warehouse zone inside a [[ENTITY--branch]].\n` },
    { id: "ENTITY--stock-movement", title: "Stock Movement", type: "ENTITY", tags: ["entity","stock","transaction"],
      body: `# Stock Movement\n\nIn / out / transfer. Bound by [[CONCEPT--audit-trail]].\n` },
    { id: "ENTITY--medical-record", title: "Medical Record", type: "ENTITY", tags: ["entity","medical-record","patient"],
      body: `# Medical Record\n\nAttached to a [[ENTITY--visit]]. Holds [[ENTITY--vital-sign]] entries.\n` },
    { id: "ENTITY--vital-sign", title: "Vital Sign", type: "ENTITY", tags: ["entity","vital-signs","medical"],
      body: `# Vital Sign\n\nReading captured during a [[ENTITY--visit]].\n` },
    { id: "ENTITY--appointment", title: "Appointment", type: "ENTITY", tags: ["entity","appointment","opd"],
      body: `# Appointment\n\nScheduled future [[ENTITY--visit]]. Owned by a [[ENTITY--doctor-preset]].\n` },
    { id: "ENTITY--doctor-preset", title: "Doctor Preset", type: "ENTITY", tags: ["entity","doctor-preset","opd"],
      body: `# Doctor Preset\n\nReusable order set used in [[ENTITY--opd]] sessions.\n` },
    { id: "ENTITY--opd", title: "OPD Session", type: "ENTITY", tags: ["entity","opd","consultation"],
      body: `# OPD Session\n\nOutpatient consultation. Creates [[ENTITY--medical-record]], applies [[ENTITY--doctor-preset]].\n` },
    { id: "ENTITY--photo", title: "Photo", type: "ENTITY", tags: ["entity","photo","attachment"],
      body: `# Photo\n\nMedia attached to a [[ENTITY--visit]] or [[ENTITY--stock-item]].\n` },
    { id: "ENTITY--consent", title: "Consent", type: "ENTITY", tags: ["entity","consent","compliance"],
      body: `# Consent\n\nLegal sign-off bound to a [[ENTITY--customer]] for a [[FLOW--customer-journey]] step.\n` },
    { id: "ENTITY--activity-verification", title: "Activity Verification", type: "ENTITY", tags: ["entity","verification","audit"],
      body: `# Activity Verification\n\nDouble-check on sensitive [[ENTITY--stock-movement]] or [[ENTITY--payment]] events.\n` },
    { id: "ENTITY--lead", title: "Lead", type: "ENTITY", tags: ["entity","lead","crm"],
      body: `# Lead\n\nPotential [[ENTITY--customer]]. Lives upstream of [[FLOW--customer-journey]].\n` },
  ];

  // Build link graph from [[wikilinks]] in bodies
  const linkRe = /\[\[([A-Z]+--[a-z0-9-]+)\]\]/g;
  const edges = [];
  const adj = {};
  notes.forEach(n => { adj[n.id] = { out: new Set(), in: new Set() }; });
  notes.forEach(n => {
    const seen = new Set();
    let m;
    while ((m = linkRe.exec(n.body)) !== null) {
      const target = m[1];
      if (target === n.id) continue;
      if (seen.has(target)) continue;
      seen.add(target);
      if (!adj[target]) continue;
      edges.push({ source: n.id, target });
      adj[n.id].out.add(target);
      adj[target].in.add(n.id);
    }
  });

  // Tag set
  const tagCounts = {};
  notes.forEach(n => n.tags.forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));

  // Pseudo-embedding: deterministic 2D coord per note, clustered by type, derived from tag overlap
  // Build a stable 2D embedding using tag co-occurrence projected via random-but-seeded vectors.
  const TYPE_ANCHORS = {
    MOC:     [  0,   0],
    FEAT:    [-180,-120],
    FLOW:    [ 180,-130],
    CONCEPT: [-200, 140],
    ENTITY:  [ 160, 150],
  };
  function hash(s){ let h=2166136261>>>0; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
  notes.forEach(n => {
    const a = TYPE_ANCHORS[n.type] || [0,0];
    const h1 = hash(n.id);
    const h2 = hash(n.id + "y");
    const dx = ((h1 % 1000) / 1000 - 0.5) * 220;
    const dy = ((h2 % 1000) / 1000 - 0.5) * 200;
    n.embed = [a[0] + dx, a[1] + dy];
  });

  // Adjacency-derived "similarity" score helper (also used to seed Related Notes)
  function similarity(aId, bId) {
    if (aId === bId) return 1;
    const A = notes.find(x=>x.id===aId), B = notes.find(x=>x.id===bId);
    if (!A || !B) return 0;
    const aTags = new Set(A.tags), bTags = new Set(B.tags);
    let overlap = 0; aTags.forEach(t => bTags.has(t) && overlap++);
    const jacc = overlap / (aTags.size + bTags.size - overlap || 1);
    const linkBoost = (adj[aId].out.has(bId) || adj[aId].in.has(bId)) ? 0.25 : 0;
    const typeBoost = A.type === B.type ? 0.08 : 0;
    return Math.min(1, jacc * 0.9 + linkBoost + typeBoost);
  }

  // Daily notes
  const daily = [
    { date: "2026-05-13", title: "Today", entries: [
      "Resolved [[CONCEPT--open-requirements]] item on returns workflow",
      "Pair-mapped [[FLOW--customer-journey]] with @lin",
      "Embedding refresh queued — 487 nodes"
    ]},
    { date: "2026-05-12", title: "Yesterday", entries: [
      "[[MOC--product]] reorganized — pillars surface earlier",
      "Drafted [[FEAT--roles-permissions]] permission matrix",
    ]},
    { date: "2026-05-11", title: "Mon", entries: [
      "Clinic visit notes — see [[ENTITY--opd]], [[ENTITY--doctor-preset]]",
    ]},
    { date: "2026-05-09", title: "Sat", entries: [
      "Pharmacy ops shadow — observations folded into [[CONCEPT--audit-trail]]",
    ]},
    { date: "2026-05-07", title: "Thu", entries: [
      "Started [[MOC--research]]",
    ]},
  ];

  return {
    notes,
    edges,
    adj,
    tags: Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]),
    similarity,
    daily,
  };
})();
