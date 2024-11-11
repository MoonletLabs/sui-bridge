import type { Theme, SxProps } from '@mui/material/styles'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import ButtonBase from '@mui/material/ButtonBase'
import Checkbox from '@mui/material/Checkbox'
import { varAlpha } from 'src/theme/styles'
import { Iconify } from 'src/components/iconify'
import { usePopover, CustomPopover } from '../custom-popover'
import { Box, Typography } from '@mui/material'

type Option = {
    name: string
    icon?: string // URL or path to the icon
}

type Props = {
    options: Option[]
    value: string[]
    onChange: (newValue: string[]) => void
    allOption: string
    slotProps?: {
        button?: SxProps<Theme>
        popover?: SxProps<Theme>
    }
}

export function MultiSelect({ options, value, onChange, allOption, slotProps, ...other }: Props) {
    const popover = usePopover()

    const handleSelect = (option: string) => {
        if (value.includes(option)) {
            if (value.length > 1) {
                onChange(value.filter(item => item !== option))
            }
        } else {
            onChange([...value, option])
        }
        if (option === allOption) {
            // If "All tokens" is selected, deselect all other options and select only "All tokens"
            onChange([allOption])
        } else {
            // If any other option is selected, deselect "All tokens"
            const newValue = value.includes(allOption)
                ? value.filter(item => item !== allOption)
                : value

            // Toggle the selected option
            if (newValue.includes(option)) {
                if (newValue.length > 1) {
                    onChange(newValue.filter(item => item !== option))
                }
            } else {
                onChange([...newValue, option])
            }
        }
    }

    return (
        <>
            <ButtonBase
                onClick={popover.onOpen}
                sx={{
                    pr: 1,
                    width: { xs: 110, sm: 'auto' },
                    mr: 1,
                    pl: 1.5,
                    gap: 1.5,
                    height: 34,
                    borderRadius: 1,
                    typography: 'subtitle2',
                    border: theme =>
                        `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.24)}`,
                    ...slotProps?.button,
                }}
                {...other}
            >
                <Typography
                    noWrap
                    sx={{
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '150px', md: 'auto' }, // Adjust width on mobile for ellipsis
                    }}
                >
                    {value.length > 0 ? value.join(', ') : 'Select options'}
                </Typography>

                <Iconify
                    width={16}
                    icon={
                        popover.open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
                    }
                />
            </ButtonBase>

            <CustomPopover
                open={popover.open}
                anchorEl={popover.anchorEl}
                onClose={popover.onClose}
            >
                <MenuList sx={slotProps?.popover}>
                    {options.map(option => (
                        <MenuItem key={option?.name} onClick={() => handleSelect(option?.name)}>
                            <Checkbox
                                checked={value.includes(option?.name)}
                                sx={{ p: 0.5, mr: 1.5 }}
                            />
                            <Box display={'flex'} alignItems={'center'}>
                                {option?.icon && (
                                    <img
                                        src={option?.icon}
                                        alt=""
                                        style={{ width: 20, height: 20, marginRight: 10 }}
                                    />
                                )}
                                {option?.name}
                            </Box>
                        </MenuItem>
                    ))}
                </MenuList>
            </CustomPopover>
        </>
    )
}
