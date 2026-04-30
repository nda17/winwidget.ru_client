import { MetadataRoute } from 'next'
import { DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT } from '@/services/home-page-content/home-page-content.defaults'
import { getHomePageContent } from '@/services/home-page-content/home-page-content.server'

const robots = async (): Promise<MetadataRoute.Robots> => {
	const content = await getHomePageContent()
	const baseUrl = (
		content.technicalSeo.baseUrl ||
		DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT.baseUrl
	).replace(/\/+$/, '')
	const disallow = content.technicalSeo.robotsDisallow.length
		? content.technicalSeo.robotsDisallow
		: DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT.robotsDisallow

	return {
		rules: {
			userAgent: '*',
			disallow
		},
		sitemap: `${baseUrl}/sitemap.xml`
	}
}

export default robots
