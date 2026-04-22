import '@/assets/styles/globals.scss'
import { criticalRoboto, criticalUnbounded } from '@/app/fonts'
import Layout from '@/components/layout/Layout'
import MainProvider from '@/providers/Main-provider/MainProvider'
import { EnumTokens } from '@/services/auth/auth.service'
import { getSiteSettings } from '@/services/site-settings/site-settings.server'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
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

const RootLayout = async ({ children }: PropsWithChildren<unknown>) => {
	const siteSettings = await getSiteSettings()
	const cookieStore = await cookies()
	const hasSessionHint = Boolean(
		cookieStore.get(EnumTokens.ACCESS_TOKEN)?.value ||
		cookieStore.get(EnumTokens.REFRESH_TOKEN)?.value
	)

	return (
		<html
			lang="ru"
			className={`${criticalRoboto.variable} ${criticalUnbounded.variable}`}
		>
			<body>
				<MainProvider hasSessionHint={hasSessionHint}>
					<Layout siteSettings={siteSettings}>{children}</Layout>
				</MainProvider>
			</body>
		</html>
	)
}

export default RootLayout
