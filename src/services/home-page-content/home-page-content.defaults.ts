import type {
	HomePageContent,
	HomePageIntegrationIconKey,
	HomePagePricingPlan,
	HomePageSitemapChangeFrequency
} from '@/services/home-page-content/home-page-content.types'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const mergeObject = <T extends object>(
	fallback: T,
	value: unknown
): T => ({
	...clone(fallback),
	...(isRecord(value) ? value : {})
})

const mergeSimpleArray = <T extends object>(
	value: unknown,
	fallback: T[]
): T[] => {
	if (!Array.isArray(value)) return clone(fallback)

	return value.map((item, index) => ({
		...clone(fallback[index] ?? fallback[fallback.length - 1]),
		...(isRecord(item) ? item : {})
	})) as T[]
}

const mergeStringArray = (
	value: unknown,
	fallback: string[]
): string[] => {
	if (!Array.isArray(value)) return clone(fallback)

	return value.map(item => String(item))
}

const mergePaymentContent = (
	value: unknown,
	fallback: HomePageContent['payment']
): HomePageContent['payment'] => {
	if (!isRecord(value)) return clone(fallback)

	return {
		seoTitle:
			typeof value.seoTitle === 'string'
				? value.seoTitle
				: fallback.seoTitle,
		seoDescription:
			typeof value.seoDescription === 'string'
				? value.seoDescription
				: fallback.seoDescription
	}
}

const mergePricingPlans = (
	value: unknown,
	fallback: HomePagePricingPlan[]
): HomePagePricingPlan[] => {
	if (!Array.isArray(value)) return clone(fallback)

	return value.map((item, index) => {
		const base = clone(fallback[index] ?? fallback[fallback.length - 1])
		if (!isRecord(item)) return base

		return {
			...base,
			...item,
			features: Array.isArray(item.features)
				? item.features.map(feature => String(feature))
				: base.features,
			monthly: {
				...base.monthly,
				...(isRecord(item.monthly) ? item.monthly : {})
			},
			yearly: {
				...base.yearly,
				...(isRecord(item.yearly) ? item.yearly : {})
			}
		}
	})
}

const normalizeIconKey = (
	value: unknown,
	fallback: HomePageIntegrationIconKey
): HomePageIntegrationIconKey => {
	const allowed: HomePageIntegrationIconKey[] = [
		'email',
		'telegram',
		'webhook',
		'bitrix',
		'amocrm',
		'metrika',
		'vk',
		'roistat'
	]

	return allowed.includes(value as HomePageIntegrationIconKey)
		? (value as HomePageIntegrationIconKey)
		: fallback
}

const SITEMAP_CHANGE_FREQUENCIES: HomePageSitemapChangeFrequency[] = [
	'always',
	'hourly',
	'daily',
	'weekly',
	'monthly',
	'yearly',
	'never'
]

const normalizeSitemapChangeFrequency = (
	value: unknown,
	fallback: HomePageSitemapChangeFrequency
): HomePageSitemapChangeFrequency =>
	SITEMAP_CHANGE_FREQUENCIES.includes(
		value as HomePageSitemapChangeFrequency
	)
		? (value as HomePageSitemapChangeFrequency)
		: fallback

const normalizePath = (value: unknown, fallback: string): string => {
	const candidate = typeof value === 'string' ? value.trim() : ''
	if (!candidate) return fallback

	if (
		candidate.startsWith('http://') ||
		candidate.startsWith('https://')
	) {
		try {
			return new URL(candidate).pathname || '/'
		} catch {
			return fallback
		}
	}

	return candidate.startsWith('/') ? candidate : `/${candidate}`
}

const normalizeBaseUrl = (value: unknown, fallback: string): string => {
	const candidate = typeof value === 'string' ? value.trim() : ''
	if (!candidate) return fallback

	try {
		return new URL(candidate).origin
	} catch {
		return fallback
	}
}

