import Layout from '@/app/_ui/layout/Layout'
import { brandUnbounded } from '@/app/config/fonts'
import AppProviders from '@/app/providers/AppProviders'
import '@/app/styles/globals.scss'
import { EnumTokens } from '@/shared/api/token-names'
import { getHomePageContent } from '@/entities/home-page-content/server'
import { getSiteSettings } from '@/entities/site-settings/server'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import type { PropsWithChildren } from 'react'

export const metadata: Metadata = {
	metadataBase: new URL('https://winwidget.ru'),
	title: {
		default: 'Рабочее приложение WinWidget',
		template: '%s — WinWidget'
	},
	robots: { index: false, follow: false },
	icons: { icon: '/favicon.ico', apple: '/apple-icon.png' }
}

export default async function WidgetsRootLayout({
	children
}: PropsWithChildren) {
	const [siteSettings, content, cookieStore] = await Promise.all([
		getSiteSettings(),
		getHomePageContent(),
		cookies()
	])
	const hasSessionHint = Boolean(
		cookieStore.get(EnumTokens.ACCESS_TOKEN)?.value ||
		cookieStore.get(EnumTokens.REFRESH_TOKEN)?.value
	)
	return (
		<html lang="ru" className={brandUnbounded.variable}>
			<body>
				<AppProviders hasSessionHint={hasSessionHint}>
					<Layout
						siteSettings={siteSettings}
						footerContent={content.footer}
					>
						{children}
					</Layout>
				</AppProviders>
			</body>
		</html>
	)
}
