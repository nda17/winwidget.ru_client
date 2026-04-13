import { MetadataRoute } from 'next'

const robots = (): MetadataRoute.Robots => {
	return {
		rules: {
			userAgent: '*',
			disallow: ['/auth/', '/profile/', '/manager/', '/admin/']
		}
	}
}

export default robots
