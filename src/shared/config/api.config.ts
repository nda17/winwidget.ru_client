const apiHost =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST

export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ||
	(apiHost ? `${apiHost}/api` : 'http://localhost:4200/api')
