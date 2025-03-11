import {
    CardProps,
    Card,
    CardHeader,
    Table,
    TableBody,
    Divider,
    TablePagination,
    Box,
    Skeleton,
    TableCell,
    TableRow,
} from '@mui/material'
import { Scrollbar } from '../scrollbar'
import { TableHeadCustom } from './table-head-custom'
import React, { ComponentType, FC, ReactElement, ReactNode, useState } from 'react'

type RowComponentProps<T> = {
    row: T
}

type Props<T> = CardProps & {
    title?: ReactNode
    subheader?: string
    headLabel: { id: string; label: string }[]
    tableData: any[]
    RowComponent: ComponentType<RowComponentProps<T>>
    hidePagination?: boolean
    loading?: boolean
    rowHeight?: number
    rows?: number
}

export function CustomTable<T>({
    title,
    subheader,
    tableData,
    headLabel,
    rowHeight,
    RowComponent,
    loading,
    rows,
    hidePagination,
    ...other
}: Props<T>) {
    const [page, setPage] = useState(0)
    const rowsPerPage = rows || 10

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage)
    }

    // Slice the data for the current page
    const currentData = (tableData || []).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
    )

    return (
        <Card {...other} sx={{ mt: 4 }}>
            <CardHeader title={title} subheader={subheader} sx={{ mb: 3 }} />

            <Scrollbar sx={{ minHeight: 462 }}>
                <Table sx={{ width: '100%', tableLayout: 'fixed', minWidth: 720 }}>
                    <TableHeadCustom headLabel={headLabel} />
                    <TableBody>
                        {loading
                            ? Array.from(new Array(10)).map((it, index) => (
                                  <SkeletonRow
                                      rowHeight={rowHeight}
                                      key={index}
                                      columnCount={headLabel?.length}
                                  />
                              ))
                            : currentData.map((row, index) => (
                                  <RowComponent key={(row as any).id || index} row={row} />
                              ))}
                    </TableBody>
                </Table>
            </Scrollbar>

            <Divider sx={{ borderStyle: 'dashed' }} />

            {!hidePagination ? (
                <Box sx={{ p: 2 }}>
                    <TablePagination
                        rowsPerPageOptions={[10]} // fixed at 10
                        component="div"
                        count={tableData.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
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
