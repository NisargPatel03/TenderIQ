-- Supabase SQL Schema for TenderIQ

-- 1. Create Tenders Table
CREATE TABLE IF NOT EXISTS public.tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Submitted', 'Expired')),
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
