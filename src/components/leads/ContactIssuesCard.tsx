import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  LeadContactIssue,
  ISSUE_TIPO_LABELS,
  SEVERIDADE_CONFIG,
  useResolveContactIssue,
} from '@/hooks/useLeadContactIssues';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ContactIssuesCardProps {
  issues: LeadContactIssue[];
  isLoading?: boolean;
  leadId: string;
  empresa: string;
}

export function ContactIssuesCard({ issues, isLoading, leadId, empresa }: ContactIssuesCardProps) {
  const { user, hasRole } = useAuth();
  const { resolveIssue } = useResolveContactIssue();
  const queryClient = useQueryClient();

  const canResolve = hasRole('ADMIN') || hasRole('CLOSER');

  const handleResolve = async (issueId: string) => {
    if (!user?.id) return;

    try {
      await resolveIssue(issueId, user.id);
      queryClient.invalidateQueries({ queryKey: ['lead-contact-issues', leadId, empresa] });
      toast.success('Issue marcada como resolvida');
    } catch {
      toast.error('Erro ao resolver issue');
    }
  };

  // Não renderiza se não há issues ou está carregando
  if (isLoading || !issues || issues.length === 0) {
    return null;
  }

  const getSeverityIcon = (severidade: string) => {
    switch (severidade) {
      case 'ALTA':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'MEDIA':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="border-warning/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          Problemas de Contato
          <Badge variant="outline" className="ml-auto">
            {issues.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.map((issue) => {
          const severityConfig = SEVERIDADE_CONFIG[issue.severidade];
          
          return (
            <div
              key={issue.id}
              className={`flex items-start gap-3 p-3 rounded-lg ${severityConfig.bgColor}`}
            >
              <div className="shrink-0 mt-0.5">
                {getSeverityIcon(issue.severidade)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={severityConfig.color}
                  >
                    {issue.severidade}
                  </Badge>
                  <span className="text-sm font-medium">
                    {ISSUE_TIPO_LABELS[issue.issue_tipo]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {issue.mensagem}
                </p>
              </div>
              {canResolve && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleResolve(issue.id)}
                  title="Marcar como resolvido"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
