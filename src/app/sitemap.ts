import { MetadataRoute } from 'next'
import { DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT } from '@/services/home-page-content/home-page-content.defaults'
import { getHomePageContent } from '@/services/home-page-content/home-page-content.server'

const buildUrl = (baseUrl: string, path: string) => {
	const base = baseUrl.replace(/\/+$/, '')
	const normalizedPath = path === '/' ? '' : path

	return `${base}${normalizedPath}`
}

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
	const content = await getHomePageContent()
	const baseUrl =
		content.technicalSeo.baseUrl ||
		DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT.baseUrl
	const enabledItems = content.technicalSeo.sitemapItems.filter(
		item => item.enabled
	)
	const items = enabledItems.length
		? enabledItems
		: DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT.sitemapItems
	const lastModified = new Date()

	return items.map(item => ({
		url: buildUrl(baseUrl, item.path),
		lastModified,
		changeFrequency: item.changeFrequency,
		priority: item.priority
	}))
}

export default sitemap
