import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, ExternalLink } from 'lucide-react';
import { useRef, useEffect, useState, useMemo } from 'react';

/**
 * Sanitizes HTML to prevent XSS attacks.
 * Removes script/iframe tags, event handlers (on*=), and javascript: URLs.
 */
function sanitizeHtml(html: string): string {
  return html
    // Remove <script> tags and content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gim, '')
    // Remove <iframe> tags and content
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gim, '')
    // Remove self-closing <script /> and <iframe />
    .replace(/<script\b[^>]*\/>/gim, '')
    .replace(/<iframe\b[^>]*\/>/gim, '')
    // Remove event handlers (on*="...")
    .replace(/\bon\w+\s*=\s*"[^"]*"/gim, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gim, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gim, '')
    // Remove javascript: URLs
    .replace(/href\s*=\s*"javascript:[^"]*"/gim, 'href="#"')
    .replace(/href\s*=\s*'javascript:[^']*'/gim, "href='#'")
    .replace(/src\s*=\s*"javascript:[^"]*"/gim, '')
    .replace(/src\s*=\s*'javascript:[^']*'/gim, '');
}

interface EmailPreviewDialogProps {
  htmlContent: string;
  subject?: string;
}

export function EmailPreviewDialog({ htmlContent, subject }: EmailPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const sanitizedContent = useMemo(() => sanitizeHtml(htmlContent), [htmlContent]);

  useEffect(() => {
    if (isOpen && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  margin: 0;
                  padding: 16px;
                  background: #ffffff;
                  color: #333333;
                }
                img { max-width: 100%; height: auto; }
                a { color: #2563eb; }
              </style>
            </head>
            <body>${sanitizedContent}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [isOpen, htmlContent]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
        >
          <Eye className="h-3 w-3" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            {subject || 'Preview do E-mail'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-md border bg-white">
          <iframe
            ref={iframeRef}
            title="Email Preview"
            sandbox="allow-same-origin"
            className="w-full h-[60vh] border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