const normalizePriority = (value: unknown, fallback: number): number => {
	const numeric = Number(value)
	if (!Number.isFinite(numeric)) return fallback

	return Math.min(1, Math.max(0, numeric))
}

const mergeRobotsDisallow = (
	value: unknown,
	fallback: string[]
): string[] => {
	if (!Array.isArray(value)) return clone(fallback)

	const lines = value.map(item => normalizePath(item, '')).filter(Boolean)

	return Array.from(new Set(lines))
}

const mergeSitemapItems = (
	value: unknown,
	fallback: HomePageContent['technicalSeo']['sitemapItems']
): HomePageContent['technicalSeo']['sitemapItems'] => {
	if (!Array.isArray(value)) return clone(fallback)

	return value.map((item, index) => {
		const base = clone(fallback[index] ?? fallback[fallback.length - 1])
		if (!isRecord(item)) return base

		return {
			...base,
			...item,
			path: normalizePath(item.path, base.path),
			changeFrequency: normalizeSitemapChangeFrequency(
				item.changeFrequency,
				base.changeFrequency
			),
			priority: normalizePriority(item.priority, base.priority),
			enabled:
				typeof item.enabled === 'boolean' ? item.enabled : base.enabled
		}
	})
}

export const DEFAULT_HOME_PAGE_FOOTER_CONTENT: HomePageContent['footer'] =
	{
		aboutTitle: 'О нас:',
		infoLines: ['ООО «ЮБС»', 'ИНН: 2700019628', 'ОГРН: 1232700016460'],
		email: 'info@winwidget.ru',
		vkUrl: 'https://vk.ru',
		telegramUrl: 'https://t.me/ybs_one',
		vkAriaLabel: 'Winwidget во ВКонтакте',
		telegramAriaLabel: 'Winwidget в Telegram'
	}

export const DEFAULT_HOME_PAGE_BODY_CONTENT: HomePageContent['body'] = {
	enabled: false,
	html: ''
}

export const DEFAULT_HOME_PAGE_HEAD_CONTENT: HomePageContent['head'] = {
	enabled: false,
	html: ''
}

export const DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT: HomePageContent['technicalSeo'] =
	{
		baseUrl: 'https://winwidget.ru',
		robotsDisallow: [
			'/admin/',
			'/cabinet/',
			'/wheels/',
			'/quizzes/',
			'/callbacks/',
			'/timers/',
			'/page-wheel/',
			'/page-quiz/',
			'/page-callback/',
			'/page-timer/',
			'/payment/',
			'/logout/',
			'/login/',
			'/register/',
			'/restore-password/',
			'/social-auth/'
		],
		sitemapItems: [
			{
				path: '/',
				changeFrequency: 'weekly',
				priority: 1,
				enabled: true
			},
			{
				path: '/legal-documentation/personal-policy',
				changeFrequency: 'yearly',
				priority: 0.3,
				enabled: true
			},
			{
				path: '/legal-documentation/consent-processing',
				changeFrequency: 'yearly',
				priority: 0.3,
				enabled: true
			},
			{
				path: '/legal-documentation/cookie-notice',
				changeFrequency: 'yearly',
				priority: 0.3,
				enabled: true
			},
			{
				path: '/legal-documentation/oferta',
				changeFrequency: 'yearly',
				priority: 0.3,
				enabled: true
			}
		]
	}

