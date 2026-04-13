import '@/assets/styles/globals.scss'
import Layout from '@/components/layout/Layout'
import MainProvider from '@/providers/main-provider/MainProvider'
import type { Metadata } from 'next'
import { PropsWithChildren } from 'react'

export const metadata: Metadata = {
	title: 'Winwidget.ru',
	description: 'Виджеты для генерации продаж'
}

const RootLayout = ({ children }: PropsWithChildren<unknown>) => {
	return (
		<html lang="en">
			<body style={{ fontFamily: 'monospace' }}>
				<MainProvider>
					<Layout>{children}</Layout>
				</MainProvider>
			</body>
		</html>
	)
}

export default RootLayout
