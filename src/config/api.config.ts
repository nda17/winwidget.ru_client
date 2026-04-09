export const API_URL =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? `${process.env.NEXT_PUBLIC_PRODUCTION_HOST}/api`
		: `${process.env.NEXT_PUBLIC_DEVELOPMENT_HOST}/api`
