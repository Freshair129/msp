import { Pool, PoolConfig } from 'pg';

export interface PgvectorOptions extends PoolConfig {
  tableName?: string;
}

export interface PgvectorInsertItem {
  id: string;
  store: string;
  source: string;
  chunk_id: string;
  text: string;
  vector: number[];
  metadata: any;
}

export interface PgvectorHit {
  id: string;
  score: number;
  text: string;
  metadata: any;
  source: string;
  chunk_id: string;
  store: string;
}

export class PgvectorManager {
  private pool: Pool;
  private tableName: string;

  constructor(opts: PgvectorOptions) {
    const { tableName, ...poolConfig } = opts;
    this.pool = new Pool(poolConfig);
    this.tableName = tableName || 'gks_vector';
  }

  /**
   * Connect to the database and verify pgvector extension + table existence.
   */
  public async connect() {
    const config = (this.pool as any).options;
    const sanitizedConn = config.connectionString 
      ? config.connectionString.replace(/:[^:]+@/, ':****@')
      : `${config.user}@${config.host}:${config.port}/${config.database}`;
    
    console.log(`msp-bridge: connecting to pgvector at ${sanitizedConn}`);
    
    try {
      // 1. Basic connectivity check
      await this.pool.query('SELECT 1');
      
      // 2. Verify pgvector extension
      const extCheck = await this.pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
      if (extCheck.rows.length === 0) {
        console.warn('msp-bridge: pgvector extension not found in database. Attempting to create...');
        try {
          await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        } catch (err) {
          throw new Error(`pgvector extension missing and could not be created: ${(err as Error).message}`);
        }
      }

      // 3. Verify table existence
      try {
        await this.pool.query(`SELECT 1 FROM ${this.quoteIdent(this.tableName)} LIMIT 0`);
      } catch (err) {
        console.error(`msp-bridge: table ${this.tableName} not found. Please run migrations.`);
        throw new Error(`Vector table '${this.tableName}' missing. Run pg-migrate first.`);
      }

      console.log('msp-bridge: pgvector connection and schema verified');
      return true;
    } catch (err) {
      console.error('msp-bridge: pgvector connection failed', err);
      throw err;
    }
  }

  public async disconnect() {
    await this.pool.end();
    console.log('msp-bridge: pgvector connection closed');
  }

  /**
   * Insert or update a vector document.
   */
  public async insert(item: PgvectorInsertItem) {
    const sql = `
      INSERT INTO ${this.quoteIdent(this.tableName)}
        (id, store, source, chunk_id, text, vector, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb, $8)
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        vector = EXCLUDED.vector,
        metadata = EXCLUDED.metadata,
        source = EXCLUDED.source,
        chunk_id = EXCLUDED.chunk_id,
        store = EXCLUDED.store
    `;
    
    const vectorStr = `[${item.vector.join(',')}]`;
    const createdAt = item.metadata.created_at || new Date().toISOString();
    
    await this.pool.query(sql, [
      item.id,
      item.store,
      item.source,
      item.chunk_id,
      item.text,
      vectorStr,
      JSON.stringify(item.metadata),
      createdAt
    ]);
  }

  /**
   * Search for similar vectors using cosine similarity.
   */
  public async search(vector: number[], limit: number = 10, store?: string): Promise<PgvectorHit[]> {
    let where = '';
    const params: any[] = [`[${vector.join(',')}]`];
    
    if (store) {
      where = 'WHERE store = $2';
      params.push(store);
    }

    const sql = `
      SELECT id, store, source, chunk_id, text, metadata, created_at,
             1 - (vector <=> $1::vector) AS score
      FROM ${this.quoteIdent(this.tableName)}
      ${where}
      ORDER BY vector <=> $1::vector ASC
      LIMIT ${limit}
    `;

    const result = await this.pool.query(sql, params);
    return result.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      text: row.text,
      metadata: row.metadata,
      source: row.source,
      chunk_id: row.chunk_id,
      store: row.store
    }));
  }

  /**
   * Delete a document by ID and store.
   */
  public async delete(id: string, store: string) {
    await this.pool.query(
      `DELETE FROM ${this.quoteIdent(this.tableName)} WHERE id = $1 AND store = $2`,
      [id, store]
    );
  }

  private quoteIdent(ident: string): string {
    return `"${ident.replace(/"/g, '""')}"`;
  }
}
