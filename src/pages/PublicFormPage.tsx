import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicFormRenderer } from '@/components/capture-forms/PublicFormRenderer';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CaptureFormField, CaptureFormSettings } from '@/types/captureForms';

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: form, isLoading, error } = useQuery({
    queryKey: ['public-form', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capture_forms')
        .select('*')
        .eq('slug', slug!)
        .eq('status', 'PUBLISHED')
        .single();
      if (error) throw error;
      return {
        ...data,
        fields: (data.fields as unknown as CaptureFormField[]) || [],
        settings: (data.settings as unknown as CaptureFormSettings) || {},
      };
    },
  });

  const handleSubmit = async (answers: Record<string, unknown>) => {
    if (!form) return;
    const { error } = await supabase.functions.invoke('capture-form-submit', {
      body: {
        slug: form.slug,
        answers,
        metadata: {
          user_agent: navigator.userAgent,
          referrer: document.referrer,
          url: window.location.href,
        },
      },
    });
    if (error) {
      toast.error('Erro ao enviar formulário');
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Formulário não encontrado</h1>
          <p className="text-muted-foreground">Este formulário pode ter sido removido ou não está publicado.</p>
        </div>
      </div>
    );
  }

  return (
    <PublicFormRenderer
      fields={form.fields}
      settings={form.settings}
      formName={form.nome}
      onSubmit={handleSubmit}
    />
  );
}
