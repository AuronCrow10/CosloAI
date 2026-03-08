\connect embeddings_db;

DROP INDEX IF EXISTS idx_page_chunks_small_client_source_chunk_index;
DROP INDEX IF EXISTS idx_page_chunks_large_client_source_chunk_index;

ALTER TABLE page_chunks_small
  DROP COLUMN IF EXISTS source_id;

ALTER TABLE page_chunks_large
  DROP COLUMN IF EXISTS source_id;
