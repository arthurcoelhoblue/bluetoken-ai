-- Fix overly permissive RLS policies on system_settings, product_knowledge, pipelines, pipeline_stages

-- 1. system_settings: Remove public USING(true) SELECT, add authenticated-only read
DROP POLICY IF EXISTS "Service pode ler configurações" ON public.system_settings;
CREATE POLICY "Authenticated users can read settings"
  ON public.system_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. product_knowledge: Remove public USING(true) SELECT
DROP POLICY IF EXISTS "Service can read product_knowledge" ON public.product_knowledge;
CREATE POLICY "Authenticated users can read product_knowledge"
  ON public.product_knowledge FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. pipelines: Restrict to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can view pipelines" ON public.pipelines;
CREATE POLICY "Authenticated users can view pipelines"
  ON public.pipelines FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. pipeline_stages: Restrict to authenticated users only  
DROP POLICY IF EXISTS "Authenticated users can view pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Authenticated users can view pipeline_stages"
  ON public.pipeline_stages FOR SELECT
  USING (auth.uid() IS NOT NULL);