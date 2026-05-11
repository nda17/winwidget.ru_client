import 'server-only'

import { API_URL } from '@/config/api.config'
import type { AffiliateSettings } from '@/services/affiliate/affiliate.service'
import { cache } from 'react'

export const getAffiliatePublicSettings = cache(
	async (): Promise<AffiliateSettings | null> => {
		try {
			const response = await fetch(
				`${API_URL}/affiliate/public-settings`,
				{
					next: { revalidate: 60 }
				}
			)

			if (!response.ok) {
				return null
			}

			return (await response.json()) as AffiliateSettings
		} catch (error) {
			console.error('Failed to load affiliate settings', error)
			return null
		}
	}
)
