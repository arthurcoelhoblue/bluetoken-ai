import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface ShareFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  formName: string;
}

export function ShareFormDialog({ open, onOpenChange, slug, formName }: ShareFormDialogProps) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/f/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar: {formName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copie o link abaixo para compartilhar o formulário publicamente.
          </p>
          <div className="flex gap-2">
            <Input value={publicUrl} readOnly className="flex-1" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
