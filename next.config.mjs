/** @type {import('next').NextConfig} */
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
			source: '/page-ai-consultant/:path*',
			headers: [
				...widgetPreviewFrameHeaders,
				{
					key: 'X-Robots-Tag',
					value: 'noindex, nofollow, noarchive'
				}
			]
		},
		{
			source: '/page-calculator/:path*',
			headers: widgetPreviewFrameHeaders
		}
	],
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
