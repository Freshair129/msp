use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub labels: Vec<String>,
    pub props: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub id: String,
    pub from: String,
    pub to: String,
    pub rel: String,
    pub props: serde_json::Value,
    pub valid_from: String,
    pub valid_to: Option<String>,
    pub recorded_at: String,
    pub superseded_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", content = "payload")]
pub enum Event {
    #[serde(rename = "node")]
    Node(Node),
    #[serde(rename = "edge")]
    Edge(Edge),
    #[serde(rename = "edge_retract")]
    EdgeRetract(Edge),
}

pub struct Storage {
    path: PathBuf,
    nodes: HashMap<String, Node>,
    edges: HashMap<String, Edge>,
    out_idx: HashMap<String, HashSet<String>>,
    in_idx: HashMap<String, HashSet<String>>,
    file: Option<File>,
}

impl Storage {
    pub fn open(path: &Path, read_only: bool) -> Result<Self, String> {
        let mut storage = Self {
            path: path.to_path_buf(),
            nodes: HashMap::new(),
            edges: HashMap::new(),
            out_idx: HashMap::new(),
            in_idx: HashMap::new(),
            file: None,
        };

        let jsonl_path = path.join("genesis-graph.jsonl");
        if jsonl_path.exists() {
            let file = File::open(&jsonl_path).map_err(|e| e.to_string())?;
            let reader = BufReader::new(file);
            for line in reader.lines() {
                let line = line.map_err(|e| e.to_string())?;
                if line.trim().is_empty() {
                    continue;
                }
                let event: Event = serde_json::from_str(&line).map_err(|e| e.to_string())?;
                storage.apply(event);
            }
        }

        if !read_only {
            std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
            let file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&jsonl_path)
                .map_err(|e| e.to_string())?;
            storage.file = Some(file);
        }

