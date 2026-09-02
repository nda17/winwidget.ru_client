import { IMenu } from '@/app/_ui/layout/nav-menu/desktop/menu/menu.interface'
import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'

export const staticMenu: IMenu = {
	items: [
		{
			icon: 'home',
			link: PUBLIC_PAGES.HOME,
			title: 'Главная'
		},
		{
			icon: 'dashboard',
			link: '#0',
			title: 'CRM',
			disabled: true,
			tooltip: 'Скоро'
		}
	]
}
