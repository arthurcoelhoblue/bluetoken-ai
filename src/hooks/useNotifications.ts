import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  empresa: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  entity_id: string | null;
  entity_type: string | null;
  lida: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permissionAsked = useRef(false);

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []) as unknown as AppNotification[];
    },
  });

  const unreadCount = query.data?.filter(n => !n.lida).length ?? 0;

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          // Browser push notification
          const notif = payload.new as AppNotification;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notif.titulo, { body: notif.mensagem });
          }
        }
      )
      .subscribe();

    // Ask for notification permission once
    if (!permissionAsked.current && 'Notification' in window && Notification.permission === 'default') {
      permissionAsked.current = true;
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ lida: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ lida: true })
        .eq('user_id', user!.id)
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { ...query, unreadCount, markAsRead, markAllAsRead };
}
