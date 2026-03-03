import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppConnection {
  id: string;
  label: string | null;
  display_phone: string | null;
  verified_name: string | null;
  is_default: boolean;
}

interface ConnectionPickerProps {
  empresa: string;
  value?: string;
  onChange: (connectionId: string) => void;
  className?: string;
}

export function ConnectionPicker({ empresa, value, onChange, className }: ConnectionPickerProps) {
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['whatsapp-connections', empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_connections' as any)
        .select('id, label, display_phone, verified_name, is_default')
        .eq('empresa', empresa)
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WhatsAppConnection[];
    },
  });

  // Auto-select default on load
  const defaultConn = connections.find((c) => c.is_default) || connections[0];
  const selectedId = value || defaultConn?.id;

  // Auto-notify parent with default connection whenever value is empty
  useEffect(() => {
    if (!isLoading && defaultConn && !value) {
      onChange(defaultConn.id);
    }
  }, [isLoading, defaultConn, value, onChange]);

  // If only 1 connection, show informative badge (no selector)
  if (!isLoading && connections.length === 1) {
    const conn = connections[0];
    return (
      <div className={className}>
        <Badge variant="outline" className="h-7 text-xs font-normal gap-1.5 px-2.5">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {conn.label || conn.display_phone || conn.verified_name || 'WhatsApp'}
        </Badge>
      </div>
    );
  }

  // No connections at all
  if (!isLoading && connections.length === 0) {
    return null;
  }

  if (isLoading) return null;

  const displayLabel = (c: WhatsAppConnection) => {
    const parts: string[] = [];
    if (c.label) parts.push(c.label);
    if (c.display_phone) parts.push(c.display_phone);
    else if (c.verified_name) parts.push(c.verified_name);
    if (c.is_default) parts.push('(padrão)');
    return parts.join(' · ') || c.id.slice(0, 8);
  };

  return (
    <div className={className}>
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <Phone className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Selecionar número..." />
        </SelectTrigger>
        <SelectContent>
          {connections.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {displayLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function useWhatsAppConnections(empresa: string) {
  return useQuery({
    queryKey: ['whatsapp-connections', empresa],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_connections' as any)
        .select('id, label, display_phone, verified_name, is_default')
        .eq('empresa', empresa)
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WhatsAppConnection[];
    },
  });
}
