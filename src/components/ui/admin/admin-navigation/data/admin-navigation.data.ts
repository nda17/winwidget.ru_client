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
		title: 'Контент',
		link: ADMIN_PAGES.CONTENT
	},
	{
		title: 'Настройки',
		link: ADMIN_PAGES.SETTINGS
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
