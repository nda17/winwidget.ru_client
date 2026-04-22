import localFont from 'next/font/local'

export const criticalRoboto = localFont({
	src: [
		{
			path: '../assets/fonts/roboto/Roboto-Regular.woff2',
			weight: '400',
			style: 'normal'
		}
	],
	variable: '--font-roboto',
	display: 'swap'
})

export const criticalUnbounded = localFont({
	src: [
		{
			path: '../assets/fonts/unbounded/Unbounded-SemiBold.woff2',
			weight: '600',
			style: 'normal'
		}
	],
	variable: '--font-unbounded',
	display: 'optional',
	fallback: ['Arial', 'Helvetica', 'sans-serif']
})

export const fullRoboto = localFont({
	src: [
		{
			path: '../assets/fonts/roboto/Roboto-Regular.woff2',
			weight: '400',
			style: 'normal'
		},
		{
			path: '../assets/fonts/roboto/Roboto-Medium.woff2',
			weight: '500',
			style: 'normal'
		},
		{
			path: '../assets/fonts/roboto/Roboto-Bold.woff2',
			weight: '700',
			style: 'normal'
		}
	],
	variable: '--font-roboto',
	display: 'swap',
	preload: false
})

export const fullUnbounded = localFont({
	src: [
		{
			path: '../assets/fonts/unbounded/Unbounded-SemiBold.woff2',
			weight: '600',
			style: 'normal'
		},
		{
			path: '../assets/fonts/unbounded/Unbounded-Bold.woff2',
			weight: '700',
			style: 'normal'
		},
		{
			path: '../assets/fonts/unbounded/Unbounded-ExtraBold.woff2',
			weight: '800',
			style: 'normal'
		}
	],
	variable: '--font-unbounded',
	display: 'swap',
	preload: false
})
