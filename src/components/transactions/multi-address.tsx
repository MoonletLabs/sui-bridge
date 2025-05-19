import { Autocomplete, TextField, Chip, InputAdornment, Popper, Box } from '@mui/material'
import { useState } from 'react'
import { truncateAddress } from 'src/config/helper'

export function MultiAddressAutocomplete({
    label,
    values,
    onChange,
    options = [] as string[],
}: {
    label: string
    values: string[]
    onChange: (newValues: string[]) => void
    options?: string[]
}) {
    const [inputValue, setInputValue] = useState('')

    const commitInput = (val?: string) => {
        const raw = (val ?? inputValue).trim()
        if (raw && !values.includes(raw)) {
            onChange([...values, raw])
        }
        setInputValue('')
    }

    return (
        <Autocomplete
            multiple
            freeSolo
            size="medium"
            options={options}
            value={values}
            inputValue={inputValue}
            onInputChange={(_, newInput) => setInputValue(newInput)}
            onChange={(_, newValue, reason) => {
                switch (reason) {
                    case 'selectOption':
                    case 'createOption':
                        onChange(newValue as string[])
                        setInputValue('')
                        break

                    case 'removeOption':
                        onChange(newValue as string[])
                        break

                    case 'clear':
                        onChange([])
                        setInputValue('')
                        break
                }
            }}
            onBlur={() => commitInput()}
            sx={{
                flex: '0 1 auto',
                width: 'auto',
                minWidth: 220,
            }}
            renderTags={(tagValues, getTagProps) => (
                <Box
                    sx={{
                        display: 'inline-flex',
                        flexWrap: 'nowrap',
                        alignItems: 'center',
                    }}
                >
                    {tagValues.map((option, index) => (
                        <Chip
                            {...getTagProps({ index })}
                            key={option}
                            label={truncateAddress(option)}
                            size="small"
                            sx={{ flexShrink: 0 }}
                        />
                    ))}
                </Box>
            )}
            renderInput={params => {
                const { onPaste: defaultPaste, ...inputProps } = params.inputProps

                return (
                    <TextField
                        {...params}
                        label={label}
                        InputProps={{
                            ...params.InputProps,
                            inputProps: {
                                ...inputProps,
                                onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => {
                                    // 1) call any existing handler
                                    defaultPaste?.(e)
                                    // 2) get pasted text
                                    const pasted = e.clipboardData.getData('Text').trim()
                                    // 3) commit it as a chip
                                    if (pasted) {
                                        commitInput(pasted)
                                    }
                                    // 4) prevent the raw text from landing in the input
                                    e.preventDefault()
                                },
                            },
                        }}
                    />
                )
            }}
            PopperComponent={props => <Popper {...props} style={{ zIndex: 1300 }} />}
        />
    )
}
