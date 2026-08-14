import type { ColumnDef, ReactTable, RowData } from '@tanstack/react-table'

import {
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'

export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData, unknown>

export type DataTableInstance<TData extends RowData> = ReactTable<typeof dataTableFeatures, TData>
