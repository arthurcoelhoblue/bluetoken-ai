import { cn } from '@/lib/utils';
import { UserRole, ROLE_LABELS, ROLE_COLORS } from '@/types/auth';
import { 
  Shield, 
  Phone, 
  BarChart3, 
  Eye, 
  BookOpen, 
  Bot 
} from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  ADMIN: Shield,
  CLOSER: Phone,
  MARKETING: BarChart3,
  AUDITOR: Eye,
  READONLY: BookOpen,
  SDR_IA: Bot,
};

export function RoleBadge({ role, size = 'md', showIcon = true, className }: RoleBadgeProps) {
  const Icon = ROLE_ICONS[role];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full transition-smooth',
        ROLE_COLORS[role],
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {ROLE_LABELS[role]}
    </span>
  );
}
