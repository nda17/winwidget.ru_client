/** @type {import('next').NextConfig} */
const apiBase =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'

const widgetPreviewFrameHeaders = [
	{
		key: 'Content-Security-Policy',
		value: "frame-ancestors 'self'"
	},
	{
		key: 'X-Frame-Options',
		value: 'SAMEORIGIN'
	}
]

const nextConfig = {
	output: 'standalone',
	headers: () => [
		{
			source: '/page-wheel/:path*',
			headers: widgetPreviewFrameHeaders
		},
		{
			source: '/page-quiz/:path*',
			headers: widgetPreviewFrameHeaders
		},
		{
			source: '/page-callback/:path*',
			headers: widgetPreviewFrameHeaders
		},
		{
			source: '/page-timer/:path*',
			headers: widgetPreviewFrameHeaders
		},
		{
			source: '/page-stop-offer/:path*',
			headers: widgetPreviewFrameHeaders
		},
		{
			source: '/page-online-consultant/:path*',
			headers: widgetPreviewFrameHeaders
		},
		{
			source: '/page-calculator/:path*',
			headers: widgetPreviewFrameHeaders
		}
	],
	rewrites: () => {
		return [
			{
				source: '/auth/google',
				destination: `${apiBase}/auth/google`
			},
			{
				source: '/auth/github',
				destination: `${apiBase}/auth/github`
			},
			{
				source: '/auth/yandex',
				destination: `${apiBase}/auth/yandex`
			},
			{
				source: '/auth/vk',
				destination: `${apiBase}/auth/vk`
			},
			{
				source: '/uploads/:path*',
				destination: `${apiBase}/uploads/:path*`
			}
		]
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
				port: '',
				pathname: '/**'
			},
			{
				protocol: 'https',
				hostname: 'avatars.githubusercontent.com',
				port: '',
				pathname: '/**'
			},
			{
				protocol: 'https',
				hostname: 'avatars.yandex.net',
				port: '',
				pathname: '/**'
			},
			{
				protocol: 'https',
				hostname: 'winwidget.ru',
				port: '',
				pathname: '/uploads/**'
			},
			{
				protocol: 'https',
				hostname: 's3.twcstorage.ru',
				port: '',
				pathname: '/**'
			},
			{
				protocol: 'https',
				hostname: 'cdn.winwidget.ru',
				port: '',
				pathname: '/**'
			}
		]
	}
}

export default nextConfig
