//! Genesis Block — embedded graph engine for GKS.
//!
//! Phase 3.2 Storage MVP:
//! - Full implementation of GraphBackend FFI surface.
//! - Async execution via tokio::task::spawn_blocking.
//! - JSONL append-log persistence (backward compatible).

#![deny(clippy::all)]

mod storage;

use std::sync::Arc;
use std::path::Path;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use parking_lot::RwLock;
use crate::storage::{Storage, Node, Edge};

/// On-disk schema version recognised by this engine.
pub const SCHEMA_VERSION: u32 = 1;

#[napi(object)]
pub struct OpenOptions {
    pub path: String,
    pub page_cache_mb: Option<u32>,
    pub read_only: Option<bool>,
}

#[napi(object)]
pub struct NodeInput {
    pub id: Option<String>,
    pub labels: Vec<String>,
    pub props: Option<serde_json::Value>,
}

#[napi(object)]
pub struct NodeOutput {
    pub id: String,
    pub labels: Vec<String>,
    pub props: serde_json::Value,
}

impl From<Node> for NodeOutput {
    fn from(n: Node) -> Self {
        Self {
            id: n.id,
            labels: n.labels,
            props: n.props,
        }
    }
}

#[napi(object)]
pub struct EdgeInput {
    pub id: Option<String>,
    pub from: String,
    pub to: String,
    pub rel: String,
    pub props: Option<serde_json::Value>,
    pub valid_from: Option<String>,
    pub supersede: Option<bool>,
}

#[napi(object)]
pub struct EdgeOutput {
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

impl From<Edge> for EdgeOutput {
    fn from(e: Edge) -> Self {
        Self {
            id: e.id,
            from: e.from,
            to: e.to,
            rel: e.rel,
            props: e.props,
            valid_from: e.valid_from,
            valid_to: e.valid_to,
            recorded_at: e.recorded_at,
            superseded_by: e.superseded_by,
        }
    }
}

#[napi(object)]
pub struct QueryInput {
    pub from: Option<String>,
    pub to: Option<String>,
    pub rel: Option<String>,
    pub as_of: Option<String>,
    pub include_invalid: Option<bool>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct NeighborInput {
    pub depth: Option<u32>,
    pub rel: Option<String>,
    pub direction: Option<String>, // "out" | "in" | "both"
    pub as_of: Option<String>,
    pub include_invalid: Option<bool>,
    pub limit: Option<u32>,
}

#[napi(object)]
pub struct NeighborOutput {
    pub node: NodeOutput,
    pub path: Vec<EdgeOutput>,
    pub depth: u32,
}

#[napi]
pub struct GenesisDatabase {
    inner: Arc<RwLock<Storage>>,
}

#[napi]
impl GenesisDatabase {
    #[napi(factory)]
    pub fn open(opts: OpenOptions) -> Result<Self> {
        let read_only = opts.read_only.unwrap_or(false);
        let storage = Storage::open(Path::new(&opts.path), read_only)
            .map_err(|e| Error::from_reason(format!("genesis-block: io: {}", e)))?;
        
        Ok(Self {
            inner: Arc::new(RwLock::new(storage)),
        })
    }

    #[napi]
    pub async fn add_node(&self, input: NodeInput) -> Result<NodeOutput> {
        let inner = Arc::clone(&self.inner);
        tokio::task::spawn_blocking(move || {
            let mut lock = inner.write();
            lock.add_node(input.id, input.labels, input.props.unwrap_or(serde_json::Value::Object(Default::default())))
                .map(NodeOutput::from)
        })
        .await
        .map_err(|e| Error::from_reason(format!("join: {}", e)))?
        .map_err(|e| Error::from_reason(format!("genesis-block: internal: {}", e)))
    }

