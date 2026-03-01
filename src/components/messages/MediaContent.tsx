import { useState } from 'react';
import { FileText, Download, MapPin, Users, Image as ImageIcon, Type } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TipoMidia } from '@/types/messaging';

interface MediaContentProps {
  tipoMidia: TipoMidia;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  mediaCaption: string | null;
  conteudo: string;
  isOutbound: boolean;
  transcricaoAudio?: string | null;
}

export function MediaContent({
  tipoMidia,
  mediaUrl,
  mediaCaption,
  mediaFilename,
  conteudo,
  isOutbound,
  transcricaoAudio,
}: MediaContentProps) {
  if (tipoMidia === 'text' || !tipoMidia) {
    return (
      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
        {conteudo}
      </p>
    );
  }

  const captionEl = mediaCaption ? (
    <p className="text-sm mt-1 whitespace-pre-wrap break-words">{mediaCaption}</p>
  ) : null;

  switch (tipoMidia) {
    case 'image':
      return (
        <div className="space-y-1">
          {mediaUrl ? (
            <Dialog>
              <DialogTrigger asChild>
                <img
                  src={mediaUrl}
                  alt={mediaCaption || 'Imagem'}
                  className="max-w-[240px] max-h-[240px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
                  loading="lazy"
                />
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
                <img
                  src={mediaUrl}
                  alt={mediaCaption || 'Imagem'}
                  className="w-full h-full object-contain"
                />
              </DialogContent>
            </Dialog>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <ImageIcon className="h-4 w-4" />
              <span>[Imagem não disponível]</span>
            </div>
          )}
          {captionEl}
        </div>
      );

    case 'video':
      return (
        <div className="space-y-1">
          {mediaUrl ? (
            <video
              src={mediaUrl}
              controls
              className="max-w-[280px] max-h-[200px] rounded-lg"
              preload="metadata"
            />
          ) : (
            <p className="text-sm opacity-70">[Vídeo não disponível]</p>
          )}
          {captionEl}
        </div>
      );

    case 'audio':
      return (
        <div className="space-y-1">
          {mediaUrl ? (
            <audio src={mediaUrl} controls className="max-w-[240px]" preload="metadata" />
          ) : (
            <p className="text-sm opacity-70">[Áudio não disponível]</p>
          )}
          {transcricaoAudio ? (
            <div className={`flex items-start gap-1.5 p-2 rounded-md text-xs ${
              isOutbound ? 'bg-primary-foreground/10' : 'bg-muted-foreground/10'
            }`}>
              <Type className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
              <p className="whitespace-pre-wrap break-words leading-relaxed">{transcricaoAudio}</p>
            </div>
          ) : (
            <p className="text-[10px] opacity-40 italic">(sem transcrição)</p>
          )}
        </div>
      );

    case 'document':
      return (
        <div className="space-y-1">
          {mediaUrl ? (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                isOutbound
                  ? 'border-primary-foreground/20 hover:bg-primary-foreground/10'
                  : 'border-border hover:bg-muted'
              } transition-colors`}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <span className="text-sm truncate max-w-[180px]">
                {mediaFilename || 'Documento'}
              </span>
              <Download className="h-4 w-4 shrink-0 ml-auto" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <FileText className="h-4 w-4" />
              <span>[Documento não disponível]</span>
            </div>
          )}
          {captionEl}
        </div>
      );

    case 'sticker':
      return (
        <div>
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Sticker"
              className="max-w-[120px] max-h-[120px]"
              loading="lazy"
            />
          ) : (
            <p className="text-sm opacity-70">[Sticker]</p>
          )}
        </div>
      );

    case 'location':
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap break-words">{conteudo}</span>
        </div>
      );

    case 'contacts':
      return (
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 shrink-0" />
          <span>{conteudo}</span>
        </div>
      );

    default:
      return (
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {conteudo}
        </p>
      );
  }
}
