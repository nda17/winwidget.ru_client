import { MetadataRoute } from 'next'

const robots = (): MetadataRoute.Robots => {
	const base = 'https://winwidget.ru'

	return {
		rules: {
			userAgent: '*',
			disallow: [
				'/admin/',
				'/cabinet/',
				'/wheels/',
				'/quizzes/',
				'/callbacks/',
				'/timers/',
				'/page-wheel/',
				'/page-quiz/',
				'/page-callback/',
				'/page-timer/',
				'/payment/',
				'/logout/',
				'/login/',
				'/register/',
				'/restore-password/',
				'/social-auth/'
			]
		},
		sitemap: `${base}/sitemap.xml`
	}
}

export default robots
