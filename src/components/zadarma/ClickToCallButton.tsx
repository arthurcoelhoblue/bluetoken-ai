import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { DialEvent } from '@/types/patch13';

interface Props {
  phoneNumber: string;
  contactName?: string;
  dealId?: string;
  size?: 'sm' | 'icon';
}

export function ClickToCallButton({ phoneNumber, contactName, dealId, size = 'icon' }: Props) {
  const handleClick = () => {
    const detail: DialEvent = { number: phoneNumber, contactName, dealId };
    window.dispatchEvent(new CustomEvent('bluecrm:dial', { detail }));
  };

  if (!phoneNumber) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
          onClick={handleClick}
        >
          <Phone className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ligar para {phoneNumber}</TooltipContent>
    </Tooltip>
  );
}
