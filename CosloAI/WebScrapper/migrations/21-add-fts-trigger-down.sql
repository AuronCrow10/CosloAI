\connect embeddings_db;

DROP TRIGGER IF EXISTS trg_page_chunks_small_search_tsv ON page_chunks_small;
DROP TRIGGER IF EXISTS trg_page_chunks_large_search_tsv ON page_chunks_large;

DROP FUNCTION IF EXISTS update_page_chunks_search_tsv();
