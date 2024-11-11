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

type CustomSelectProps = {
    initialRange?: string
    onDateChange?: (range: DateRange) => void
    predefinedRanges?: PredefinedRangeOption[]
    label: string
    values: any[]
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    initialRange = '',
    label = '',
    values,
    onDateChange,
}) => {
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
                    {values.map(range => (
                        <MenuItem key={range.name} value={range.name}>
                            {range.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    )
}

export default CustomSelect
