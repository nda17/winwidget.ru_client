import { IMenu } from '@/components/layout/nav-menu/desktop/menu/menu.interface'
import { PUBLIC_PAGES } from '@/config/pages/public.config'

export const staticMenu: IMenu = {
	items: [
		{
			icon: 'MdHomeWork',
			link: PUBLIC_PAGES.HOME,
			title: 'Главная'
		},
		{
			icon: 'MdCheckCircle',
			link: PUBLIC_PAGES.FREE_CONTENT,
			title: 'Бесплатно'
		},
		{
			icon: 'MdPaid',
			link: PUBLIC_PAGES.PREMIUM_CONTENT,
			title: 'Премиум'
		}
	]
}
