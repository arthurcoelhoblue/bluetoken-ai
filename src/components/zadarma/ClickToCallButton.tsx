import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DialEvent } from '@/types/telephony';

interface Props {
  phone: string | null | undefined;
  contactName?: string;
  dealId?: string;
  customerId?: string;
  size?: 'sm' | 'icon';
  variant?: 'outline' | 'ghost' | 'default';
  className?: string;
}

export function ClickToCallButton({ phone, contactName, dealId, customerId, size = 'icon', variant = 'ghost', className }: Props) {
  if (!phone) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const detail: DialEvent = {
      number: phone,
      contactName,
      dealId,
    };
    window.dispatchEvent(new CustomEvent('bluecrm:dial', { detail }));
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={handleClick}
        >
          <Phone className="h-3.5 w-3.5" />
          {size === 'sm' && <span className="ml-1.5">Ligar</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ligar para {contactName || phone}</TooltipContent>
    </Tooltip>
  );
}
