import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import type {
  ImportJob,
  ImportConfig,
  ImportProgress,
  PipedriveDealRow,
  PipedrivePersonRow,
  PipedriveOrgRow,
} from '@/types/importacao';
import { useState } from 'react';

function useEmpresa() {
  const { activeCompany } = useCompany();
  const map: Record<string, string> = { blue: 'BLUE', tokeniza: 'TOKENIZA' };
  return map[activeCompany] || activeCompany?.toUpperCase() || 'BLUE';
}

const STATUS_MAP: Record<string, string> = { won: 'GANHO', lost: 'PERDIDO', open: 'ABERTO' };

export function useImportJobs() {
  const empresa = useEmpresa();
  return useQuery({
    queryKey: ['import-jobs', empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs_summary' as any)
        .select('*')
        .eq('empresa', empresa)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ImportJob[];
    },
  });
}

export function useRunImport() {
  const empresa = useEmpresa();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (params: {
      orgs: PipedriveOrgRow[];
      persons: PipedrivePersonRow[];
      deals: PipedriveDealRow[];
      config: ImportConfig;
    }) => {
      const { orgs, persons, deals, config } = params;
      const totalRecords = orgs.length + persons.length + deals.length;
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const errorLog: any[] = [];

      // 1. Create job
      const { data: job, error: jobErr } = await supabase
        .from('import_jobs')
        .insert({
          tipo: 'PIPEDRIVE_FULL',
          empresa: empresa as any,
          status: 'RUNNING',
          total_records: totalRecords,
          config: config as any,
          started_by: profile?.id,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (jobErr || !job) throw jobErr || new Error('Failed to create import job');
      const jobId = job.id;

      // Helper: insert mapping
      const addMapping = async (entityType: string, sourceId: string, targetId: string) => {
        await supabase.from('import_mapping').upsert(
          { import_job_id: jobId, entity_type: entityType, source_id: String(sourceId), target_id: targetId, empresa: empresa as any },
          { onConflict: 'entity_type,source_id,empresa' }
        );
      };

      // Helper: lookup mapping
      const getMapping = async (entityType: string, sourceId: string): Promise<string | null> => {
        const { data } = await supabase
          .from('import_mapping')
          .select('target_id')
          .eq('entity_type', entityType)
          .eq('source_id', String(sourceId))
          .eq('empresa', empresa as any)
          .maybeSingle();
        return data?.target_id || null;
      };

      // 2. Import Orgs
      setProgress({ phase: 'orgs', current: 0, total: orgs.length, imported, skipped, errors });
      for (let i = 0; i < orgs.length; i++) {
        const org = orgs[i];
        try {
          if (config.skip_existing) {
            const existing = await getMapping('ORGANIZATION', String(org.id));
            if (existing) { skipped++; setProgress({ phase: 'orgs', current: i + 1, total: orgs.length, imported, skipped, errors }); continue; }
          }
          const { data: inserted, error: insErr } = await supabase
            .from('organizations')
            .insert({
              nome: org.name || `Org ${org.id}`,
              empresa: empresa as any,
              endereco: org.address || null,
            })
            .select('id')
            .single();
          if (insErr) throw insErr;
          await addMapping('ORGANIZATION', String(org.id), inserted.id);
          imported++;
        } catch (e: any) {
          errors++;
          errorLog.push({ entity: 'ORG', source_id: org.id, error: e.message });
        }
        setProgress({ phase: 'orgs', current: i + 1, total: orgs.length, imported, skipped, errors });
      }

      // 3. Import Persons -> Contacts
      setProgress({ phase: 'contacts', current: 0, total: persons.length, imported, skipped, errors });
      for (let i = 0; i < persons.length; i++) {
        const p = persons[i];
        try {
          if (config.skip_existing) {
            const existing = await getMapping('CONTACT', String(p.id));
            if (existing) { skipped++; setProgress({ phase: 'contacts', current: i + 1, total: persons.length, imported, skipped, errors }); continue; }
          }
          const email = Array.isArray(p.email) ? p.email.find(e => e.primary)?.value || p.email[0]?.value : p.email || null;
          const phone = Array.isArray(p.phone) ? p.phone.find(ph => ph.primary)?.value || p.phone[0]?.value : p.phone || null;
          const orgSourceId = typeof p.org_id === 'object' ? (p.org_id as any)?.value : p.org_id;
          const orgId = orgSourceId ? await getMapping('ORGANIZATION', String(orgSourceId)) : null;

          const { data: inserted, error: insErr } = await supabase
            .from('contacts')
            .insert({
              nome: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Person ${p.id}`,
              primeiro_nome: p.first_name || null,
              sobrenome: p.last_name || null,
              email,
              telefone: phone,
              empresa: empresa as any,
              organization_id: orgId,
            })
            .select('id')
            .single();
          if (insErr) throw insErr;
          await addMapping('CONTACT', String(p.id), inserted.id);
          imported++;
        } catch (e: any) {
          errors++;
          errorLog.push({ entity: 'CONTACT', source_id: p.id, error: e.message });
        }
        setProgress({ phase: 'contacts', current: i + 1, total: persons.length, imported, skipped, errors });
      }

      // 4. Import Deals
      setProgress({ phase: 'deals', current: 0, total: deals.length, imported, skipped, errors });
      for (let i = 0; i < deals.length; i++) {
        const d = deals[i];
        try {
          if (config.skip_existing) {
            const existing = await getMapping('DEAL', String(d.id));
            if (existing) { skipped++; setProgress({ phase: 'deals', current: i + 1, total: deals.length, imported, skipped, errors }); continue; }
          }
          const contactId = d.person_id ? await getMapping('CONTACT', String(d.person_id)) : null;
          if (!contactId) {
            skipped++;
            errorLog.push({ entity: 'DEAL', source_id: d.id, error: 'Contact not mapped (person_id missing or not imported)' });
            setProgress({ phase: 'deals', current: i + 1, total: deals.length, imported, skipped, errors });
            continue;
          }
          const orgId = d.org_id ? await getMapping('ORGANIZATION', String(d.org_id)) : null;
          const pipelineId = config.pipeline_mapping?.[String(d.pipeline_id)];
          const stageId = config.stage_mapping?.[String(d.stage_id)];
          if (!pipelineId || !stageId) {
            skipped++;
            errorLog.push({ entity: 'DEAL', source_id: d.id, error: 'Pipeline or stage not mapped' });
            setProgress({ phase: 'deals', current: i + 1, total: deals.length, imported, skipped, errors });
            continue;
          }
          const status = STATUS_MAP[d.status || 'open'] || 'ABERTO';

          const insertData: any = {
            titulo: d.title || `Deal ${d.id}`,
            valor: d.value || 0,
            moeda: d.currency || 'BRL',
            status,
            pipeline_id: pipelineId,
            stage_id: stageId,
            contact_id: contactId,
            organization_id: orgId,
            notas: d.note || null,
            canal_origem: 'PIPEDRIVE_IMPORT',
          };

          if (status === 'GANHO' && d.won_time) {
            insertData.fechado_em = d.won_time;
            insertData.data_ganho = d.won_time;
          }
          if (status === 'PERDIDO') {
            insertData.fechado_em = d.lost_time || d.close_time || null;
            insertData.data_perda = d.lost_time || d.close_time || null;
            insertData.motivo_perda = d.lost_reason || null;
          }

          const { data: inserted, error: insErr } = await supabase
            .from('deals')
            .insert(insertData)
            .select('id')
            .single();
          if (insErr) throw insErr;
          await addMapping('DEAL', String(d.id), inserted.id);
          imported++;
        } catch (e: any) {
          errors++;
          errorLog.push({ entity: 'DEAL', source_id: d.id, error: e.message });
        }
        setProgress({ phase: 'deals', current: i + 1, total: deals.length, imported, skipped, errors });
      }

      // 5. Finalize
      const finalStatus = errors > 0 ? (imported > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
      await supabase
        .from('import_jobs')
        .update({
          status: finalStatus,
          imported,
          skipped,
          errors,
          error_log: errorLog as any,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      setProgress({ phase: 'done', current: totalRecords, total: totalRecords, imported, skipped, errors });
      return { jobId, imported, skipped, errors, errorLog, status: finalStatus };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });

  return { ...mutation, progress };
}
