import {
    Box,
    Button,
    Card,
    CardHeader,
    CardProps,
    Divider,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TablePagination,
    TableRow,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useMediaQuery } from '@mui/material'
import { ComponentType, FC, ReactNode } from 'react'
import { Scrollbar } from '../scrollbar'
import { TableHeadCustom } from './table-head-custom'
import { Iconify } from '../iconify'

type RowComponentProps<T> = {
    row: T
}

type Props<T> = CardProps & {
    title?: ReactNode | any
    titleContent?: ReactNode
    subheader?: ReactNode
    headLabel: {
        id: string
        label: string
        align?: 'left' | 'right' | 'center'
        minWidth?: number
        sortable?: boolean
        width?: number
    }[]
    tableData: T[]
    RowComponent: ComponentType<RowComponentProps<T>>
    filters?: ReactNode
    hidePagination?: boolean
    loading?: boolean
    rowHeight?: number
    minHeight?: number
    showFilters?: boolean
    setShowFilters?: (s: boolean) => void
    pagination?: {
        count: number
        page: number
        rowsPerPage: number
        onPageChange: (newPage: number) => void
    }
    handleExport?: () => void
    /** Disables the export button and shows progress while a download is being prepared */
    exporting?: boolean
    /** Minimum table width in px before the table scrolls horizontally (default 720) */
    minTableWidth?: number
    /** Always-visible content between the header and the table (summary, quick filters, ...) */
    toolbar?: ReactNode
    /** Extra controls placed next to "Show filters" */
    headerActions?: ReactNode
    /** Column sorting: pass `sortable: true` on the columns that support it */
    sort?: { orderBy: string; order: 'asc' | 'desc'; onSort: (id: string) => void }
    /** Rendered instead of the table on small screens (e.g. cards) */
    MobileRowComponent?: ComponentType<RowComponentProps<T>>
}

export function CustomTable<T>({
    title,
    titleContent,
    subheader,
    tableData,
    headLabel,
    rowHeight,
    RowComponent,
    loading,
    hidePagination,
    pagination,
    filters,
    showFilters,
    setShowFilters,
    minHeight,
    handleExport,
    exporting,
    headerActions,
    toolbar,
    minTableWidth,
    sort,
    MobileRowComponent,
    ...other
}: Props<T>) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const showCards = !!MobileRowComponent && isMobile

    return (
        <Card {...other} sx={{ mt: 4 }}>
            <CardHeader
                title={
                    setShowFilters ? (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                justifyContent: 'space-between',
                            }}
                        >
                            {titleContent ?? title}
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 1,
                                    alignItems: 'center',
                                    flexDirection: { xs: 'column', sm: 'row' },
                                }}
                            >
                                {headerActions}
                                <Button
                                    style={{ display: 'flex', gap: 4, fontSize: 14 }}
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    {showFilters ? (
                                        <>
                                            <Iconify icon="mdi:eye-off" />
                                            {'Hide filters'}
                                        </>
                                    ) : (
                                        <>
                                            <Iconify icon="mdi:eye" />
                                            {'Show filters'}
                                        </>
                                    )}
                                </Button>
                                {handleExport && (
                                    <Button
                                        variant="outlined"
                                        onClick={handleExport}
                                        disabled={exporting}
                                        sx={{
                                            height: 34,
                                            typography: 'subtitle2',
                                            px: 1.5,
                                            borderRadius: 1,
                                        }}
                                    >
                                        {exporting ? 'Exporting…' : 'Export CSV'}
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    ) : (
                        (titleContent ?? title)
                    )
                }
                subheader={subheader}
                sx={{ mb: 3 }}
            />

            {toolbar}

            {showFilters && filters}

            {showCards && MobileRowComponent ? (
                <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {loading
                        ? Array.from(new Array(Math.min(pagination?.rowsPerPage || 5, 6))).map(
                              (_, index) => (
                                  <Skeleton
                                      key={index}
                                      variant="rectangular"
                                      height={120}
                                      sx={{ borderRadius: 2 }}
                                  />
                              ),
                          )
                        : tableData.map((row, index) => (
                              <MobileRowComponent key={(row as any).id || index} row={row} />
                          ))}
                </Box>
            ) : (
                <Scrollbar sx={{ minHeight: minHeight || 800 }}>
                    <Table
                        sx={{ width: '100%', tableLayout: 'fixed', minWidth: minTableWidth || 720 }}
                    >
                        <TableHeadCustom
                            headLabel={headLabel}
                            orderBy={sort?.orderBy}
                            order={sort?.order}
                            onSort={sort?.onSort}
                        />
                        <TableBody>
                            {loading
                                ? Array.from(new Array(pagination?.rowsPerPage || 5)).map(
                                      (_, index) => (
                                          <SkeletonRow
                                              rowHeight={rowHeight}
                                              key={index}
                                              columnCount={headLabel?.length}
                                          />
                                      ),
                                  )
                                : tableData.map((row, index) => (
                                      <RowComponent key={(row as any).id || index} row={row} />
                                  ))}
                        </TableBody>
                    </Table>
                </Scrollbar>
            )}

            <Divider sx={{ borderStyle: 'dashed' }} />

            {!hidePagination && pagination ? (
                <Box sx={{ p: 2 }}>
                    <TablePagination
                        rowsPerPageOptions={[pagination.rowsPerPage]}
                        component="div"
                        count={pagination.count}
                        rowsPerPage={pagination.rowsPerPage}
                        page={pagination.page}
                        onPageChange={(_, newPage) => pagination.onPageChange(newPage)}
                    />
                </Box>
            ) : null}
        </Card>
    )
}

const SkeletonRow: FC<{ columnCount: number; rowHeight?: number }> = ({
    columnCount,
    rowHeight,
}) => {
    return (
        <TableRow sx={{ height: rowHeight || null }}>
            {Array.from({ length: columnCount }).map((_, index) => (
                <TableCell key={index}>
                    <Skeleton variant="rectangular" height={30} sx={{ borderRadius: 2 }} />
                </TableCell>
            ))}
        </TableRow>
    )
}
