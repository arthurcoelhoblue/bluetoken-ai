import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Globe, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Pessoa, EmpresaRelacionamentoResumo } from '@/types/pessoa';
import { 
  RELACAO_LABELS, 
  RELACAO_COLORS, 
  DISC_LABELS, 
  DISC_COLORS,
  formatPhoneDisplay,
  type PerfilDISC 
} from '@/types/pessoa';

interface PessoaCardProps {
  pessoa: Pessoa | null;
  relacionamentos: EmpresaRelacionamentoResumo[];
  isLoading?: boolean;
}

export function PessoaCard({ pessoa, relacionamentos, isLoading }: PessoaCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pessoa Global
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20" />
        </CardContent>
      </Card>
    );
  }

  if (!pessoa) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pessoa Global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este lead ainda não foi vinculado a uma pessoa global.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Pessoa Global
          {pessoa.perfil_disc && (
            <Badge className={`ml-auto ${DISC_COLORS[pessoa.perfil_disc as PerfilDISC]}`}>
              {pessoa.perfil_disc} - {DISC_LABELS[pessoa.perfil_disc as PerfilDISC]?.nome}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nome e Telefone */}
        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Nome</p>
            <p className="font-medium">{pessoa.nome}</p>
          </div>
          {pessoa.telefone_e164 && (
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium">{formatPhoneDisplay(pessoa.telefone_e164)}</p>
            </div>
          )}
          {pessoa.email_principal && (
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium truncate select-all cursor-pointer" title={pessoa.email_principal}>{pessoa.email_principal}</p>
            </div>
          )}
        </div>

        {/* Idioma */}
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Idioma: {pessoa.idioma_preferido === 'PT' ? 'Português' : 
                     pessoa.idioma_preferido === 'EN' ? 'English' : 'Español'}
          </span>
        </div>

        {/* Perfil DISC - Dica de comunicação */}
        {pessoa.perfil_disc && DISC_LABELS[pessoa.perfil_disc as PerfilDISC] && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-1">
              💡 {DISC_LABELS[pessoa.perfil_disc as PerfilDISC].tom}
            </p>
            <p className="text-xs text-muted-foreground">
              {DISC_LABELS[pessoa.perfil_disc as PerfilDISC].descricao}
            </p>
          </div>
        )}

        {/* Relacionamentos por Empresa */}
        {relacionamentos.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Relacionamentos
            </p>
            <div className="space-y-2">
              {relacionamentos.map((rel) => (
                <div 
                  key={rel.empresa} 
                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {rel.empresa}
                    </Badge>
                    <Badge className={RELACAO_COLORS[rel.tipo_relacao]}>
                      {RELACAO_LABELS[rel.tipo_relacao]}
                    </Badge>
                  </div>
                  {rel.ultima_interacao_em && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(rel.ultima_interacao_em), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
