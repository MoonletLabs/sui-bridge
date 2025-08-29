import React, { useState, useEffect, useRef } from 'react'
import { Suspense } from 'react'
import ChartSkeleton from './chart-skeleton'

interface VisibilityChartProps {
    children: React.ReactNode
    fallback?: React.ReactNode
    threshold?: number
}

const VisibilityChart: React.FC<VisibilityChartProps> = ({
    children,
    fallback = <ChartSkeleton />,
    threshold = 0.1,
}) => {
    const [isVisible, setIsVisible] = useState(false)
    const [hasIntersected, setHasIntersected] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasIntersected) {
                    setIsVisible(true)
                    setHasIntersected(true)
                    // Once visible, we can disconnect the observer
                    observer.disconnect()
                }
            },
            { threshold },
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => observer.disconnect()
    }, [threshold, hasIntersected])

    return (
        <div ref={ref}>
            {isVisible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
        </div>
    )
}

export default VisibilityChart
