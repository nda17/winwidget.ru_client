const productionApiHost = process.env.NEXT_PUBLIC_PRODUCTION_HOST

export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ||
	(process.env.NEXT_PUBLIC_MODE === 'production' && productionApiHost
		? `${productionApiHost}/api/v1`
		: 'http://localhost:4100/api/v1')

export const WIDGETS_HOST = (
	process.env.NEXT_PUBLIC_WIDGETS_HOST ||
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? productionApiHost || 'https://api.winwidget.ru'
		: 'http://localhost:4700')
).replace(/\/+$/, '')
