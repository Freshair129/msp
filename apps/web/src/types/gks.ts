export type NoteType = 'MOC' | 'FEAT' | 'FLOW' | 'CONCEPT' | 'ENTITY' | 'ADR' | 'MASTER' | 'TAG';

export interface Note {
  id: string;
  title: string;
  type: NoteType;
  tags: string[];
  body: string;
  path?: string;
  embed?: [number, number];
}

export interface Edge {
  source: string;
  target: string;
}

export interface AdjacencyNode {
  out: Set<string>;
  in: Set<string>;
}

export interface DailyEntry {
  date: string;
  title: string;
  entries: string[];
}

export interface GKSData {
  notes: Note[];
  edges: Edge[];
  adj: Record<string, AdjacencyNode>;
  tags: [string, number][];
  daily: DailyEntry[];
}

export interface TypeMeta {
  color: string;
  raw: string;
  label: string;
}

export const TYPE_META: Record<NoteType, TypeMeta> = {
  ENTITY:  { color: "var(--c-entity)",  raw: "#4dd6e8", label: "ENTITY"  },
  FEAT:    { color: "var(--c-feat)",    raw: "#a78bfa", label: "FEATURE" },
  FLOW:    { color: "var(--c-flow)",    raw: "#f472b6", label: "FLOW"    },
  CONCEPT: { color: "var(--c-concept)", raw: "#fbbf24", label: "CONCEPT" },
  MOC:     { color: "var(--c-moc)",     raw: "#4ade80", label: "MOC"     },
  ADR:     { color: "var(--c-adr)",     raw: "#ff7b72", label: "ADR"     },
  MASTER:  { color: "var(--c-master)",  raw: "#ffa657", label: "MASTER"  },
  TAG:     { color: "var(--c-tag)",     raw: "#6b7390", label: "TAG"     },
};
