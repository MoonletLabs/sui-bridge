import React, { useState, useEffect } from 'react'
import {
    Select,
    MenuItem,
    TextField,
    FormControl,
    InputLabel,
    Box,
    InputAdornment,
    useTheme,
} from '@mui/material'

type PredefinedRangeOption = {
    label: string
    value: string
}

type DateRange = {
    range: string
    start?: string
    end?: string
}

type DateRangeSelectProps = {
    initialRange?: string
    onDateChange?: (range: DateRange) => void
    predefinedRanges?: PredefinedRangeOption[]
    label: string
}

const DateRangeSelect: React.FC<DateRangeSelectProps> = ({
    initialRange = '',
    label = '',
    onDateChange,
    predefinedRanges = [
        { label: 'Last 7 Days', value: 'last7days' },
        { label: 'Last 30 Days', value: 'last30days' },
        { label: 'Custom', value: 'custom' },
    ],
}) => {
    const theme = useTheme()
    const [dateRange, setDateRange] = useState<string>(initialRange)
    const [customDates, setCustomDates] = useState<{ start: string; end: string }>({
        start: '',
        end: '',
    })

    useEffect(() => {
        if (onDateChange) {
            onDateChange({ range: dateRange, start: customDates.start, end: customDates.end })
        }
    }, [dateRange, customDates, onDateChange])

    const handleDateRangeChange = (event: any) => {
        const value = event.target.value as string
        setDateRange(value)

        if (value === 'last7days') {
            setCustomDates({
                start: getLastDaysDate(7),
                end: getTodayDate(),
            })
        } else if (value === 'last30days') {
            setCustomDates({
                start: getLastDaysDate(30),
                end: getTodayDate(),
            })
        } else {
            setCustomDates({ start: '', end: '' })
        }
    }

    const handleCustomDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target
        setCustomDates(prev => ({ ...prev, [name]: value }))
    }

    const getLastDaysDate = (daysAgo: number): string => {
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        return date.toISOString().split('T')[0]
    }

    const getTodayDate = (): string => new Date().toISOString().split('T')[0]

    return (
        <Box>
            <FormControl fullWidth margin="normal">
                <InputLabel id="date-range-label">{label}</InputLabel>
                <Select
                    labelId="date-range-label"
                    value={dateRange}
                    onChange={handleDateRangeChange}
                    label={label}
                >
                    {predefinedRanges.map(range => (
                        <MenuItem key={range.value} value={range.value}>
                            {range.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {dateRange === 'custom' && (
                <Box display="flex" gap={2} mt={2}>
                    <TextField
                        label="Start Date"
                        type="date"
                        color="primary"
                        name="start"
                        value={customDates.start}
                        onChange={handleCustomDateChange}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="End Date"
                        type="date"
                        name="end"
                        value={customDates.end}
                        onChange={handleCustomDateChange}
                        InputLabelProps={{ shrink: true }}
                    />
                </Box>
            )}
        </Box>
    )
}

export default DateRangeSelect
