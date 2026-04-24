import { MetadataRoute } from 'next'

const robots = (): MetadataRoute.Robots => {
	return {
		rules: {
			userAgent: '*',
			disallow: [
				'/admin/',
				'/cabinet/',
				'/wheels/',
				'/payment/',
				'/logout/',
				'/login/',
				'/register/',
				'/restore-password/',
				'/social-auth/'
			]
		}
	}
}

export default robots
