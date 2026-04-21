import { IMenu } from '@/components/layout/nav-menu/desktop/menu/menu.interface'
import { PUBLIC_PAGES } from '@/config/pages/public.config'

export const staticMenu: IMenu = {
	items: [
		{
			icon: 'home',
			link: PUBLIC_PAGES.HOME,
			title: 'Главная'
		}
	]
}
