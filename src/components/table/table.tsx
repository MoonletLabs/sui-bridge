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
import { ComponentType, FC, ReactNode } from 'react'
import { Scrollbar } from '../scrollbar'
import { TableHeadCustom } from './table-head-custom'
import { Iconify } from '../iconify'

type RowComponentProps<T> = {
    row: T
}

type Props<T> = CardProps & {
    title?: ReactNode | any
    subheader?: string
    headLabel: {
        id: string
        label: string
        align?: 'left' | 'right' | 'center'
        minWidth?: number
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
}

export function CustomTable<T>({
    title,
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
    ...other
}: Props<T>) {
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
                            {title}
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
                        </Box>
                    ) : (
                        title
                    )
                }
                subheader={subheader}
                sx={{ mb: 3 }}
            />

            {showFilters && filters}

            <Scrollbar sx={{ minHeight: minHeight || 800 }}>
                <Table sx={{ width: '100%', tableLayout: 'fixed', minWidth: 720 }}>
                    <TableHeadCustom headLabel={headLabel} />
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
