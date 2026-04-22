import 'server-only'

import { API_URL } from '@/config/api.config'
import type { SiteSettings } from '@/services/site-settings/site-settings.types'
import { cache } from 'react'

export const SITE_SETTINGS_TAG = 'site-settings'

export const getSiteSettings = cache(
	async (): Promise<SiteSettings | null> => {
		try {
			const response = await fetch(`${API_URL}/site-settings`, {
				next: { revalidate: 60, tags: [SITE_SETTINGS_TAG] }
			})

			if (!response.ok) {
				return null
			}

			return (await response.json()) as SiteSettings
		} catch (error) {
			console.error('Failed to load site settings on server', error)
			return null
		}
	}
)
