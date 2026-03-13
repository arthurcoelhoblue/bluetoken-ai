import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type MediaType = 'audio' | 'image' | 'document' | 'video';

interface MediaAttachmentsProps {
  onMediaReady: (mediaUrl: string, mediaType: MediaType, filename?: string) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES: Record<string, MediaType> = {
  // Audio
  'audio/ogg': 'audio',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/webm': 'audio',
  'audio/mp4': 'audio',
  'audio/m4a': 'audio',
  'audio/aac': 'audio',
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  // Video
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
};

function detectMediaType(file: File): MediaType | null {
  // Check exact MIME match
  if (ACCEPTED_TYPES[file.type]) return ACCEPTED_TYPES[file.type];
  // Fallback by MIME prefix
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  // Fallback by extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt'].includes(ext || '')) return 'document';
  return null;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function MediaAttachments({ onMediaReady, disabled }: MediaAttachmentsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (blob: Blob, filename: string, contentType: string, mediaType: MediaType) => {
    setIsUploading(true);
    try {
      const safeName = sanitizeFilename(filename);
      const storagePath = `outbound/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safeName}`;

      const { error } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, blob, { contentType, upsert: true });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePath);

      onMediaReady(publicUrl.publicUrl, mediaType, filename);
    } catch (err) {
      toast({
        title: 'Erro ao enviar arquivo',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onMediaReady]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const selectedMime = MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
        ? 'audio/ogg; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
        ? 'audio/webm; codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMime });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);

        const rawBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (rawBlob.size < 500) {
          toast({ title: 'Áudio muito curto', variant: 'destructive' });
          return;
        }

        // Keep the real container format — do NOT re-label WebM as OGG
        const isOgg = mediaRecorder.mimeType.includes('ogg');
        const ext = isOgg ? 'ogg' : 'webm';
        const mime = isOgg ? 'audio/ogg; codecs=opus' : 'audio/webm';

        await uploadFile(rawBlob, `audio_${Date.now()}.${ext}`, mime, 'audio');
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err: any) {
      // Distinguish between permission denied vs iframe restriction
      const isPermissionError = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const isIframe = window.self !== window.top;

      if (isPermissionError && isIframe) {
        toast({
          title: 'Microfone bloqueado no preview',
          description: 'Abra o app na URL publicada para usar o microfone, ou anexe um arquivo de áudio.',
          variant: 'destructive',
          duration: 8000,
        });
      } else if (isPermissionError) {
        toast({
          title: 'Microfone não permitido',
          description: 'Permita o acesso ao microfone nas configurações do navegador e tente novamente.',
          variant: 'destructive',
          duration: 6000,
        });
      } else {
        toast({
          title: 'Microfone não disponível',
          description: 'Não foi possível acessar o microfone. Tente anexar um arquivo de áudio.',
          variant: 'destructive',
        });
      }
    }
  }, [uploadFile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const mediaType = detectMediaType(file);
      if (!mediaType) {
        toast({
          title: 'Formato não suportado',
          description: 'Tipos aceitos: PDF, DOC, XLS, PPT, imagens (JPG/PNG), áudios e vídeos.',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }

      // 16MB limit for WhatsApp
      if (file.size > 16 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo é 16MB.',
          variant: 'destructive',
        });
        e.target.value = '';
        return;
      }

      await uploadFile(file, file.name, file.type, mediaType);
      e.target.value = '';
    },
    [uploadFile]
  );

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (isUploading) {
    return (
      <Button size="icon" variant="outline" disabled className="shrink-0">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-destructive animate-pulse">
          ● {formatTime(recordingTime)}
        </span>
        <Button
          size="icon"
          variant="destructive"
          onClick={stopRecording}
          className="shrink-0"
          title="Parar gravação"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button
        size="icon"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="shrink-0"
        title="Anexar arquivo (PDF, imagem, áudio, documento)"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        onClick={startRecording}
        disabled={disabled}
        className="shrink-0"
        title="Gravar áudio"
      >
        <Mic className="h-4 w-4" />
      </Button>
    </div>
  );
}
