/**
 * sync-renewal-triggers
 * 
 * Edge function que busca no SGT (ou Notion) clientes que estão
 * finalizando a declaração de IR e portanto estão em bom timing
 * de renovação. Cria alertas e deals de renovação automaticamente.
 * 
 * Pode ser chamada via cron (pg_cron) ou manualmente.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SgtClient {
  nome: string;
  email: string;
  telefone: string;
  cpf?: string;
  status_declaracao: string; // 'FINALIZADA', 'EM_ANDAMENTO', 'PENDENTE'
  data_finalizacao?: string;
  plano_atual?: string;
  vendedor_responsavel?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { empresa = 'BLUE' } = await req.json().catch(() => ({}));

    // 1. Buscar clientes com declaração finalizada ou quase finalizada
    // Isso pode vir do SGT via API ou de uma tabela intermediária
    const { data: sgtClients, error: sgtError } = await supabase
      .from('sgt_client_status')
      .select('*')
      .eq('empresa', empresa)
      .in('status_declaracao', ['FINALIZADA', 'EM_ANDAMENTO'])
      .is('renewal_deal_created', null);

    if (sgtError) {
      console.error('Erro ao buscar clientes SGT:', sgtError);
      // Fallback: buscar de cs_customers que estão próximos do vencimento
      const { data: csClients } = await supabase
        .from('cs_customers')
        .select('id, nome, email, telefone, plano, data_contrato_fim, vendedor_id')
        .eq('empresa', empresa)
        .eq('status', 'ATIVO')
        .lte('data_contrato_fim', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()) // 60 dias
        .gte('data_contrato_fim', new Date().toISOString());

      if (!csClients || csClients.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Nenhum cliente em timing de renovação encontrado.',
          processed: 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Processar clientes CS próximos do vencimento
      const results = [];
      for (const client of csClients) {
        try {
          // Verificar se já existe deal de renovação aberto
          const { data: existingDeal } = await supabase
            .from('deals')
            .select('id')
            .eq('empresa', empresa)
            .ilike('titulo', `%renovação%${client.nome}%`)
            .in('status', ['ABERTO', 'EM_ANDAMENTO'])
            .limit(1)
            .single();

          if (existingDeal) {
            results.push({ nome: client.nome, status: 'DEAL_JA_EXISTE' });
            continue;
          }

          // Buscar pipeline de renovação ou usar o padrão
          const { data: pipeline } = await supabase
            .from('pipelines')
            .select('id, stages:pipeline_stages(id, nome, ordem)')
            .eq('empresa', empresa)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (!pipeline) {
            results.push({ nome: client.nome, status: 'SEM_PIPELINE' });
            continue;
          }

          const firstStage = (pipeline.stages as any[])?.sort((a: any, b: any) => a.ordem - b.ordem)[0];
          if (!firstStage) {
            results.push({ nome: client.nome, status: 'SEM_STAGE' });
            continue;
          }

          // Criar deal de renovação
          const diasRestantes = Math.ceil(
            (new Date(client.data_contrato_fim).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          );

          const { data: newDeal, error: dealError } = await supabase
            .from('deals')
            .insert({
              titulo: `Renovação - ${client.nome}`,
              empresa,
              pipeline_id: pipeline.id,
              stage_id: firstStage.id,
              vendedor_id: client.vendedor_id,
              valor_estimado: 0,
              status: 'ABERTO',
              origem: 'RENOVACAO_AUTOMATICA',
              notas: `Deal de renovação criado automaticamente.\nPlano atual: ${client.plano || 'N/A'}\nVencimento: ${new Date(client.data_contrato_fim).toLocaleDateString('pt-BR')}\nDias restantes: ${diasRestantes}`,
              metadata: {
                cs_customer_id: client.id,
                tipo: 'RENOVACAO',
                plano_atual: client.plano,
                data_vencimento: client.data_contrato_fim,
                dias_restantes: diasRestantes,
              },
            })
            .select()
            .single();

          if (dealError) {
            results.push({ nome: client.nome, status: 'ERRO_CRIAR_DEAL', error: dealError.message });
            continue;
          }

          // Criar notificação para o vendedor
          if (client.vendedor_id) {
            await supabase.from('notifications').insert({
              user_id: client.vendedor_id,
              tipo: 'RENOVACAO',
              titulo: `Renovação: ${client.nome}`,
              mensagem: `O contrato de ${client.nome} vence em ${diasRestantes} dias. Deal de renovação criado automaticamente.`,
              metadata: { deal_id: newDeal.id, cs_customer_id: client.id },
            });
          }

          results.push({ nome: client.nome, status: 'DEAL_CRIADO', deal_id: newDeal.id, dias_restantes: diasRestantes });
        } catch (err) {
          results.push({ nome: client.nome, status: 'ERRO', error: String(err) });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Processados ${results.length} clientes em timing de renovação.`,
        processed: results.length,
        results,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Processar clientes do SGT
    const results = [];
    for (const client of (sgtClients || [])) {
      try {
        // Buscar contato existente
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('empresa', empresa)
          .or(`email.eq.${client.email},telefone.eq.${client.telefone}`)
          .limit(1)
          .single();

        // Buscar pipeline
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('id, stages:pipeline_stages(id, nome, ordem)')
          .eq('empresa', empresa)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (!pipeline) {
          results.push({ nome: client.nome, status: 'SEM_PIPELINE' });
          continue;
        }

        const firstStage = (pipeline.stages as any[])?.sort((a: any, b: any) => a.ordem - b.ordem)[0];

        // Buscar vendedor pelo nome
        let vendedorId = null;
        if (client.vendedor_responsavel) {
          const { data: vendedor } = await supabase
            .from('profiles')
            .select('id')
            .ilike('full_name', `%${client.vendedor_responsavel}%`)
            .limit(1)
            .single();
          vendedorId = vendedor?.id;
        }

        // Criar deal de renovação
        const { data: newDeal } = await supabase
          .from('deals')
          .insert({
            titulo: `Renovação SGT - ${client.nome}`,
            empresa,
            pipeline_id: pipeline.id,
            stage_id: firstStage?.id,
            vendedor_id: vendedorId,
            contact_id: contact?.id,
            valor_estimado: 0,
            status: 'ABERTO',
            origem: 'SGT_RENOVACAO',
            notas: `Deal de renovação criado via SGT.\nStatus declaração: ${client.status_declaracao}\nPlano atual: ${client.plano_atual || 'N/A'}`,
            metadata: {
              tipo: 'RENOVACAO',
              sgt_status: client.status_declaracao,
              plano_atual: client.plano_atual,
            },
          })
          .select()
          .single();

        // Marcar como processado no SGT
        await supabase
          .from('sgt_client_status')
          .update({ renewal_deal_created: newDeal?.id, processed_at: new Date().toISOString() })
          .eq('email', client.email)
          .eq('empresa', empresa);

        // Notificar vendedor
        if (vendedorId) {
          await supabase.from('notifications').insert({
            user_id: vendedorId,
            tipo: 'RENOVACAO',
            titulo: `Renovação SGT: ${client.nome}`,
            mensagem: `${client.nome} está finalizando a declaração no SGT. Bom timing para renovação!`,
            metadata: { deal_id: newDeal?.id },
          });
        }

        results.push({ nome: client.nome, status: 'DEAL_CRIADO', deal_id: newDeal?.id });
      } catch (err) {
        results.push({ nome: client.nome, status: 'ERRO', error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processados ${results.length} clientes do SGT.`,
      processed: results.length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Erro no sync-renewal-triggers:', err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
