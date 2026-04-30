import type { SiteSettings } from '@/services/site-settings/site-settings.types'
import type { HomePageFooterContent } from '@/services/home-page-content/home-page-content.types'

export interface ILayout {
	children: React.ReactNode
	siteSettings?: SiteSettings | null
	footerContent?: HomePageFooterContent
}
