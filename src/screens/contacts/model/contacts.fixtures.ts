export type ContactViewModel = {
	id: string
	name: string
	initials: string
	company: string
	phone: string
	email: string
	openDeals: number
	lastActivity: string
}

export const contacts: ContactViewModel[] = [
	{
		id: 'demo-contact-001',
		name: 'Анна Демова',
		initials: 'АД',
		company: 'Demo Studio',
		phone: '+7 (900) 000-00-01',
		email: 'anna@example.test',
		openDeals: 1,
		lastActivity: 'Сегодня, 10:24'
	},
	{
		id: 'demo-contact-002',
		name: 'Максим Тестов',
		initials: 'МТ',
		company: 'Example Lab',
		phone: '+7 (900) 000-00-02',
		email: 'maxim@example.test',
		openDeals: 1,
		lastActivity: 'Сегодня, 09:48'
	},
	{
		id: 'demo-contact-003',
		name: 'Елена Примерова',
		initials: 'ЕП',
		company: 'Тестовая компания',
		phone: '+7 (900) 000-00-03',
		email: 'elena@example.test',
		openDeals: 1,
		lastActivity: 'Вчера, 18:17'
	},
	{
		id: 'demo-contact-004',
		name: 'Сергей Визуальный',
		initials: 'СВ',
		company: 'Canvas Example',
		phone: '+7 (900) 000-00-05',
		email: 'sergey@example.test',
		openDeals: 2,
		lastActivity: 'Вчера, 12:40'
	}
]
