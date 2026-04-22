import type { SiteSettings } from '@/services/site-settings/site-settings.types'

export interface ILayout {
	children: React.ReactNode
	siteSettings?: SiteSettings | null
}
