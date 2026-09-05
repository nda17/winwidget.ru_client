import 'server-only'

import { API_URL } from '@/shared/config/api.config'
import { parseBillingPublicSettings } from '@/entities/billing-settings/model/billing-settings.parser'
import type { BillingPublicSettings } from '@/entities/billing-settings/model/billing-settings.types'
import { cache } from 'react'

export const BILLING_SETTINGS_TAG = 'billing-settings'

export const getBillingPublicSettings = cache(
	async (): Promise<BillingPublicSettings | null> => {
		try {
			const response = await fetch(`${API_URL}/billing-settings/public`, {
				next: { revalidate: 60, tags: [BILLING_SETTINGS_TAG] }
			})

			if (!response.ok) {
				return null
			}

			return parseBillingPublicSettings(await response.json())
		} catch (error) {
			console.error('Failed to load Billing settings on server', error)
			return null
		}
	}
)
