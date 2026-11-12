'use client'

import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    IconButton,
    InputAdornment,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Iconify } from 'src/components/iconify'
import { useSearch } from 'src/hooks/use-search'
import { useRouter } from 'src/routes/hooks'
import type { SearchResult } from 'src/utils/search-results'

// ----------------------------------------------------------------------

const RECENT_KEY = 'globalSearchRecent'
const MAX_RECENT = 5

const EXAMPLES = ['0x3f9a1c…', 'ETH', 'pending', 'over 100k', 'governance']

const readRecent = (): SearchResult[] => {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
        return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
    } catch {
        return []
    }
}

const writeRecent = (items: SearchResult[]) => {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(items))
    } catch {
        // storage can be unavailable (private mode): recents are a convenience
    }
}

// ----------------------------------------------------------------------

export function GlobalSearch() {
    const theme = useTheme()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [active, setActive] = useState(0)
    const [enterPending, setEnterPending] = useState(false)
    const [recent, setRecent] = useState<SearchResult[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    const search = useSearch(query, open)
    const results = search.results
    const trimmed = query.trim()

    const focusInput = () => {
        // Focus and select any leftover text so a new paste replaces it
        inputRef.current?.focus()
        inputRef.current?.select()
    }

    // Show recent searches only while the box is empty
    const visible = useMemo(() => (trimmed ? results : recent), [trimmed, results, recent])

    // A new set of results starts at the top
    useEffect(() => setActive(0), [query, results.length])

    // Open with Cmd+K / Ctrl+K
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setOpen(prev => {
                    if (prev) {
                        // Already open — just put the caret back in the input
                        focusInput()
                        return prev
                    }
                    return true
                })
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        if (open) setRecent(readRecent())
    }, [open])

    const handleClose = () => {
        setOpen(false)
        setQuery('')
    }

    const handleNavigate = (result: SearchResult) => {
        writeRecent(
            [result, ...readRecent().filter(r => r.key !== result.key)].slice(0, MAX_RECENT),
        )
        handleClose()
        // Let the dialog close render first, so it never lingers while the next page loads
        setTimeout(() => router.push(result.href), 0)
    }

    const handleKeyDownInput = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown' && visible.length > 0) {
            event.preventDefault()
            setActive(i => (i + 1) % visible.length)
        } else if (event.key === 'ArrowUp' && visible.length > 0) {
            event.preventDefault()
            setActive(i => (i - 1 + visible.length) % visible.length)
        } else if (event.key === 'Enter') {
            if (visible[active]) {
                handleNavigate(visible[active])
            } else if (trimmed && search.loading) {
                // Enter pressed before the lookup answered: open the first result once it does
                setEnterPending(true)
            }
        }
    }

    // Run a queued Enter as soon as the lookup has finished
    useEffect(() => {
        if (!enterPending || search.loading) return
        setEnterPending(false)
        if (results[0]) handleNavigate(results[0])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enterPending, search.loading, results])

    // Typing again cancels a queued Enter
    useEffect(() => setEnterPending(false), [query])

    // Keep the highlighted row in view while arrowing through a long list
    useEffect(() => {
        document.getElementById(`global-search-row-${active}`)?.scrollIntoView({ block: 'nearest' })
    }, [active])

    const message = (() => {
        if (!trimmed) return null
        if (search.tooShort) {
            return `Type at least ${search.minPrefixChars} characters to look up a partial hash or address`
        }
        if (search.lookupError === 'limit') {
            return 'Too many searches in a short time. Try again in a few seconds'
        }
        if (search.lookupError === 'unavailable') {
            return 'Lookup is unavailable right now. Complete values can still be opened directly'
        }
        if (search.notFound) {
            return `No bridge activity found for this value. Partial hashes and addresses only search the last ${search.prefixWindowDays} days`
        }
        if (!search.loading && results.length === 0) {
            return 'No match. Try a transaction hash, an address, a token (ETH), or a status (pending)'
        }
        return null
    })()

    let lastGroup = ''

    return (
        <>
            <Tooltip title="Search hash, address, token or page (⌘K)">
                <IconButton onClick={() => setOpen(true)} aria-label="Search">
                    <Iconify icon="eva:search-fill" width={22} />
                </IconButton>
            </Tooltip>

            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth="sm"
                sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: '12vh' } }}
                PaperProps={{ sx: { borderRadius: 2 } }}
                slotProps={{
                    backdrop: {
                        sx: { backgroundColor: alpha(theme.palette.common.black, 0.8) },
                    },
                }}
                transitionDuration={{ enter: 150, exit: 0 }}
                TransitionProps={{ onEntered: focusInput }}
            >
                <Box sx={{ p: 2 }}>
                    <TextField
                        autoFocus
                        inputRef={inputRef}
                        fullWidth
                        placeholder="Search a hash, address, token, status or page…"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        onKeyDown={handleKeyDownInput}
                        inputProps={{ 'aria-label': 'Search', autoComplete: 'off' }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Iconify
                                        icon="eva:search-fill"
                                        width={20}
                                        sx={{ color: 'text.disabled' }}
                                    />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    {search.loading && <CircularProgress size={18} />}
                                    {query && (
                                        <IconButton
                                            size="small"
                                            aria-label="Clear search"
                                            onClick={() => {
                                                setQuery('')
                                                focusInput()
                                            }}
                                        >
                                            <Iconify icon="eva:close-fill" width={18} />
                                        </IconButton>
                                    )}
                                </InputAdornment>
                            ),
                        }}
                    />

                    {!trimmed && recent.length > 0 && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                mt: 1.5,
                                px: 0.5,
                            }}
                        >
                            <Typography variant="overline" color="text.secondary">
                                Recent
                            </Typography>
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    writeRecent([])
                                    setRecent([])
                                }}
                            >
                                Clear
                            </Button>
                        </Box>
                    )}

                    {visible.length > 0 && (
                        <List
                            dense
                            sx={{ mt: 0.5, pb: 0, maxHeight: '50vh', overflowY: 'auto' }}
                            role="listbox"
                        >
                            {visible.map((result, index) => {
                                const showGroup = trimmed && result.group !== lastGroup
                                lastGroup = result.group
                                return (
                                    <Box key={result.key} component="li" sx={{ listStyle: 'none' }}>
                                        {showGroup && (
                                            <ListSubheader
                                                component="div"
                                                disableSticky
                                                sx={{
                                                    lineHeight: '28px',
                                                    bgcolor: 'transparent',
                                                    typography: 'overline',
                                                }}
                                            >
                                                {result.group}
                                            </ListSubheader>
                                        )}
                                        <ListItemButton
                                            id={`global-search-row-${index}`}
                                            role="option"
                                            aria-selected={index === active}
                                            selected={index === active}
                                            onMouseMove={() => setActive(index)}
                                            onClick={() => handleNavigate(result)}
                                            sx={{
                                                borderRadius: 1,
                                                '&.Mui-selected, &.Mui-selected:hover': {
                                                    bgcolor: alpha(
                                                        theme.palette.primary.main,
                                                        0.12,
                                                    ),
                                                },
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <Iconify icon={result.icon} width={20} />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={result.label}
                                                secondary={result.description}
                                                primaryTypographyProps={{
                                                    variant: 'body2',
                                                    fontWeight: 'bold',
                                                }}
                                                secondaryTypographyProps={{ variant: 'caption' }}
                                            />
                                            <Iconify
                                                icon="eva:arrow-ios-forward-fill"
                                                width={16}
                                                sx={{ color: 'text.disabled' }}
                                            />
                                        </ListItemButton>
                                    </Box>
                                )
                            })}
                        </List>
                    )}

                    {message && (
                        <Box sx={{ py: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                {message}
                            </Typography>
                        </Box>
                    )}

                    {!trimmed && (
                        <Box sx={{ pt: 1.5, px: 0.5 }}>
                            <Typography variant="caption" color="text.disabled">
                                Paste a transaction hash, SUI or Ethereum address (a partial one
                                works too), or an explorer link. Or type a token, a status, or a
                                page.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                                {EXAMPLES.map(example => (
                                    <Chip
                                        key={example}
                                        size="small"
                                        variant="outlined"
                                        label={example}
                                        onClick={() => {
                                            // Fill in the example, except the placeholder hash
                                            if (!example.includes('…')) setQuery(example)
                                            focusInput()
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
            </Dialog>
        </>
    )
}