export const DEFAULT_HOME_PAGE_CONTENT: HomePageContent = {
	seo: {
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
		ogTitle: 'Winwidget — виджеты для увеличения конверсии сайта',
		ogDescription:
			'Колесо фортуны для сайта. Собирайте контакты посетителей через игровую механику. Интеграция с amoCRM, Битрикс24, Telegram.'
	},
	technicalSeo: DEFAULT_HOME_PAGE_TECHNICAL_SEO_CONTENT,
	demoWidgets: {
		enabled: true,
		bubbleTexts: {
			wheel: 'Испытайте удачу!',
			quiz: 'Поможем сделать выбор!',
			callback: 'Перезвоним вам за 5 минут',
			countdown: 'Супер-акция!'
		},
		labels: {
			wheel: 'Приз!',
			quiz: 'Квиз!\nПриз!',
			countdown: 'Акция'
		}
	},
	hero: {
		titleBeforeAccent: 'Увеличение конверсии\nсайта до',
		accentText: '30%',
		titleAfterAccent: 'с помощью умных виджетов',
		subtitle: 'Простая интеграция, заметный результат.',
		primaryButtonText: 'Попробовать бесплатно 7 дней',
		faqButtonLabel: 'Прокрутить к вопросам и ответам'
	},
	analysis: {
		enabled: true,
		title:
			'98% посетителей уходят с вашего сайта навсегда, не оставив контактов',
		subtitle:
			'Вы платите за рекламу, SEO и контент, но клиенты молча закрывают вкладку. Мы поможем их «зацепить», когда они:',
		cards: [
			{ text: 'Собираются уйти' },
			{ text: 'Долго листают страницу' },
			{ text: 'Сравнивают с конкурентами' },
			{ text: 'Хотят быстрой связи' }
		]
	},
	integrations: {
		enabled: true,
		title: 'Готовые интеграции для вашего бизнеса',
		items: [
			{
				title: 'Email',
				tag: 'Уведомления',
				description:
					'Мгновенное письмо с именем, призом и страницей при каждой заявке',
				iconKey: 'email'
			},
			{
				title: 'Telegram',
				tag: 'Мессенджер',
				description:
					'Уведомления прямо в чат — быстрее почты, всегда под рукой',
				iconKey: 'telegram'
			},
			{
				title: 'Webhook',
				tag: 'Интеграция',
				description:
					'POST-запрос с данными лида — подключите Make, Zapier или n8n',
				iconKey: 'webhook'
			},
			{
				title: 'Битрикс24',
				tag: 'CRM',
				description:
					'Лид с именем, телефоном и страницей создаётся автоматически',
				iconKey: 'bitrix'
			},
			{
				title: 'amoCRM',
				tag: 'CRM',
				description:
					'Новая сделка и контакт без ручного ввода при каждой заявке',
				iconKey: 'amocrm'
			},
			{
				title: 'Яндекс Метрика',
				tag: 'Аналитика',
				description:
					'Цели ip3_open и ip3_send — воронка от клика до заявки у вас в счётчике',
				iconKey: 'metrika'
			},
			{
				title: 'VK Ретаргетинг',
				tag: 'Реклама',
				description:
					'Аудитория для ретаргетинга ВКонтакте — показывайте рекламу тем, кто крутил',
				iconKey: 'vk'
			},
			{
				title: 'Roistat',
				tag: 'Аналитика',
				description:
					'Видите ROI каждого канала — события передаются без дополнительных настроек',
				iconKey: 'roistat'
			}
		]
	},
	tools: {
		enabled: true,
		title: 'Инструменты, которые влюбляют в ваш бренд',
		ctaText: 'Попробовать бесплатно 7 дней',
		items: [
			{
				title: 'Колесо Фортуны',
				description: 'Дарите скидки\nи бонусы за телефон и/или email',
				comingSoon: false,
				previewType: 'wheel'
			},
			{
				title: 'Квиз-опросы',
				description:
					'Сегментируйте клиентов\nи показывайте точный результат',
				comingSoon: false,
				previewType: 'quiz'
			},
			{
				title: 'Заказ звонка',
				description: 'Связывайтесь с клиентом\nпо его просьбе перезвонить',
				comingSoon: false,
				previewType: 'callback'
			},
			{
				title: 'Обратный отсчёт',
				description: 'Создавайте ощущение\nсрочности у покупателя',
				comingSoon: false,
				previewType: 'timer'
			},
			{
				title: 'Чат с оператором',
				description:
					'Консультируйте клиента\nавтономно с помощью нейросети',
				comingSoon: true,
				previewType: 'none'
			},
			{
				title: 'Ловец призов',
				description: 'Дайте возможность клиенту\nиспытать удачу',
				comingSoon: true,
				previewType: 'none'
			},
			{
				title: 'Супер-кликер',
				description:
					'Дайте возможность клиенту\nнакликать себе скидку\nза определенное время',
				comingSoon: true,
				previewType: 'none'
			}
		]
	},
	steps: {
		enabled: true,
		title: 'Установка проще, чем сварить кофе',
		resultText: 'Ловите\nгорячие\nлиды!',
		items: [
			{
				text: 'Настройте дизайн и логику виджета в личном кабинете'
			},
			{ text: 'Скопируйте одну строчку кода' },
			{ text: 'Вставьте в код своего сайта' }
		]
	},
	pricing: {
		enabled: true,
		title: 'Выберите удобный тариф',
		monthlyToggleText: 'Ежемесячно',
		yearlyToggleText: 'За год',
		discountText: '−60%',
		buttonText: 'Попробовать',
		plans: [
			{
				key: 'TRIAL',
				badge: '',
				title: 'Тест-драйв',
				subtitle: '1 виджет / 7 дней',
				features: [
					'1 виджет',
					'До 10 заявок',
					'Тестовый период - 7 дней',
					'Демонстрация работы всего функционала, доступного на платных тарифах'
				],
				monthly: { price: 'Бесплатно', priceNote: '' },
				yearly: { price: 'Бесплатно', priceNote: '' },
				star: false,
				popular: false
			},
			{
				key: 'EASY',
				badge: 'Выбор клиентов',
				title: 'Easy',
				subtitle: '1 виджет',
				features: [
					'100 заявок в месяц',
					'Хранение всех заявок в личном кабинете',
					'Email уведомления / Telegram',
					'Установка виджетов на сайт, открытие по прямой ссылке, QR-коду',
					'Интеграции с amoCRM, Bitrix24, Яндекс Метрика, VK Ретаргетинг, Roistat, по Webhook'
				],
				monthly: { price: '990 ₽', priceNote: 'в месяц' },
				yearly: {
					price: '390 ₽',
					priceNote: 'в месяц',
					yearlyTotal: '4 680 ₽/год'
				},
				star: true,
				popular: true
			},
			{
				key: 'HARD',
				badge: '',
				title: 'Hard',
				subtitle: '10 любых виджетов',
				features: [
					'Безлимитные заявки',
					'Хранение всех заявок в личном кабинете',
					'Установка виджетов на сайт, открытие по прямой ссылке, QR-коду',
					'Email уведомления / Telegram',
					'Аналитика бонусов',
					'Своя картинка кнопки открытия виджета',
					'Интеграции с amoCRM, Bitrix24, Яндекс Метрика, VK Ретаргетинг, Roistat, по Webhook',
					'Выгрузка заявок в Exсel, PDF, CSV'
				],
				monthly: { price: '1 690 ₽', priceNote: 'в месяц' },
				yearly: {
					price: '790 ₽',
					priceNote: 'в месяц',
					yearlyTotal: '9 480 ₽/год'
				},
				star: false,
				popular: false
			}
		]
	},
	payment: {
		seoTitle: 'Тарифы и оплата',
		seoDescription:
			'Тарифы Winwidget и оплата подписки через ЮKassa. Виджеты для увеличения конверсии сайта.'
	},
	faq: {
		enabled: true,
		title: 'Часто задаваемые вопросы',
		items: [
			{
				question: 'Для чего необходимы виджеты?',
				answerHtml:
					'Во-первых, виджеты помогают повысить конверсию сайта: захватывают внимание посетителя, мотивируют оставить контакт и получить скидку или бонус. Это увеличивает количество лидов без дополнительных затрат на рекламу.<br>Во-вторых, вы всегда имеете горячих лидов — ваш клиент обменивает свои контакты на ваш бонус.'
			},
			{
				question: 'Кому подходят виджеты?',
				answerHtml:
					'Бьюти-индустрии, банкам, e-com, туроператорам, авто-дилерам, гастрономии, медицине, производителям продуктов, одежды и так далее.'
			},
			{
				question: 'Как установить виджет?',
				answerHtml:
					'Зарегистрируйтесь, создайте виджет в личном кабинете, настройте внешний вид и призы. Скопируйте сгенерированный код и вставьте его перед закрывающим тегом &lt;/body&gt; на вашем сайте — виджет появится автоматически.'
			},
			{
				question:
					'Могу ли я настроить свои дизайн и функциональность виджета?',
				answerHtml:
					'Да, возможна полная кастомизация. В настройках виджета вы можете выбрать цвет колеса, кнопок, секторов, волчка и т.д. Также каждому сектору можно настроить процент выигрышных выпадений.'
			},
			{
				question:
					'Есть ли какая-либо защита от мошенничества со стороны моих клиентов при взаимодействии с бонусными виджетами?',
				answerHtml:
					'Да, во все наши виджеты внедрены различные механизмы антифрод-системы от мошенничества со стороны пользователей.'
			},
			{
				question:
					'Если у меня нет своего сайта, могу ли я проводить розыгрыши?',
				answerHtml:
					'Да! Для каждого виджета есть прямая ссылка — её можно разместить в социальных сетях, мессенджерах, рекламных объявлениях или отправить клиентам напрямую. Посетитель откроет страницу с колесом фортуны прямо в браузере без необходимости заходить на сайт.'
			},
			{
				question: 'Могу ли я оплатить с расчётного счёта ИП или ООО?',
				answerHtml:
					'Да, мы выставляем счета для юридических лиц и ИП. Напишите нам на <a href="mailto:info@winwidget.ru">info@winwidget.ru</a> или в <a href="https://t.me/ybs_one" target="_blank" rel="noopener noreferrer">Telegram</a> для выставления счёта.'
			},
			{
				question:
					'Если у нас закончилась подписка и мы не оплатили вовремя, сохранятся ли наши заявки и настройки нашего виджета?',
				answerHtml:
					'Да, все заявки и настройки сохраняются. После истечения подписки виджет на сайте перестаёт отображаться, но все данные в личном кабинете остаются нетронутыми. После оплаты виджет возобновит работу автоматически.'
			},
			{
				question: 'Как быстро я смогу пользоваться виджетом после оплаты?',
				answerHtml:
					'Мгновенно. Как только оплата подтверждена, подписка активируется автоматически и виджет начинает работать на вашем сайте.'
			},
			{
				question: 'Как подключить уведомления на Email?',
				answerHtml:
					'В настройках виджета перейдите во вкладку «Интеграции» и введите адрес электронной почты. После каждой новой заявки вы будете получать письмо с именем, телефоном, email посетителя, выигранным призом и страницей, на которой он крутил колесо.'
			},
			{
				question: 'Как подключить уведомления в Telegram?',
				answerHtml:
					'Откройте нашего Telegram-бота <a href="https://t.me/winwidget_info_bot" target="_blank" rel="noopener noreferrer">@winwidget_info_bot</a> и нажмите «Старт» — бот пришлёт вам ваш Chat ID. Вставьте этот ID в поле «Telegram Chat ID» во вкладке «Интеграции». После этого каждая новая заявка будет моментально приходить в Telegram.'
			},
			{
				question: 'Как интегрировать виджет с Битрикс24?',
				answerHtml:
					'<b>1.</b> В Битрикс24 перейдите в <b>Приложения → Вебхуки → Входящий вебхук</b>.<br><b>2.</b> Нажмите <b>«Добавить вебхук»</b>.<br><b>3.</b> В разделе <b>«Права»</b> включите <b>CRM</b> (crm).<br><b>4.</b> Нажмите <b>«Сохранить»</b>.<br><b>5.</b> Скопируйте <b>«Пример URL для вызова REST»</b> — ссылка вида <code>https://домен.bitrix24.ru/rest/1/токен/</code>.<br><b>6.</b> Вставьте её в поле <b>«Битрикс24 Webhook URL»</b> в настройках виджета и сохраните.<br><br>При каждой новой заявке в Битрикс24 будет автоматически создаваться <b>лид</b> с именем, телефоном, email, названием приза и ссылкой на страницу.'
			},
			{
				question: 'Как подключить amoCRM?',
				answerHtml:
					'<b>1.</b> Войдите в amoCRM → Настройки → Интеграции → вкладка <b>API</b>.<br><b>2.</b> Нажмите <b>«Показать ключи»</b> и скопируйте <b>Долгосрочный токен</b>.<br><b>3.</b> Скопируйте домен вашего аккаунта — вида <code>mycompany.amocrm.ru</code>.<br><b>4.</b> В настройках виджета (вкладка «Интеграции») вставьте домен и токен в соответствующие поля.<br><b>5.</b> Сохраните настройки.<br><br>При каждой новой заявке в amoCRM будут автоматически создаваться <b>сделка</b> и <b>контакт</b> с именем, телефоном, email и названием приза.'
			},
			{
				question: 'Как настроить Яндекс Метрику и ВКонтакте Пиксель?',
				answerHtml:
					'Убедитесь, что счётчик Яндекс Метрики или пиксель ВКонтакте уже установлен на вашем сайте. В настройках виджета укажите ID счётчика или пикселя. Виджет автоматически будет отправлять цели: ip3_open — при открытии колеса, ip3_send — при отправке заявки.'
			},
			{
				question: 'Как подключить Roistat?',
				answerHtml:
					'Установите счётчик Roistat на ваш сайт стандартным способом. В настройках виджета включите чекбокс «Roistat». Никакой дополнительной настройки не требуется — виджет автоматически определит наличие Roistat на странице и будет передавать события.'
			},
			{
				question: 'Как настроить Webhook (внешний URL)?',
				answerHtml:
					'Укажите URL вашего сервера или сервиса (например, Make, n8n, Zapier) в поле «Webhook URL». При каждой новой заявке мы отправим на этот адрес POST-запрос с данными лида в формате JSON: имя, телефон, email, приз, страница и дата.'
			}
		]
	},
	cta: {
		enabled: true,
		text: 'Попробуйте сейчас\nи начните получать больше заявок уже через 10 минут',
		buttonText: 'Начать бесплатный период'
	},
	footer: DEFAULT_HOME_PAGE_FOOTER_CONTENT,
	head: DEFAULT_HOME_PAGE_HEAD_CONTENT,
	body: DEFAULT_HOME_PAGE_BODY_CONTENT
}

