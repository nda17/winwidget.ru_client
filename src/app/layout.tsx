import '@/assets/styles/globals.scss'
import Layout from '@/components/layout/Layout'
import MainProvider from '@/providers/Main-provider/MainProvider'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
	metadataBase: new URL('https://winwidget.ru'),
	title: {
		default: 'Winwidget — виджеты для увеличения конверсии',
		template: '%s — Winwidget'
	},
	description:
		'Колесо фортуны и другие виджеты для сайта. Собирайте контакты посетителей через игровую механику. Простая установка за 10 минут.',
	openGraph: {
		siteName: 'Winwidget',
		locale: 'ru_RU',
		type: 'website',
		images: [{ url: '/og-image.png', width: 1200, height: 630 }]
	}
}

const inter = localFont({
	src: [
		{
			path: '../assets/fonts/inter/Inter-Regular.woff2',
			weight: '400',
			style: 'normal'
		},
		{
			path: '../assets/fonts/inter/Inter-Medium.woff2',
			weight: '500',
			style: 'normal'
		},
		{
			path: '../assets/fonts/inter/Inter-SemiBold.woff2',
			weight: '600',
			style: 'normal'
		},
		{
			path: '../assets/fonts/inter/Inter-Bold.woff2',
			weight: '700',
			style: 'normal'
		},
		{
			path: '../assets/fonts/inter/Inter-ExtraBold.woff2',
			weight: '800',
			style: 'normal'
		}
	],
	variable: '--font-inter',
	display: 'swap'
})

const roboto = localFont({
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
	display: 'swap'
})

const unbounded = localFont({
	src: [
		{
			path: '../assets/fonts/unbounded/Unbounded-Regular.woff2',
			weight: '400',
			style: 'normal'
		},
		{
			path: '../assets/fonts/unbounded/Unbounded-Medium.woff2',
			weight: '500',
			style: 'normal'
		},
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
	display: 'swap'
})

const poppins = localFont({
	src: [
		{
			path: '../assets/fonts/poppins/Poppins-Regular.woff2',
			weight: '400',
			style: 'normal'
		},
		{
			path: '../assets/fonts/poppins/Poppins-Medium.woff2',
			weight: '500',
			style: 'normal'
		},
		{
			path: '../assets/fonts/poppins/Poppins-SemiBold.woff2',
			weight: '600',
			style: 'normal'
		},
		{
			path: '../assets/fonts/poppins/Poppins-Bold.woff2',
			weight: '700',
			style: 'normal'
		}
	],
	variable: '--font-poppins',
	display: 'swap'
})

const RootLayout = ({ children }: PropsWithChildren<unknown>) => {
	return (
		<html
			lang="ru"
			className={`${inter.variable} ${roboto.variable} ${unbounded.variable} ${poppins.variable}`}
		>
			<body>
				<script
					src="https://api.winwidget.ru/widgets/wheel.js"
					data-key="e740f1eadbd4"
					async
				></script>
				<MainProvider>
					<Layout>{children}</Layout>
				</MainProvider>
			</body>
		</html>
	)
}

export default RootLayout
