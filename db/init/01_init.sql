-- Enable pgvector extension
CREATE EXTENSION
IF NOT EXISTS vector;

-- Documents table (embedding dimension: 1536 for text-embedding-3-small)
CREATE TABLE
IF NOT EXISTS documents
(
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector
(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP
WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column
()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_documents_updated_at
ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE
UPDATE ON documents
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column
();

-- Optional indexes (enable when data grows)
-- IVFFlat (approximate search)
-- CREATE INDEX IF NOT EXISTS documents_embedding_ivfflat_idx
--   ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- HNSW (higher recall)
-- CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
--   ON documents USING hnsw (embedding vector_cosine_ops);