export const normalizeHomePageContent = (
	value?: unknown
): HomePageContent => {
	if (!isRecord(value)) return clone(DEFAULT_HOME_PAGE_CONTENT)

	const content = value as Partial<HomePageContent>
	const defaultContent = clone(DEFAULT_HOME_PAGE_CONTENT)
	const integrations = mergeObject(
		defaultContent.integrations,
		content.integrations
	)

	const integrationItems: HomePageContent['integrations']['items'] =
		mergeSimpleArray(
			isRecord(content.integrations)
				? content.integrations.items
				: undefined,
			defaultContent.integrations.items
		).map((item, index) => ({
			...item,
			iconKey: normalizeIconKey(
				item.iconKey,
				defaultContent.integrations.items[index]?.iconKey ?? 'webhook'
			)
		}))

	return {
		...defaultContent,
		...content,
		seo: mergeObject(defaultContent.seo, content.seo),
		technicalSeo: {
			...mergeObject(defaultContent.technicalSeo, content.technicalSeo),
			baseUrl: normalizeBaseUrl(
				isRecord(content.technicalSeo)
					? content.technicalSeo.baseUrl
					: undefined,
				defaultContent.technicalSeo.baseUrl
			),
			robotsDisallow: mergeRobotsDisallow(
				isRecord(content.technicalSeo)
					? content.technicalSeo.robotsDisallow
					: undefined,
				defaultContent.technicalSeo.robotsDisallow
			),
			sitemapItems: mergeSitemapItems(
				isRecord(content.technicalSeo)
					? content.technicalSeo.sitemapItems
					: undefined,
				defaultContent.technicalSeo.sitemapItems
			)
		},
		demoWidgets: {
			...defaultContent.demoWidgets,
			...(isRecord(content.demoWidgets) ? content.demoWidgets : {}),
			bubbleTexts: {
				...defaultContent.demoWidgets.bubbleTexts,
				...(isRecord(content.demoWidgets?.bubbleTexts)
					? content.demoWidgets.bubbleTexts
					: {})
			},
			labels: {
				...defaultContent.demoWidgets.labels,
				...(isRecord(content.demoWidgets?.labels)
					? content.demoWidgets.labels
					: {})
			}
		},
		hero: mergeObject(defaultContent.hero, content.hero),
		analysis: {
			...defaultContent.analysis,
			...(isRecord(content.analysis) ? content.analysis : {}),
			cards: mergeSimpleArray(
				isRecord(content.analysis) ? content.analysis.cards : undefined,
				defaultContent.analysis.cards
			)
		},
		integrations: {
			...integrations,
			items: integrationItems
		},
		tools: {
			...defaultContent.tools,
			...(isRecord(content.tools) ? content.tools : {}),
			items: mergeSimpleArray(
				isRecord(content.tools) ? content.tools.items : undefined,
				defaultContent.tools.items
			)
		},
		steps: {
			...defaultContent.steps,
			...(isRecord(content.steps) ? content.steps : {}),
			items: mergeSimpleArray(
				isRecord(content.steps) ? content.steps.items : undefined,
				defaultContent.steps.items
			)
		},
		pricing: {
			...defaultContent.pricing,
			...(isRecord(content.pricing) ? content.pricing : {}),
			plans: mergePricingPlans(
				isRecord(content.pricing) ? content.pricing.plans : undefined,
				defaultContent.pricing.plans
			)
		},
		payment: mergePaymentContent(content.payment, defaultContent.payment),
		faq: {
			...defaultContent.faq,
			...(isRecord(content.faq) ? content.faq : {}),
			items: mergeSimpleArray(
				isRecord(content.faq) ? content.faq.items : undefined,
				defaultContent.faq.items
			)
		},
		cta: mergeObject(defaultContent.cta, content.cta),
		footer: {
			...mergeObject(defaultContent.footer, content.footer),
			infoLines: mergeStringArray(
				isRecord(content.footer) ? content.footer.infoLines : undefined,
				defaultContent.footer.infoLines
			)
		},
		head: {
			...mergeObject(defaultContent.head, content.head),
			enabled:
				isRecord(content.head) && typeof content.head.enabled === 'boolean'
					? content.head.enabled
					: defaultContent.head.enabled,
			html:
				isRecord(content.head) && typeof content.head.html === 'string'
					? content.head.html
					: defaultContent.head.html
		},
		body: {
			...mergeObject(defaultContent.body, content.body),
			enabled:
				isRecord(content.body) && typeof content.body.enabled === 'boolean'
					? content.body.enabled
					: defaultContent.body.enabled,
			html:
				isRecord(content.body) && typeof content.body.html === 'string'
					? content.body.html
					: defaultContent.body.html
		}
	}
}
