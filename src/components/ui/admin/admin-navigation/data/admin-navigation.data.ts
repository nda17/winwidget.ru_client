import { INavItem } from '@/components/ui/admin/admin-navigation/admin-navigation.interface'
import { ADMIN_PAGES } from '@/config/pages/admin.config'

export const navItems: INavItem[] = [
	{
		title: 'Статистика',
		link: ADMIN_PAGES.HOME
	},
	{
		title: 'Пользователи',
		link: ADMIN_PAGES.USER_LIST,
		option: ADMIN_PAGES.USER
	},
	{
		title: 'Подписки',
		link: ADMIN_PAGES.SUBSCRIPTIONS
	},
	{
		title: 'Платежи',
		link: ADMIN_PAGES.PAYMENTS
	},
	{
		title: 'Telegram-бот',
		link: ADMIN_PAGES.TELEGRAM_BOT
	},
	{
		title: 'Тарифы',
		link: ADMIN_PAGES.TARIFFS
	},
	{
		title: 'Контент',
		link: ADMIN_PAGES.CONTENT
	},
	{
		title: 'Настройки',
		link: ADMIN_PAGES.SETTINGS
	},
	{
		title: 'Рассылки',
		link: ADMIN_PAGES.MAILINGS
	},
	{
		title: 'Журнал событий',
		link: ADMIN_PAGES.EVENT_LOG
	},
	{
		title: 'Система',
		link: ADMIN_PAGES.SYSTEM
	},
	{
		title: 'Бэклог',
		link: ADMIN_PAGES.BACKLOG
	}
]
