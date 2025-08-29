import React, { useEffect, useState } from 'react'
import { Grid, Skeleton } from '@mui/material'
import CardWidget from './card-widgets'
import useSWR from 'swr'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { calculateCardsTotals } from 'src/utils/helper'
import { CardType } from 'src/utils/types'

const CustomWidgets: React.FC = () => {
    const network = getNetwork()

    const { selectedTokens, timePeriod } = useGlobalContext()

    const { data, isLoading } = useSWR<any>(
        `${endpoints.cards}?network=${network}&timePeriod=${timePeriod}`,
        fetcher,
    )
    const [totals, setTotals] = useState<CardType[]>([])

    useEffect(() => {
        if (data) {
            const formatted = calculateCardsTotals(data, selectedTokens)

            setTotals(formatted)
        }
    }, [selectedTokens, data])
    return (
        <Grid container>
            {isLoading
                ? Array.from(new Array(4)).map((_, index) => (
                      <Grid xs={12} sm={6} md={4} lg={3} key={index} padding={1}>
                          <CardWidget
                              title={<Skeleton width={180} height={22} />}
                              total={<Skeleton width={140} height={48} />}
                              isLoader={true}
                              color={''}
                              key={`card-widget-${index}`}
                          />
                      </Grid>
                  ))
                : totals?.map((it, index) => {
                      return (
                          <Grid xs={12} sm={6} md={4} lg={3} key={it?.color} padding={1}>
                              <CardWidget
                                  title={it?.title}
                                  total={it?.value}
                                  isDollar={it.dollars}
                                  color={it?.color}
                                  percentageChange={it?.percentageChange}
                                  timePeriod={timePeriod}
                                  icon={it?.icon}
                                  key={`card-widget-${index}-${it?.title}`}
                              />
                          </Grid>
                      )
                  })}
        </Grid>
    )
}

export default CustomWidgets
