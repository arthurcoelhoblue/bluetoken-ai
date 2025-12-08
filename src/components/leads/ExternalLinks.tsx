import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import type { LeadContact } from '@/hooks/useLeadDetail';

interface ExternalLinksProps {
  contact: LeadContact;
}

// URLs base configuráveis
const PIPEDRIVE_BASE_URL = 'https://app.pipedrive.com';
const TOKENIZA_BASE_URL = 'https://app.tokeniza.com.br';
const BLUE_BASE_URL = 'https://app.blueconsult.com.br';

export function ExternalLinks({ contact }: ExternalLinksProps) {
  const hasAnyLink =
    contact.pipedrive_person_id ||
    contact.pipedrive_deal_id ||
    contact.tokeniza_investor_id ||
    contact.blue_client_id;

  if (!hasAnyLink) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem links externos configurados
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Links Externos</p>
      <div className="flex flex-wrap gap-2">
        {contact.pipedrive_person_id && (
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href={`${PIPEDRIVE_BASE_URL}/person/${contact.pipedrive_person_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Pipedrive (Pessoa)
            </a>
          </Button>
        )}

        {contact.pipedrive_deal_id && (
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href={`${PIPEDRIVE_BASE_URL}/deal/${contact.pipedrive_deal_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Pipedrive (Deal)
            </a>
          </Button>
        )}

        {contact.tokeniza_investor_id && (
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href={`${TOKENIZA_BASE_URL}/investor/${contact.tokeniza_investor_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Tokeniza
            </a>
          </Button>
        )}

        {contact.blue_client_id && (
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href={`${BLUE_BASE_URL}/client/${contact.blue_client_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Blue
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
