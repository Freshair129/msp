import gksData from './gksData.json';
import type { Note, Edge, AdjacencyNode, DailyEntry, GKSData } from '../types/gks';
export type { Note, Edge, AdjacencyNode, DailyEntry, GKSData };

const notes: Note[] = (gksData.notes as any[]).map(n => ({
  ...n,
  tags: n.tags || [],
  body: n.body || ''
}));

const edges: Edge[] = gksData.edges as Edge[];

const adj: Record<string, AdjacencyNode> = {};
notes.forEach(n => {
  adj[n.id] = { in: new Set(), out: new Set() };
});

edges.forEach(e => {
  if (adj[e.source] && adj[e.target]) {
    adj[e.source].out.add(e.target);
    adj[e.target].in.add(e.source);
  }
});

export const GKS_DATA: GKSData = {
  notes,
  edges,
  adj,
  tags: gksData.tags as [string, number][],
  daily: (gksData.daily || []) as any[]
};

export const NOTE_BY_ID = Object.fromEntries(GKS_DATA.notes.map(n => [n.id, n]));
