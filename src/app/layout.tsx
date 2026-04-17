import '@/assets/styles/globals.scss'
import Layout from '@/components/layout/Layout'
import MainProvider from '@/providers/main-provider/MainProvider'
import type { Metadata } from 'next'
import { Inter, Poppins, Roboto, Unbounded } from 'next/font/google'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
	metadataBase: new URL('https://winwidget.ru'),
	title: {
		default: 'WinWidget — виджеты для увеличения конверсии',
		template: '%s — WinWidget'
	},
	description:
		'Колесо фортуны и другие виджеты для сайта. Собирайте контакты посетителей через игровую механику. Простая установка за 10 минут.',
	openGraph: {
		siteName: 'WinWidget',
		locale: 'ru_RU',
		type: 'website',
		images: [{ url: '/og-image.png', width: 1200, height: 630 }]
	}
}

const inter = Inter({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700', '800'],
	variable: '--font-inter',
	display: 'swap'
})

const roboto = Roboto({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '700'],
	variable: '--font-roboto',
	display: 'swap'
})

const unbounded = Unbounded({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700', '800'],
	variable: '--font-unbounded',
	display: 'swap'
})

const poppins = Poppins({
	subsets: ['latin'],
	weight: ['400', '500', '600', '700'],
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
				<MainProvider>
					<Layout>{children}</Layout>
				</MainProvider>
			</body>
		</html>
	)
}

export default RootLayout
