import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useFollowUpHours, getBestSendTime } from "@/hooks/useFollowUpHours";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  empresa?: string;
}

export function FollowUpHintCard({ empresa }: Props) {
  const { data: hours, isLoading } = useFollowUpHours(empresa);

  if (isLoading) return <Skeleton className="h-12 w-full" />;

  const bestTime = getBestSendTime(hours || []);
  const hasData = hours && hours.length > 0;

  if (!hasData) return null;

  return (
    <Card className="bg-primary/5 border-primary/10 shadow-none">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium text-primary">Melhor horário para contato</p>
          <p className="text-sm font-semibold">
            {bestTime}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
