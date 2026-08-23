'use server'

import { revalidateTag } from 'next/cache'
import { BILLING_PUBLIC_SETTINGS_TAG } from '@/entities/billing-settings/api/billing-settings.server'

export const revalidateBillingPublicSettings = async () => {
	revalidateTag(BILLING_PUBLIC_SETTINGS_TAG)
}
