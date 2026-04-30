'use server'

import { revalidateTag } from 'next/cache'
import { TARIFF_PRICES_TAG } from '@/services/tariff-prices/tariff-prices.server'

export const revalidateTariffPrices = async () => {
	revalidateTag(TARIFF_PRICES_TAG)
}
