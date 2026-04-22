import '@/assets/styles/globals.scss'
import Layout from '@/components/layout/Layout'
import MainProvider from '@/providers/Main-provider/MainProvider'
import { getSiteSettings } from '@/services/site-settings/site-settings.server'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import type { PropsWithChildren } from 'react'

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

const RootLayout = async ({ children }: PropsWithChildren<unknown>) => {
	const siteSettings = await getSiteSettings()

	return (
		<html lang="ru" className={`${roboto.variable} ${unbounded.variable}`}>
			<body>
				<MainProvider>
					<Layout siteSettings={siteSettings}>{children}</Layout>
				</MainProvider>
			</body>
		</html>
	)
}

export default RootLayout
