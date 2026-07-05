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


-- ─── MULTI-TENANCY & COLLABORATION SCHEMAS ───────────────────────────────────

-- 4. Create Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Create Organization Members Table
CREATE TABLE IF NOT EXISTS public.org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Owner', 'Admin', 'Legal Auditor', 'Technical Reviewer', 'Bid Manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (org_id, user_id)
);


-- ─── SECURITY DEFINER FUNCTIONS TO PREVENT RECURSION ─────────────────────────

-- Helper function to check if a user is a member of an organization (bypasses RLS recursively)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid, user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.org_members
        WHERE org_members.org_id = $1
          AND org_members.user_id = $2
    ) OR EXISTS (
        SELECT 1 FROM public.organizations
        WHERE organizations.id = $1
          AND organizations.owner_id = $2
    );
END;
$$;

-- Helper function to check if a user has admin/owner privileges in an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid, user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.org_members
        WHERE org_members.org_id = $1
          AND org_members.user_id = $2
          AND org_members.role IN ('Owner', 'Admin')
    ) OR EXISTS (
        SELECT 1 FROM public.organizations
        WHERE organizations.id = $1
          AND organizations.owner_id = $2
    );
END;
$$;


-- ─── RLS POLICIES FOR ORGANIZATIONS ──────────────────────────────────────────

-- Enable RLS on Organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view organizations they are members of" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners can delete their organizations" ON public.organizations;

CREATE POLICY "Users can view organizations they are members of"
ON public.organizations FOR SELECT
TO authenticated
USING (
    public.is_org_member(id, auth.uid())
);

CREATE POLICY "Owners can update their organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their organizations"
ON public.organizations FOR DELETE
TO authenticated
USING (owner_id = auth.uid());


-- ─── RLS POLICIES FOR MEMBERS ────────────────────────────────────────────────

-- Enable RLS on Members
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view membership list" ON public.org_members;
DROP POLICY IF EXISTS "Owners and Admins can manage memberships" ON public.org_members;

CREATE POLICY "Members can view membership list"
ON public.org_members FOR SELECT
TO authenticated
USING (
    public.is_org_member(org_id, auth.uid())
);

CREATE POLICY "Owners and Admins can manage memberships"
ON public.org_members FOR ALL
TO authenticated
USING (
    public.is_org_admin(org_id, auth.uid())
);


-- ─── ALTER TENDERS TABLE & SCRIPTS ───────────────────────────────────────────

-- 6. Add columns to Tenders Table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenders' AND column_name='org_id') THEN
        ALTER TABLE public.tenders ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenders' AND column_name='kanban_stage') THEN
        ALTER TABLE public.tenders ADD COLUMN kanban_stage TEXT NOT NULL DEFAULT 'Discovered' 
            CHECK (kanban_stage IN ('Discovered', 'Under Audit', 'Approved to Bid', 'Writing Proposal', 'Submitted'));
    END IF;
END $$;


-- Drop old non-org/org-recursive policies from tenders
DROP POLICY IF EXISTS "Users can view their own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can create their own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can update their own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can delete their own tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can create tenders in their organization" ON public.tenders;
DROP POLICY IF EXISTS "Users can view organization tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can update organization tenders" ON public.tenders;
DROP POLICY IF EXISTS "Users can delete organization tenders" ON public.tenders;

CREATE POLICY "Users can create tenders in their organization"
ON public.tenders FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid() AND (
        org_id IS NULL OR public.is_org_member(org_id, auth.uid())
    )
);

CREATE POLICY "Users can view organization tenders"
ON public.tenders FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
);

CREATE POLICY "Users can update organization tenders"
ON public.tenders FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
)
WITH CHECK (
    user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()))
);

CREATE POLICY "Users can delete organization tenders"
ON public.tenders FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_org_admin(org_id, auth.uid()))
);


-- ─── RLS POLICIES FOR COMMENTS ───────────────────────────────────────────────

-- 7. Create Clause Comments Table
CREATE TABLE IF NOT EXISTS public.clause_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    clause_text TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on Clause Comments
ALTER TABLE public.clause_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comments on organization tenders" ON public.clause_comments;
DROP POLICY IF EXISTS "Users can add comments to organization tenders" ON public.clause_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.clause_comments;

CREATE POLICY "Users can view comments on organization tenders"
ON public.clause_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tenders
        WHERE tenders.id = clause_comments.tender_id
          AND (tenders.user_id = auth.uid() OR (tenders.org_id IS NOT NULL AND public.is_org_member(tenders.org_id, auth.uid())))
    )
);

CREATE POLICY "Users can add comments to organization tenders"
ON public.clause_comments FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.tenders
        WHERE tenders.id = clause_comments.tender_id
          AND (tenders.user_id = auth.uid() OR (tenders.org_id IS NOT NULL AND public.is_org_member(tenders.org_id, auth.uid())))
    )
);

CREATE POLICY "Users can delete their own comments"
ON public.clause_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid());


-- 8. RPC function to get user id by email (for invitations)
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_addr text)
RETURNS uuid
SECURITY DEFINER -- Runs with elevated permissions to read auth.users
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    target_id uuid;
BEGIN
    SELECT id INTO target_id
    FROM auth.users
    WHERE email = email_addr;
    
    RETURN target_id;
END;
$$;


