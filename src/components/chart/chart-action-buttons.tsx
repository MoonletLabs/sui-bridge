import { Box, ButtonGroup, Button } from '@mui/material'
import { TimeInterval, getTimeIntervalForPeriod, TimePeriod } from 'src/config/helper'
import { ChartSelect } from './chart-select'

export function ChartActionButtons({
    showTotal,
    setShowTotal,
    selectedSeries,
    handleChangeSeries,
    timePeriod,
}: {
    showTotal: boolean
    setShowTotal: (value: boolean) => void
    selectedSeries: TimeInterval
    handleChangeSeries: (newValue: string) => void
    timePeriod: string
}) {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 1,
            }}
        >
            <ButtonGroup sx={{ mr: { sm: 2 }, width: { xs: '100%', sm: 'auto' }, height: 34 }}>
                <Button
                    variant={!showTotal ? 'contained' : 'outlined'}
                    onClick={() => setShowTotal(false)}
                    sx={{ width: 100 }}
                >
                    Per Asset
                </Button>
                <Button
                    variant={showTotal ? 'contained' : 'outlined'}
                    onClick={() => setShowTotal(true)}
                    sx={{ width: 100 }}
                >
                    Total
                </Button>
            </ButtonGroup>
            <ChartSelect
                options={getTimeIntervalForPeriod(timePeriod as TimePeriod)}
                value={selectedSeries}
                onChange={handleChangeSeries}
                slotProps={{
                    button: {
                        width: 100,
                        alignSelf: { xs: 'center', sm: 'center' },
                    },
                }}
            />
        </Box>
    )
}
