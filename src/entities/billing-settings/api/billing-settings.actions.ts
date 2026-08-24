'use server'

import { revalidateTag } from 'next/cache'
import { BILLING_SETTINGS_TAG } from '@/entities/billing-settings/api/billing-settings.server'

export const revalidateBillingSettings = async () => {
	revalidateTag(BILLING_SETTINGS_TAG)
}
