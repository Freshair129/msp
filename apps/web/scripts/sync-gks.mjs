import fs from 'fs';
import path from 'path';

const GKS_INDEX_PATH = 'C:/Users/freshair/cognitive_system/gks/00_index/atomic_index.jsonl';
const OUTPUT_PATH = './src/data/gksData.json';

async function sync() {
  console.log('🔄 Syncing real GKS data...');
  
  if (!fs.existsSync(GKS_INDEX_PATH)) {
    console.error('❌ atomic_index.jsonl not found!');
    return;
  }

  const lines = fs.readFileSync(GKS_INDEX_PATH, 'utf-8').split('\n').filter(Boolean);
  const rawAtoms = lines.map(line => JSON.parse(line));

  const notes = rawAtoms.map(atom => ({
    id: atom.id,
    title: atom.title || atom.id,
    type: (atom.type || 'CONCEPT').toUpperCase(),
    tags: atom.tags || [],
    path: atom.path,
    body: `Source: ${atom.path}\n\nStatus: ${atom.status}\nPhase: ${atom.phase}`,
    // Generate deterministic embedding for 2D map if missing
    embed: [Math.random() * 600 - 300, Math.random() * 600 - 300] 
  }));

  const edges = [];
  rawAtoms.forEach(atom => {
    if (atom.crosslinks && atom.crosslinks.references) {
      atom.crosslinks.references.forEach(target => {
        edges.push({ source: atom.id, target });
      });
    }
  });

  const tagCounts = {};
  notes.forEach(n => n.tags.forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));

  const data = {
    notes,
    edges,
    tags: Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]),
    daily: [] // Scan for daily notes could be added later
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`✅ Synced ${notes.length} atoms and ${edges.length} edges.`);
}

sync();