        Ok(storage)
    }

    fn apply(&mut self, event: Event) {
        match event {
            Event::Node(n) => {
                self.nodes.insert(n.id.clone(), n);
            }
            Event::Edge(e) | Event::EdgeRetract(e) => {
                self.index_edge(&e);
                self.edges.insert(e.id.clone(), e);
            }
        }
    }

    fn index_edge(&mut self, e: &Edge) {
        self.out_idx.entry(e.from.clone()).or_default().insert(e.id.clone());
        self.in_idx.entry(e.to.clone()).or_default().insert(e.id.clone());
    }

    pub fn add_node(&mut self, id: Option<String>, labels: Vec<String>, props: serde_json::Value) -> Result<Node, String> {
        let node_id = id.unwrap_or_else(|| {
            use sha2::{Sha256, Digest};
            let labels_str = labels.join(":");
            let props_str = props.to_string();
            let mut hasher = Sha256::new();
            hasher.update(format!("N-{}::{}", labels_str, props_str));
            let hash = hex::encode(hasher.finalize());
            format!("N-{}", &hash[..16])
        });

        if let Some(existing) = self.nodes.get(&node_id) {
            let mut merged_labels = existing.labels.clone();
            for l in labels {
                if !merged_labels.contains(&l) {
                    merged_labels.push(l);
                }
            }
            let mut merged_props = existing.props.as_object().cloned().unwrap_or_default();
            if let Some(new_props) = props.as_object() {
                for (k, v) in new_props {
                    merged_props.insert(k.clone(), v.clone());
                }
            }
            let node = Node {
                id: node_id,
                labels: merged_labels,
                props: serde_json::Value::Object(merged_props),
            };
            self.persist(Event::Node(node.clone()))?;
            self.nodes.insert(node.id.clone(), node.clone());
            return Ok(node);
        }

        let node = Node { id: node_id, labels, props };
        self.persist(Event::Node(node.clone()))?;
        self.nodes.insert(node.id.clone(), node.clone());
        Ok(node)
    }

    pub fn add_edge(&mut self, id: Option<String>, from: String, to: String, rel: String, props: serde_json::Value, valid_from: Option<String>, supersede: bool) -> Result<Edge, String> {
        if !self.nodes.contains_key(&from) {
            return Err(format!("addEdge: unknown from-node {}", from));
        }
        if !self.nodes.contains_key(&to) {
            return Err(format!("addEdge: unknown to-node {}", to));
        }

        let now = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let edge_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let valid_from = valid_from.unwrap_or_else(|| now.clone());

        if supersede {
            let victims: Vec<String> = self.out_idx.get(&from)
                .map(|ids| ids.iter()
                    .filter_map(|eid| self.edges.get(eid))
                    .filter(|e| e.rel == rel && e.valid_to.is_none() && e.id != edge_id)
                    .map(|e| e.id.clone())
                    .collect()
                ).unwrap_or_default();

            for vid in victims {
                let v = self.edges.get(&vid).unwrap();
                let retired = Edge {
                    valid_to: Some(valid_from.clone()),
                    superseded_by: Some(edge_id.clone()),
                    ..v.clone()
                };
                self.persist(Event::EdgeRetract(retired.clone()))?;
                self.edges.insert(vid, retired);
            }
        }

        let edge = Edge {
            id: edge_id,
            from,
            to,
            rel,
            props,
            valid_from,
            valid_to: None,
            recorded_at: now,
            superseded_by: None,
        };

        self.persist(Event::Edge(edge.clone()))?;
        self.index_edge(&edge);
        self.edges.insert(edge.id.clone(), edge.clone());
        Ok(edge)
    }

    pub fn query(&self, from: Option<String>, to: Option<String>, rel: Option<String>, as_of: Option<String>, include_invalid: bool, limit: Option<usize>) -> Vec<Edge> {
        let as_of_ms = as_of.map(|s| chrono::DateTime::parse_from_rfc3339(&s).ok()).flatten();
        
        let mut results = Vec::new();
        let iter: Box<dyn Iterator<Item = &Edge>> = if let Some(f) = &from {
            Box::new(self.out_idx.get(f).into_iter().flat_map(|ids| ids.iter().filter_map(|id| self.edges.get(id))))
        } else if let Some(t) = &to {
            Box::new(self.in_idx.get(t).into_iter().flat_map(|ids| ids.iter().filter_map(|id| self.edges.get(id))))
        } else {
            Box::new(self.edges.values())
        };

        for e in iter {
            if let Some(f) = &from { if &e.from != f { continue; } }
            if let Some(t) = &to { if &e.to != t { continue; } }
            if let Some(r) = &rel { if &e.rel != r { continue; } }
            
            if !include_invalid && !self.is_edge_valid_at(e, as_of_ms) {
                continue;
            }

            results.push(e.clone());
            if let Some(l) = limit {
                if results.len() >= l { break; }
            }
        }
        results
    }

    fn is_edge_valid_at(&self, edge: &Edge, as_of: Option<chrono::DateTime<chrono::FixedOffset>>) -> bool {
        let from_time = chrono::DateTime::parse_from_rfc3339(&edge.valid_from).ok();
        if let Some(as_of_time) = as_of {
            if let Some(ft) = from_time {
                if as_of_time < ft { return false; }
            }
            if let Some(vt_str) = &edge.valid_to {
                if let Ok(vt) = chrono::DateTime::parse_from_rfc3339(vt_str) {
                    return as_of_time < vt;
                }
            }
            true
        } else {
            edge.valid_to.is_none()
        }
    }

    pub fn neighbors(&self, seed: String, depth: usize, rel: Option<String>, direction: String, as_of: Option<String>, include_invalid: bool, limit: Option<usize>) -> Vec<(Node, Vec<Edge>, usize)> {
        if !self.nodes.contains_key(&seed) { return Vec::new(); }

        let as_of_ms = as_of.map(|s| chrono::DateTime::parse_from_rfc3339(&s).ok()).flatten();
        let mut results = Vec::new();
        let mut visited = HashSet::new();
        visited.insert(seed.clone());

        struct Frame { id: String, path: Vec<Edge>, hops: usize }
        let mut queue = std::collections::VecDeque::new();
        queue.push_back(Frame { id: seed, path: Vec::new(), hops: 0 });

        let limit = limit.unwrap_or(usize::MAX);

        while let Some(frame) = queue.pop_front() {
            if frame.hops >= depth { continue; }

            let empty = HashSet::new();
            let mut edge_ids = HashSet::new();
            if direction == "out" || direction == "both" {
                if let Some(ids) = self.out_idx.get(&frame.id) {
                    edge_ids.extend(ids.iter().cloned());
                }
            }
            if direction == "in" || direction == "both" {
                if let Some(ids) = self.in_idx.get(&frame.id) {
                    edge_ids.extend(ids.iter().cloned());
                }
            }

            for eid in edge_ids {
                let edge = self.edges.get(&eid).unwrap();
                if let Some(r) = &rel { if &edge.rel != r { continue; } }
                if !include_invalid && !self.is_edge_valid_at(edge, as_of_ms) { continue; }

                let next = if edge.from == frame.id { &edge.to } else { &edge.from };
                if visited.contains(next) { continue; }
                visited.insert(next.clone());

                if let Some(node) = self.nodes.get(next) {
                    let mut path = frame.path.clone();
                    path.push(edge.clone());
                    let hops = frame.hops + 1;
                    results.push((node.clone(), path.clone(), hops));
                    if results.len() >= limit { return results; }
                    queue.push_back(Frame { id: next.clone(), path, hops });
                }
            }
        }
        results
    }

    pub fn flush(&mut self) -> Result<(), String> {
        if let Some(file) = &mut self.file {
            file.sync_all().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn persist(&mut self, event: Event) -> Result<(), String> {
        if let Some(file) = &mut self.file {
            let line = serde_json::to_string(&event).map_err(|e| e.to_string())?;
            writeln!(file, "{}", line).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn size(&self) -> (usize, usize) {
        (self.nodes.len(), self.edges.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_node_operations() {
        let dir = tempdir().unwrap();
        let mut storage = Storage::open(dir.path(), false).unwrap();

        let n1 = storage.add_node(Some("u:1".to_string()), vec!["User".to_string()], serde_json::json!({"name": "Alice"})).unwrap();
        assert_eq!(n1.id, "u:1");

        // Test merge
        let n2 = storage.add_node(Some("u:1".to_string()), vec!["Admin".to_string()], serde_json::json!({"role": "root"})).unwrap();
        assert_eq!(n2.labels.len(), 2);
        assert!(n2.labels.contains(&"User".to_string()));
        assert!(n2.labels.contains(&"Admin".to_string()));
        assert_eq!(n2.props["role"], "root");
        assert_eq!(n2.props["name"], "Alice");
    }

    #[test]
    fn test_edge_operations_and_query() {
        let dir = tempdir().unwrap();
        let mut storage = Storage::open(dir.path(), false).unwrap();

        storage.add_node(Some("a".to_string()), vec!["X".to_string()], serde_json::json!({})).unwrap();
        storage.add_node(Some("b".to_string()), vec!["X".to_string()], serde_json::json!({})).unwrap();

        let e1 = storage.add_edge(None, "a".to_string(), "b".to_string(), "KNOWS".to_string(), serde_json::json!({}), None, false).unwrap();
        
        let results = storage.query(Some("a".to_string()), None, None, None, false, None);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, e1.id);

        // Test neighbors
        let neighbors = storage.neighbors("a".to_string(), 1, None, "out".to_string(), None, false, None);
        assert_eq!(neighbors.len(), 1);
        assert_eq!(neighbors[0].0.id, "b");
    }

    #[test]
    fn test_supersede() {
        let dir = tempdir().unwrap();
        let mut storage = Storage::open(dir.path(), false).unwrap();

        storage.add_node(Some("u".to_string()), vec!["User".to_string()], serde_json::json!({})).unwrap();
        storage.add_node(Some("c1".to_string()), vec!["City".to_string()], serde_json::json!({})).unwrap();
        storage.add_node(Some("c2".to_string()), vec!["City".to_string()], serde_json::json!({})).unwrap();

        storage.add_edge(Some("e1".to_string()), "u".to_string(), "c1".to_string(), "LIVES_IN".to_string(), serde_json::json!({}), Some("2020-01-01T00:00:00Z".to_string()), false).unwrap();
        
        // Supersede e1 with e2
        storage.add_edge(Some("e2".to_string()), "u".to_string(), "c2".to_string(), "LIVES_IN".to_string(), serde_json::json!({}), Some("2021-01-01T00:00:00Z".to_string()), true).unwrap();

        let current = storage.query(Some("u".to_string()), None, Some("LIVES_IN".to_string()), None, false, None);
        assert_eq!(current.len(), 1);
        assert_eq!(current[0].id, "e2");

        let all = storage.query(Some("u".to_string()), None, Some("LIVES_IN".to_string()), None, true, None);
        assert_eq!(all.len(), 2);
    }
}
