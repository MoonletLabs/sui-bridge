'use client'

import type { IconButtonProps } from '@mui/material/IconButton'
import { useCallback } from 'react'

import MenuList from '@mui/material/MenuList'
import MenuItem from '@mui/material/MenuItem'

import { usePopover, CustomPopover } from 'src/components/custom-popover'
import { Label } from 'src/components/label'
import ButtonBase from '@mui/material/ButtonBase'
import { NETWORK, Networks } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'

// ----------------------------------------------------------------------

export function NetworkPopover({ sx, ...other }: IconButtonProps) {
    const popover = usePopover()
    const { network, setNetwork } = useGlobalContext()

    const currentLang = Networks.find(lang => lang.value === network)

    const handleChangeLang = useCallback(
        (newNetwork: NETWORK) => {
            setNetwork(newNetwork)
            popover.onClose()
        },
        [popover, setNetwork],
    )

    return (
        <>
            <ButtonBase disableRipple onClick={popover.onOpen} {...other}>
                <Label color="info" sx={{ fontSize: 14, height: 34, p: 1 }}>
                    {currentLang?.label}
                </Label>
            </ButtonBase>

            <CustomPopover
                open={popover.open}
                anchorEl={popover.anchorEl}
                onClose={popover.onClose}
            >
                <MenuList>
                    {Networks?.map(option => (
                        <MenuItem
                            key={option.value}
                            selected={option.value === network}
                            onClick={() => handleChangeLang(option.value)}
                        >
                            {option.label}
                        </MenuItem>
                    ))}
                </MenuList>
            </CustomPopover>
        </>
    )
}
