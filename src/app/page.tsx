import Home from '@/components/screens/home/Home'
import { getHomePageContent } from '@/services/home-page-content/home-page-content.server'
import { getTariffPrices } from '@/services/tariff-prices/tariff-prices.server'
import { Metadata } from 'next'

export const generateMetadata = async (): Promise<Metadata> => {
	const content = await getHomePageContent()

	return {
		title: content.seo.title,
		description: content.seo.description,
		keywords: content.seo.keywords,
		openGraph: {
			title: content.seo.ogTitle,
			description: content.seo.ogDescription,
			url: 'https://winwidget.ru',
			type: 'website',
			images: [
				{
					url: '/og-image.png',
					width: 1200,
					height: 630,
					alt: 'Winwidget'
				}
			]
		},
		alternates: {
			canonical: 'https://winwidget.ru'
		}
	}
}

const HomePage = async () => {
	const [content, tariffPrices] = await Promise.all([
		getHomePageContent(),
		getTariffPrices()
	])

	return <Home content={content} tariffPrices={tariffPrices} />
}

export default HomePage
