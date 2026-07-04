-- Supabase SQL Schema for TenderIQ

-- 1. Create Tenders Table
CREATE TABLE IF NOT EXISTS public.tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Processing' CHECK (status IN ('Active', 'Submitted', 'Expired', 'Processing', 'Failed')),
    deadline TIMESTAMP WITH TIME ZONE,
    file_size BIGINT NOT NULL,
    page_count INT,
    extracted_text TEXT,
    analysis_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Tenders
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

-- Create Policies for Tenders
CREATE POLICY "Users can create their own tenders" 
ON public.tenders FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tenders" 
ON public.tenders FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tenders" 
ON public.tenders FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tenders" 
ON public.tenders FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 2. Create Tender Q&A Table for chat history
CREATE TABLE IF NOT EXISTS public.tender_qa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Tender Q&A
ALTER TABLE public.tender_qa ENABLE ROW LEVEL SECURITY;

-- Create Policies for Tender Q&A
CREATE POLICY "Users can insert their own QA" 
ON public.tender_qa FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own QA" 
ON public.tender_qa FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own QA" 
ON public.tender_qa FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 3. Enable pgvector and create Chunking table for RAG
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.tender_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    chunk_content TEXT NOT NULL,
    page_number INT,
    embedding vector(768), -- Google Gemini Text Embeddings use 768 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Chunks
ALTER TABLE public.tender_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tender chunks"
ON public.tender_chunks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenders 
        WHERE public.tenders.id = public.tender_chunks.tender_id 
          AND public.tenders.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own tender chunks"
ON public.tender_chunks FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tenders 
        WHERE public.tenders.id = public.tender_chunks.tender_id 
          AND public.tenders.user_id = auth.uid()
    )
);

-- Cosine Similarity Matching Function
CREATE OR REPLACE FUNCTION match_tender_chunks (
    query_embedding vector(768),
    match_threshold FLOAT,
    match_count INT,
    filter_tender_id UUID
)
RETURNS TABLE (
    id UUID,
    chunk_content TEXT,
    page_number INT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tender_chunks.id,
        tender_chunks.chunk_content,
        tender_chunks.page_number,
        1 - (tender_chunks.embedding <=> query_embedding) AS similarity
    FROM tender_chunks
    WHERE tender_chunks.tender_id = filter_tender_id
      AND 1 - (tender_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY tender_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

