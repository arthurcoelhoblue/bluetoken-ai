import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface DataTablePaginationProps {
  page: number; // 0-based
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getVisiblePages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages: (number | 'ellipsis')[] = [];
  const neighbors = new Set<number>();

  // Always show first and last
  neighbors.add(0);
  neighbors.add(total - 1);

  // Show 2 neighbors of current
  for (let i = Math.max(0, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    neighbors.add(i);
  }

  const sorted = [...neighbors].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      pages.push('ellipsis');
    }
    pages.push(sorted[i]);
  }

  return pages;
}

export function DataTablePagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: DataTablePaginationProps) {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      <p className="text-sm text-muted-foreground">
        Mostrando {from}–{to} de {totalCount} registros
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => page > 0 && onPageChange(page - 1)}
              aria-disabled={page === 0}
              className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>

          {visiblePages.map((p, idx) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`e-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => onPageChange(p)}
                  className="cursor-pointer"
                >
                  {p + 1}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => page < totalPages - 1 && onPageChange(page + 1)}
              aria-disabled={page >= totalPages - 1}
              className={page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