    #[napi]
    pub async fn add_edge(&self, input: EdgeInput) -> Result<EdgeOutput> {
        let inner = Arc::clone(&self.inner);
        tokio::task::spawn_blocking(move || {
            let mut lock = inner.write();
            lock.add_edge(
                input.id,
                input.from,
                input.to,
                input.rel,
                input.props.unwrap_or(serde_json::Value::Object(Default::default())),
                input.valid_from,
                input.supersede.unwrap_or(false),
            )
            .map(EdgeOutput::from)
        })
        .await
        .map_err(|e| Error::from_reason(format!("join: {}", e)))?
        .map_err(|e| Error::from_reason(format!("genesis-block: internal: {}", e)))
    }

    #[napi]
    pub async fn retract_edge(&self, id: String, at: Option<String>) -> Result<Option<EdgeOutput>> {
        // P3.3 scope, stub for now per DOD.
        let _ = id;
        let _ = at;
        Err(Error::from_reason("genesis-block: internal: retract_edge Lands in P3.3"))
    }

    #[napi]
    pub async fn query(&self, q: QueryInput) -> Result<Vec<EdgeOutput>> {
        let inner = Arc::clone(&self.inner);
        tokio::task::spawn_blocking(move || {
            let lock = inner.read();
            lock.query(
                q.from,
                q.to,
                q.rel,
                q.as_of,
                q.include_invalid.unwrap_or(false),
                q.limit.map(|l| l as usize),
            )
            .into_iter()
            .map(EdgeOutput::from)
            .collect()
        })
        .await
        .map_err(|e| Error::from_reason(format!("join: {}", e)))
    }

    #[napi]
    pub async fn neighbors(&self, seed: String, q: NeighborInput) -> Result<Vec<NeighborOutput>> {
        let inner = Arc::clone(&self.inner);
        tokio::task::spawn_blocking(move || {
            let lock = inner.read();
            lock.neighbors(
                seed,
                q.depth.unwrap_or(1) as usize,
                q.rel,
                q.direction.unwrap_or_else(|| "out".to_string()),
                q.as_of,
                q.include_invalid.unwrap_or(false),
                q.limit.map(|l| l as usize),
            )
            .into_iter()
            .map(|(n, p, d)| NeighborOutput {
                node: NodeOutput::from(n),
                path: p.into_iter().map(EdgeOutput::from).collect(),
                depth: d as u32,
            })
            .collect()
        })
        .await
        .map_err(|e| Error::from_reason(format!("join: {}", e)))
    }

    #[napi]
    pub async fn cypher(&self, query: String, _params: Option<serde_json::Value>) -> Result<Vec<serde_json::Value>> {
        let _ = query;
        Err(Error::from_reason("genesis-block: parse: cypher: v0 stub — implementation lands in P3.4"))
    }

    #[napi]
    pub async fn flush(&self) -> Result<()> {
        let inner = Arc::clone(&self.inner);
        tokio::task::spawn_blocking(move || {
            let mut lock = inner.write();
            lock.flush()
        })
        .await
        .map_err(|e| Error::from_reason(format!("join: {}", e)))?
        .map_err(|e| Error::from_reason(format!("genesis-block: io: {}", e)))
    }

    #[napi]
    pub async fn close(&self) -> Result<()> {
        let inner = Arc::clone(&self.inner);
        tokio::task::spawn_blocking(move || {
            let mut lock = inner.write();
            lock.flush()
            // RwLock is dropped when Arc is dropped, but we can't easily force it here
            // without taking Ownership, which we can't do via &self.
            // In NAPI-RS, the JS object GC will drop the Rust struct.
            Ok(())
        })
        .await
        .map_err(|e| Error::from_reason(format!("join: {}", e)))?
    }

    #[napi(js_name = "statusSync")]
    pub fn status_sync(&self) -> serde_json::Value {
        let lock = self.inner.read();
        let (n, e) = lock.size();
        serde_json::json!({
            "open": true,
            "nodes": n,
            "edges": e
        })
    }

    #[napi(js_name = "schemaVersionSync")]
    pub fn schema_version_sync(&self) -> u32 {
        SCHEMA_VERSION
    }

    #[napi(js_name = "engineNameSync")]
    pub fn engine_name_sync(&self) -> String {
        "genesis-block".to_string()
    }
}
