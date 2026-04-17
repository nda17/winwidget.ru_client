import { MetadataRoute } from 'next'

const sitemap = (): MetadataRoute.Sitemap => {
	const base = 'https://winwidget.ru'

	return [
		{
			url: base,
			lastModified: new Date(),
			changeFrequency: 'weekly',
			priority: 1
		},
		{
			url: `${base}/legal-documentation/personal-policy`,
			lastModified: new Date(),
			changeFrequency: 'yearly',
			priority: 0.3
		},
		{
			url: `${base}/legal-documentation/consent-processing`,
			lastModified: new Date(),
			changeFrequency: 'yearly',
			priority: 0.3
		},
		{
			url: `${base}/legal-documentation/cookie-notice`,
			lastModified: new Date(),
			changeFrequency: 'yearly',
			priority: 0.3
		},
		{
			url: `${base}/legal-documentation/oferta`,
			lastModified: new Date(),
			changeFrequency: 'yearly',
			priority: 0.3
		}
	]
}

export default sitemap
