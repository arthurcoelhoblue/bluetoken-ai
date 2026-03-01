import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  onAudioReady: (audioUrl: string) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onAudioReady, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAudio = useCallback(async (blob: Blob, ext: string) => {
    setIsUploading(true);
    try {
      const fileName = `outbound_${Date.now()}.${ext}`;
      const storagePath = `outbound/${new Date().toISOString().slice(0, 10)}/${fileName}`;

      const { error } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePath, blob, {
          contentType: ext === 'ogg' ? 'audio/ogg; codecs=opus' : `audio/${ext}`,
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePath);

      onAudioReady(publicUrl.publicUrl);
    } catch (err) {
      toast({
        title: 'Erro ao enviar áudio',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onAudioReady]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
          ? 'audio/ogg; codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size < 500) {
          toast({ title: 'Áudio muito curto', variant: 'destructive' });
          return;
        }
        const ext = mediaRecorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
        await uploadAudio(blob, ext);
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({
        title: 'Microfone não disponível',
        description: 'Permita o acesso ao microfone no navegador.',
        variant: 'destructive',
      });
    }
  }, [uploadAudio]);

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

      const validTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/m4a'];
      if (!validTypes.some((t) => file.type.startsWith(t.split('/')[0]))) {
        toast({ title: 'Formato de áudio não suportado', variant: 'destructive' });
        return;
      }

      const ext = file.name.split('.').pop() || 'ogg';
      await uploadAudio(file, ext);
      e.target.value = '';
    },
    [uploadAudio]
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
        accept="audio/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button
        size="icon"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="shrink-0"
        title="Enviar arquivo de áudio"
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
