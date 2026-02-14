import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { useSazonalidade, useUpdateSazonalidade } from '@/hooks/useMetas';
import { MESES_LABEL } from '@/types/metas';
import { LossCategoriesConfig } from './LossCategoriesConfig';

export function ComercialTab() {
  const { data: indices = [], isLoading } = useSazonalidade();
  const updateMut = useUpdateSazonalidade();
  const [localIndices, setLocalIndices] = useState<{ id: string; mes: number; indice: number }[]>([]);

  useEffect(() => {
    if (indices.length > 0) {
      setLocalIndices(indices.map(i => ({ id: i.id, mes: i.mes, indice: Number(i.indice) })));
    }
  }, [indices]);

  const handleChange = (mes: number, value: string) => {
    setLocalIndices(prev => prev.map(i => i.mes === mes ? { ...i, indice: parseFloat(value) || 0 } : i));
  };

  const saveSazonalidade = () => {
    updateMut.mutate(localIndices.map(i => ({ id: i.id, indice: i.indice })));
  };

  const somaIndices = localIndices.reduce((s, i) => s + i.indice, 0);

  return (
    <div className="space-y-6">
      {/* Sazonalidade */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Índices de Sazonalidade</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Usados na distribuição automática de metas anuais. Soma atual: <span className="font-mono font-medium">{somaIndices.toFixed(2)}</span>
            </p>
          </div>
          <Button size="sm" onClick={saveSazonalidade} disabled={updateMut.isPending || isLoading}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {localIndices.map(idx => (
                <div key={idx.mes} className="space-y-1">
                  <Label className="text-xs">{MESES_LABEL[idx.mes]}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={idx.indice}
                    onChange={e => handleChange(idx.mes, e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {somaIndices > 0 ? ((idx.indice / somaIndices) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Motivos de Perda */}
      <LossCategoriesConfig />
    </div>
  );
}
