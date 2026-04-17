import Home from '@/components/screens/home/Home'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Winwidget — виджеты для увеличения конверсии сайта',
	description:
		'Колесо фортуны для сайта. Собирайте телефоны и email посетителей через игровую механику. Интеграция с amoCRM, Битрикс24, Telegram. Попробуйте бесплатно 7 дней.',
	keywords: [
		'виджет колесо фортуны',
		'виджет для сайта',
		'увеличение конверсии',
		'сбор лидов',
		'генерация лидов',
		'winwidget'
	],
	openGraph: {
		title: 'Winwidget — виджеты для увеличения конверсии сайта',
		description:
			'Колесо фортуны для сайта. Собирайте контакты посетителей через игровую механику. Интеграция с amoCRM, Битрикс24, Telegram.',
		url: 'https://winwidget.ru',
		type: 'website',
		images: [
			{ url: '/og-image.png', width: 1200, height: 630, alt: 'Winwidget' }
		]
	},
	alternates: {
		canonical: 'https://winwidget.ru'
	}
}

const HomePage = async () => {
	return <Home />
}

export default HomePage
