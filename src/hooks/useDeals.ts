// Barrel file — re-exports from split modules for backward compatibility
export { useDeals, useKanbanData } from './deals/useDealQueries';
export {
  useCreateDeal,
  useUpdateDeal,
  useMoveDeal,
  useDeleteDeal,
  useCloseDeal,
  useLossCategories,
  useCreateLossCategory,
  useUpdateLossCategory,
  useDeleteLossCategory,
  useReorderLossCategories,
} from './deals/useDealMutations';
export type { CloseDealData } from './deals/useDealMutations';
