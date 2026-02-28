import { useState } from 'react';
import { Phone, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useZadarmaProxy } from '@/hooks/useZadarma';
import { useCompany } from '@/contexts/CompanyContext';
import type { DialEvent, EmpresaTipo } from '@/types/telephony';

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
  const { activeCompany } = useCompany();
  const proxy = useZadarmaProxy();
  const [priceInfo, setPriceInfo] = useState<{ price?: string; currency?: string; prefix?: string } | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [showPrice, setShowPrice] = useState(false);

  if (!phone) return null;

  const handleDial = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPrice(false);
    // AudioContext unlock moved to ZadarmaPhoneWidget.handleDial
    const detail: DialEvent = {
      number: phone,
      contactName,
      dealId,
    };
    window.dispatchEvent(new CustomEvent('bluecrm:dial', { detail }));
  };

  const handleCheckPrice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (priceLoading) return;
    setPriceLoading(true);
    setPriceInfo(null);
    try {
      const result = await proxy.mutateAsync({
        action: 'get_price',
        empresa: activeCompany as EmpresaTipo,
        payload: { number: phone },
      });
      setPriceInfo(result?.info || result);
      setShowPrice(true);
    } catch {
      setPriceInfo({ price: '?', currency: '' });
      setShowPrice(true);
    } finally {
      setPriceLoading(false);
    }
  };

  return (
    <Popover open={showPrice} onOpenChange={setShowPrice}>
      <div className="inline-flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={className}
              onClick={handleDial}
            >
              <Phone className="h-3.5 w-3.5" />
              {size === 'sm' && <span className="ml-1.5">Ligar</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ligar para {contactName || phone}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={handleCheckPrice}
              >
                {priceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Ver custo da ligação</TooltipContent>
        </Tooltip>
      </div>

      <PopoverContent className="w-52 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Custo estimado</p>
          {priceInfo ? (
            <>
              <p className="text-lg font-bold">
                {priceInfo.price ?? '—'} <span className="text-xs font-normal text-muted-foreground">{priceInfo.currency || 'USD'}/min</span>
              </p>
              {priceInfo.prefix && (
                <p className="text-xs text-muted-foreground">Prefixo: {priceInfo.prefix}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          <Button size="sm" className="w-full" onClick={() => handleDial()}>
            <Phone className="h-3.5 w-3.5 mr-1.5" /> Ligar agora
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
