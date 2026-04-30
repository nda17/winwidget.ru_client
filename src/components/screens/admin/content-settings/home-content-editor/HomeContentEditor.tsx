'use client'

import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog'
import { revalidateHomePageContent } from '@/services/home-page-content/home-page-content.actions'
import { normalizeHomePageContent } from '@/services/home-page-content/home-page-content.defaults'
import homePageContentService from '@/services/home-page-content/home-page-content.service'
import type {
	HomePageContent,
	HomePageIntegrationIconKey,
	HomePageIntegrationItem,
	HomePagePricingPlan,
	HomePageSitemapChangeFrequency,
	HomePageSitemapItem,
	HomePageTextCard,
	HomePageToolItem,
	HomePageToolPreviewType
} from '@/services/home-page-content/home-page-content.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './HomeContentEditor.module.scss'

const ICON_OPTIONS: Array<{
	value: HomePageIntegrationIconKey
	label: string
}> = [
	{ value: 'email', label: 'Email' },
	{ value: 'telegram', label: 'Telegram' },
	{ value: 'webhook', label: 'Webhook' },
	{ value: 'bitrix', label: 'Битрикс24' },
	{ value: 'amocrm', label: 'amoCRM' },
	{ value: 'metrika', label: 'Яндекс Метрика' },
	{ value: 'vk', label: 'VK Ретаргетинг' },
	{ value: 'roistat', label: 'Roistat' }
]

const PREVIEW_OPTIONS: Array<{
	value: HomePageToolPreviewType
	label: string
}> = [
	{ value: 'wheel', label: 'Колесо' },
	{ value: 'quiz', label: 'Квиз' },
	{ value: 'callback', label: 'Звонок' },
	{ value: 'timer', label: 'Таймер' },
	{ value: 'none', label: 'Без превью' }
]

const SITEMAP_CHANGE_FREQUENCY_OPTIONS: Array<{
	value: HomePageSitemapChangeFrequency
	label: string
}> = [
	{ value: 'always', label: 'Всегда' },
	{ value: 'hourly', label: 'Каждый час' },
	{ value: 'daily', label: 'Каждый день' },
	{ value: 'weekly', label: 'Каждую неделю' },
	{ value: 'monthly', label: 'Каждый месяц' },
	{ value: 'yearly', label: 'Каждый год' },
	{ value: 'never', label: 'Никогда' }
]

export type HomeContentEditorArea =
	| 'home'
	| 'footer'
	| 'seo'
	| 'demo'
	| 'head'
	| 'body'

const EDITOR_META: Record<
	HomeContentEditorArea,
	{
		title: string
		helpTitle: string
		helpDescription: string
		riskText: string
		hint: string
		saveLabel: string
		loadingText: string
		successText: string
		resetLoadingText?: string
		resetSuccessText?: string
	}
> = {
	home: {
		title: 'Главная страница',
		helpTitle: 'Общий редактор главной',
		helpDescription:
			'Здесь собраны основные секции главной страницы: первый экран, блоки, тарифы, FAQ и CTA.',
		riskText:
			'Ошибки в важных текстах сразу увидят посетители. Перед сохранением проверьте смысл, переносы строк и ссылки.',
		hint: 'Изменения попадут на публичную главную после сохранения.',
		saveLabel: 'Сохранить главную',
		loadingText: 'Загрузка контента главной...',
		successText: 'Контент главной сохранён'
	},
	footer: {
		title: 'Footer',
		helpTitle: 'Редактор футера',
		helpDescription:
			'Управляет блоком «О нас», контактами, ссылками на соцсети и юридической информацией в футере.',
		riskText:
			'Эти данные видны на всех страницах с футером. Перед сохранением проверьте реквизиты, email и внешние ссылки.',
		hint: 'Изменения блока «О нас» попадут в футер после сохранения.',
		saveLabel: 'Сохранить footer',
		loadingText: 'Загрузка footer...',
		successText: 'Footer сохранён',
		resetLoadingText: 'Сбрасываем footer...',
		resetSuccessText: 'Footer сброшен к дефолту'
	},
	seo: {
		title: 'SEO',
		helpTitle: 'SEO-настройки',
		helpDescription:
			'Управляет SEO главной страницы, robots.txt и sitemap.xml.',
		riskText:
			'Ошибки в SEO могут ухудшить сниппеты, индексацию или открыть служебные разделы поисковикам.',
		hint: 'После сохранения обновятся SEO главной, robots.txt и sitemap.xml.',
		saveLabel: 'Сохранить SEO',
		loadingText: 'Загрузка SEO-настроек...',
		successText: 'SEO-настройки сохранены',
		resetLoadingText: 'Сбрасываем SEO...',
		resetSuccessText: 'SEO сброшен к дефолту'
	},
	demo: {
		title: 'Демо-виджеты',
		helpTitle: 'Контент демо-виджетов',
		helpDescription:
			'Управляет плавающим демо-виджетом на главной: облачками, подписями и видимостью.',
		riskText:
			'Если выключить блок или написать непонятный текст, посетитель хуже увидит живой пример продукта.',
		hint: 'Изменения демо-виджетов попадут на главную после сохранения.',
		saveLabel: 'Сохранить демо',
		loadingText: 'Загрузка демо-виджетов...',
		successText: 'Демо-виджеты сохранены',
		resetLoadingText: 'Сбрасываем демо-виджеты...',
		resetSuccessText: 'Демо-виджеты сброшены к дефолту'
	},
	body: {
		title: 'Body',
		helpTitle: 'Вставка перед </body>',
		helpDescription:
			'Позволяет добавить HTML или скрипты, которые будут выведены в конце body на всех страницах.',
		riskText:
			'Код выполняется на сайте. Вставляйте только доверенные скрипты, иначе можно сломать страницы или создать XSS-риск.',
		hint: 'После сохранения код будет выведен перед закрывающим тегом body.',
		saveLabel: 'Сохранить Body',
		loadingText: 'Загрузка Body...',
		successText: 'Body сохранён',
		resetLoadingText: 'Сбрасываем Body...',
		resetSuccessText: 'Body сброшен к дефолту'
	},
	head: {
		title: 'Head',
		helpTitle: 'Вставка в <head>',
		helpDescription:
			'Позволяет добавить HTML или скрипты, которые будут выведены внутри head на всех страницах.',
		riskText:
			'Код попадает в head сайта. Вставляйте только доверенные теги, иначе можно сломать SEO, загрузку страниц или создать XSS-риск.',
		hint: 'После сохранения код будет выведен внутри тега head.',
		saveLabel: 'Сохранить Head',
		loadingText: 'Загрузка Head...',
		successText: 'Head сохранён'
	}
}

type RiskLevel = 'low' | 'medium' | 'high'

interface HelpTooltipProps {
	title: string
	description: string
	risk: RiskLevel
	riskText: string
}

const riskLabel: Record<RiskLevel, string> = {
	low: 'Низкая опасность',
	medium: 'Средняя опасность',
	high: 'Высокая опасность'
}

const HelpTooltip = ({
	title,
	description,
	risk,
	riskText
}: HelpTooltipProps) => {
	const [isOpen, setIsOpen] = useState(false)
	const wrapperRef = useRef<HTMLSpanElement>(null)
	const tooltipId = useId()

	useEffect(() => {
		if (!isOpen) return

		const closeOnOutsideClick = (event: PointerEvent) => {
			if (
				wrapperRef.current &&
				!wrapperRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false)
		}

		document.addEventListener('pointerdown', closeOnOutsideClick)
		document.addEventListener('keydown', closeOnEscape)

		return () => {
			document.removeEventListener('pointerdown', closeOnOutsideClick)
			document.removeEventListener('keydown', closeOnEscape)
		}
	}, [isOpen])

	return (
		<span
			ref={wrapperRef}
			className={styles.help}
			onMouseEnter={() => setIsOpen(true)}
			onMouseLeave={() => setIsOpen(false)}
		>
			<button
				type="button"
				className={styles.helpBtn}
				aria-label={`Подсказка: ${title}`}
				aria-expanded={isOpen}
				aria-describedby={isOpen ? tooltipId : undefined}
				onClick={() => setIsOpen(prev => !prev)}
				onFocus={() => setIsOpen(true)}
			>
				?
			</button>
			{isOpen && (
				<span id={tooltipId} role="tooltip" className={styles.tooltip}>
					<span className={styles.tooltipTitle}>{title}</span>
					<span className={styles.tooltipText}>{description}</span>
					<span
						className={`${styles.riskBadge} ${styles[`risk-${risk}`]}`}
					>
						{riskLabel[risk]}
					</span>
					<span className={styles.tooltipRisk}>{riskText}</span>
				</span>
			)}
		</span>
	)
}

interface SectionTitleProps extends HelpTooltipProps {
	children: string
	danger?: boolean
}

const SectionTitle = ({
	children,
	danger,
	...tooltip
}: SectionTitleProps) => (
	<div className={styles.titleWithHelp}>
		<h3 className={danger ? styles.dangerTitle : styles.panelTitle}>
			{children}
		</h3>
		<HelpTooltip {...tooltip} />
	</div>
)

const moveItem = <T,>(
	items: T[],
	index: number,
	direction: -1 | 1
): T[] => {
	const nextIndex = index + direction
	if (nextIndex < 0 || nextIndex >= items.length) return items

	const next = [...items]
	const current = next[index]
	next[index] = next[nextIndex]
	next[nextIndex] = current

	return next
}

const updateItem = <T extends object>(
	items: T[],
	index: number,
	patch: Partial<T>
): T[] =>
	items.map((item, itemIndex) =>
		itemIndex === index ? { ...item, ...patch } : item
	)

const removeItem = <T,>(items: T[], index: number): T[] =>
	items.filter((_, itemIndex) => itemIndex !== index)

const featuresToText = (features: string[]) => features.join('\n')

const textToFeatures = (value: string) => value.split('\n')

const cleanStringList = (items: string[]) =>
	items.map(item => item.trim()).filter(Boolean)

const prepareContentForSave = (
	content: HomePageContent
): HomePageContent => ({
	...content,
	seo: {
		...content.seo,
		keywords: cleanStringList(content.seo.keywords)
	},
	technicalSeo: {
		...content.technicalSeo,
		robotsDisallow: cleanStringList(content.technicalSeo.robotsDisallow)
	},
	pricing: {
		...content.pricing,
		plans: content.pricing.plans.map(plan => ({
			...plan,
			features: cleanStringList(plan.features)
		}))
	},
	footer: {
		...content.footer,
		infoLines: cleanStringList(content.footer.infoLines)
	}
})

const normalizePriorityInput = (value: string) => {
	const numeric = Number(value)
	if (!Number.isFinite(numeric)) return 0

	return Math.min(1, Math.max(0, numeric))
}

interface TextFieldProps {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
}

const TextField = ({
	id,
	label,
	value,
	onChange,
	placeholder
}: TextFieldProps) => (
	<div className={styles.field}>
		<label htmlFor={id} className={styles.fieldLabel}>
			{label}
		</label>
		<input
			id={id}
			className={styles.input}
			value={value}
			onChange={event => onChange(event.target.value)}
			placeholder={placeholder}
		/>
	</div>
)

interface TextAreaFieldProps extends TextFieldProps {
	rows?: number
	hint?: string
}

const TextAreaField = ({
	id,
	label,
	value,
	onChange,
	placeholder,
	rows = 3,
	hint
}: TextAreaFieldProps) => (
	<div className={styles.field}>
		<label htmlFor={id} className={styles.fieldLabel}>
			{label}
		</label>
		<textarea
			id={id}
			className={styles.textarea}
			value={value}
			onChange={event => onChange(event.target.value)}
			placeholder={placeholder}
			rows={rows}
		/>
		{hint && <span className={styles.fieldHint}>{hint}</span>}
	</div>
)

interface ToggleFieldProps {
	label: string
	checked: boolean
	onChange: (checked: boolean) => void
	hint?: string
}

const ToggleField = ({
	label,
	checked,
	onChange,
	hint
}: ToggleFieldProps) => (
	<label className={styles.toggleField}>
		<input
			type="checkbox"
			checked={checked}
			onChange={event => onChange(event.target.checked)}
		/>
		<span className={styles.toggleVisual} />
		<span className={styles.toggleText}>
			<span className={styles.fieldLabel}>{label}</span>
			{hint && <span className={styles.fieldHint}>{hint}</span>}
		</span>
	</label>
)

interface ListActionsProps {
	onMoveUp: () => void
	onMoveDown: () => void
	onRemove: () => void
	disableUp: boolean
	disableDown: boolean
}

const ListActions = ({
	onMoveUp,
	onMoveDown,
	onRemove,
	disableUp,
	disableDown
}: ListActionsProps) => (
	<div className={styles.itemActions}>
		<button
			type="button"
			className={styles.smallBtn}
			onClick={onMoveUp}
			disabled={disableUp}
		>
			Выше
		</button>
		<button
			type="button"
			className={styles.smallBtn}
			onClick={onMoveDown}
			disabled={disableDown}
		>
			Ниже
		</button>
		<button type="button" className={styles.dangerBtn} onClick={onRemove}>
			Удалить
		</button>
	</div>
)

interface HomeContentEditorProps {
	area?: HomeContentEditorArea
}

const HomeContentEditor = ({ area = 'home' }: HomeContentEditorProps) => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const router = useRouter()
	const meta = EDITOR_META[area]
	const isHomeArea = area === 'home'
	const isFooterArea = area === 'footer'
	const isSeoArea = area === 'seo'
	const isDemoArea = area === 'demo'
	const isBodyArea = area === 'body'
	const isHeadArea = area === 'head'
	const defaultContent = useMemo(() => normalizeHomePageContent(), [])
	const [draft, setDraft] = useState<HomePageContent>(defaultContent)
	const [showFactoryResetConfirm, setShowFactoryResetConfirm] =
		useState(false)

	const { data, isLoading } = useQuery({
		queryKey: ['home-page-content'],
		queryFn: homePageContentService.get,
		enabled: Boolean(auth)
	})

	useEffect(() => {
		if (data?.content) setDraft(data.content)
	}, [data])

	const mutation = useMutation({
		mutationFn: homePageContentService.update,
		onSuccess: async result => {
			setDraft(result.content)
			await queryClient.invalidateQueries({
				queryKey: ['home-page-content']
			})
			await revalidateHomePageContent()
			router.refresh()
		}
	})

	const persistedContent =
		mutation.data?.content ?? data?.content ?? defaultContent
	const isDirty =
		JSON.stringify(draft) !== JSON.stringify(persistedContent)

	const save = () => {
		const promise = mutation.mutateAsync(prepareContentForSave(draft))

		toast.promise(promise, {
			loading: 'Сохраняем...',
			success: meta.successText,
			error: 'Ошибка сохранения'
		})
	}

	const factoryReset = () => {
		const defaultHomeContent = normalizeHomePageContent()
		const nextContent: HomePageContent = {
			...draft,
			hero: defaultHomeContent.hero,
			analysis: defaultHomeContent.analysis,
			integrations: defaultHomeContent.integrations,
			tools: defaultHomeContent.tools,
			steps: defaultHomeContent.steps,
			pricing: defaultHomeContent.pricing,
			faq: defaultHomeContent.faq,
			cta: defaultHomeContent.cta
		}
		setShowFactoryResetConfirm(false)
		setDraft(nextContent)

		const promise = mutation.mutateAsync(nextContent)

		toast.promise(promise, {
			loading: 'Сбрасываем главную...',
			success: 'Главная сброшена до заводских настроек',
			error: 'Ошибка сброса главной'
		})
	}

	const resetAreaToDefault = () => {
		const nextContent: HomePageContent = { ...persistedContent }

		if (isFooterArea) {
			nextContent.footer = defaultContent.footer
		}

		if (isSeoArea) {
			nextContent.seo = defaultContent.seo
			nextContent.technicalSeo = defaultContent.technicalSeo
		}

		if (isDemoArea) {
			nextContent.demoWidgets = defaultContent.demoWidgets
		}

		setDraft(nextContent)

		const promise = mutation.mutateAsync(nextContent)

		toast.promise(promise, {
			loading: meta.resetLoadingText ?? 'Сбрасываем...',
			success: meta.resetSuccessText ?? 'Сброшено к дефолту',
			error: 'Ошибка сброса'
		})
	}

	const updateDraft = (
		updater: (content: HomePageContent) => HomePageContent
	) => setDraft(prev => updater(prev))

	const updateCardList = (
		section: 'analysis' | 'steps',
		items: HomePageTextCard[]
	) =>
		updateDraft(prev => ({
			...prev,
			[section]: {
				...prev[section],
				[section === 'analysis' ? 'cards' : 'items']: items
			}
		}))

	const updateIntegrationItems = (items: HomePageIntegrationItem[]) =>
		updateDraft(prev => ({
			...prev,
			integrations: { ...prev.integrations, items }
		}))

	const updateToolItems = (items: HomePageToolItem[]) =>
		updateDraft(prev => ({
			...prev,
			tools: { ...prev.tools, items }
		}))

	const updatePricingPlans = (plans: HomePagePricingPlan[]) =>
		updateDraft(prev => ({
			...prev,
			pricing: { ...prev.pricing, plans }
		}))

	const updateSitemapItems = (sitemapItems: HomePageSitemapItem[]) =>
		updateDraft(prev => ({
			...prev,
			technicalSeo: { ...prev.technicalSeo, sitemapItems }
		}))

	if (isLoading) {
		return <p className={styles.loading}>{meta.loadingText}</p>
	}

	return (
		<div className={styles.editor}>
			{isHomeArea && showFactoryResetConfirm && (
				<ConfirmDialog
					title="Скинуть до заводских настроек?"
					message="Основные блоки главной страницы будут перезаписаны текущим дефолтным контентом сайта. Footer, SEO и демо-виджеты останутся без изменений."
					confirmLabel="Скинуть"
					cancelLabel="Отмена"
					onConfirm={factoryReset}
					onCancel={() => setShowFactoryResetConfirm(false)}
				/>
			)}

			<div className={styles.saveBar}>
				<div>
					<div className={styles.titleWithHelp}>
						<p className={styles.saveTitle}>{meta.title}</p>
						<HelpTooltip
							title={meta.helpTitle}
							description={meta.helpDescription}
							risk="medium"
							riskText={meta.riskText}
						/>
					</div>
					<p className={styles.fieldHint}>{meta.hint}</p>
				</div>
				<div className={styles.saveActions}>
					{!isHomeArea && !isBodyArea && !isHeadArea && (
						<button
							type="button"
							className={styles.resetBtn}
							onClick={resetAreaToDefault}
							disabled={mutation.isPending}
						>
							Сбросить к дефолту
						</button>
					)}
					{isDirty && (
						<button
							type="button"
							className={styles.resetBtn}
							onClick={() => setDraft(persistedContent)}
						>
							Отменить изменения
						</button>
					)}
					<button
						type="button"
						className={styles.saveBtn}
						onClick={save}
						disabled={!isDirty || mutation.isPending}
					>
						{meta.saveLabel}
					</button>
				</div>
			</div>

			{isHomeArea && (
				<section className={styles.dangerZone}>
					<div>
						<SectionTitle
							danger
							title="Сброс главной"
							description="Возвращает основные блоки главной страницы к текущему заводскому конфигу из кода."
							risk="high"
							riskText="После подтверждения основные блоки главной будут перезаписаны дефолтными значениями. Вынесенные Footer, SEO и демо-виджеты не затрагиваются."
						>
							Опасная зона
						</SectionTitle>
						<p className={styles.dangerText}>
							Сбросит основные блоки главной страницы до текущего
							заводского состояния сайта.
						</p>
					</div>
					<button
						type="button"
						className={styles.factoryResetBtn}
						onClick={() => setShowFactoryResetConfirm(true)}
						disabled={mutation.isPending}
					>
						Скинуть до заводских настроек
					</button>
				</section>
			)}

			{isSeoArea && (
				<>
					<section className={styles.panel}>
						<SectionTitle
							title="SEO главной"
							description="Управляет title, description, keywords и Open Graph-текстами, которые видят поисковики, браузерные вкладки и соцсети при шаринге ссылки."
							risk="high"
							riskText="Неудачные SEO-тексты могут ухудшить сниппет в поиске и отображение ссылки. Не удаляйте ключевые смыслы про виджеты, лиды и конверсию без проверки."
						>
							SEO
						</SectionTitle>
						<div className={styles.gridTwo}>
							<TextField
								id="home-seo-title"
								label="Title"
								value={draft.seo.title}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										seo: { ...prev.seo, title: value }
									}))
								}
							/>
							<TextField
								id="home-seo-og-title"
								label="OG title"
								value={draft.seo.ogTitle}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										seo: { ...prev.seo, ogTitle: value }
									}))
								}
							/>
						</div>
						<TextAreaField
							id="home-seo-description"
							label="Description"
							value={draft.seo.description}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									seo: { ...prev.seo, description: value }
								}))
							}
						/>
						<TextAreaField
							id="home-seo-og-description"
							label="OG description"
							value={draft.seo.ogDescription}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									seo: { ...prev.seo, ogDescription: value }
								}))
							}
						/>
						<TextAreaField
							id="home-seo-keywords"
							label="Keywords"
							value={draft.seo.keywords.join('\n')}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									seo: {
										...prev.seo,
										keywords: textToFeatures(value)
									}
								}))
							}
							hint="Каждый keyword с новой строки."
						/>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<div>
								<SectionTitle
									title="Robots и sitemap"
									description="Формирует публичные файлы robots.txt и sitemap.xml из безопасных структурированных настроек."
									risk="high"
									riskText="Неверные пути могут открыть служебные страницы для индексации или убрать важные страницы из sitemap. Не добавляйте админку, кабинет, оплату и превью виджетов в sitemap."
								>
									SEO-файлы
								</SectionTitle>
								<p className={styles.fieldHint}>
									После сохранения обновятся robots.txt и sitemap.xml.
								</p>
							</div>
						</div>

						<TextField
							id="technical-seo-base-url"
							label="Базовый URL сайта"
							value={draft.technicalSeo.baseUrl}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									technicalSeo: {
										...prev.technicalSeo,
										baseUrl: value
									}
								}))
							}
							placeholder="https://winwidget.ru"
						/>

						<TextAreaField
							id="technical-seo-robots-disallow"
							label="Robots disallow"
							value={draft.technicalSeo.robotsDisallow.join('\n')}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									technicalSeo: {
										...prev.technicalSeo,
										robotsDisallow: textToFeatures(value)
									}
								}))
							}
							rows={8}
							hint="Каждый закрытый путь с новой строки."
						/>

						<div className={styles.list}>
							{draft.technicalSeo.sitemapItems.map((item, index) => (
								<div
									key={`${item.path}-${index}`}
									className={styles.itemCard}
								>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Страница sitemap {index + 1}
										</span>
										<div className={styles.itemActions}>
											<ToggleField
												label="Включить"
												checked={item.enabled}
												onChange={checked =>
													updateSitemapItems(
														updateItem(
															draft.technicalSeo.sitemapItems,
															index,
															{ enabled: checked }
														)
													)
												}
											/>
											<ListActions
												onMoveUp={() =>
													updateSitemapItems(
														moveItem(
															draft.technicalSeo.sitemapItems,
															index,
															-1
														)
													)
												}
												onMoveDown={() =>
													updateSitemapItems(
														moveItem(
															draft.technicalSeo.sitemapItems,
															index,
															1
														)
													)
												}
												onRemove={() =>
													updateSitemapItems(
														removeItem(
															draft.technicalSeo.sitemapItems,
															index
														)
													)
												}
												disableUp={index === 0}
												disableDown={
													index ===
													draft.technicalSeo.sitemapItems.length - 1
												}
											/>
										</div>
									</div>
									<div className={styles.gridThree}>
										<TextField
											id={`sitemap-path-${index}`}
											label="Путь"
											value={item.path}
											onChange={value =>
												updateSitemapItems(
													updateItem(
														draft.technicalSeo.sitemapItems,
														index,
														{ path: value }
													)
												)
											}
											placeholder="/"
										/>
										<div className={styles.field}>
											<label
												htmlFor={`sitemap-frequency-${index}`}
												className={styles.fieldLabel}
											>
												Частота
											</label>
											<select
												id={`sitemap-frequency-${index}`}
												className={styles.select}
												value={item.changeFrequency}
												onChange={event =>
													updateSitemapItems(
														updateItem(
															draft.technicalSeo.sitemapItems,
															index,
															{
																changeFrequency: event.target
																	.value as HomePageSitemapChangeFrequency
															}
														)
													)
												}
											>
												{SITEMAP_CHANGE_FREQUENCY_OPTIONS.map(option => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</div>
										<div className={styles.field}>
											<label
												htmlFor={`sitemap-priority-${index}`}
												className={styles.fieldLabel}
											>
												Priority
											</label>
											<input
												id={`sitemap-priority-${index}`}
												className={styles.input}
												type="number"
												min="0"
												max="1"
												step="0.1"
												value={item.priority}
												onChange={event =>
													updateSitemapItems(
														updateItem(
															draft.technicalSeo.sitemapItems,
															index,
															{
																priority: normalizePriorityInput(
																	event.target.value
																)
															}
														)
													)
												}
											/>
										</div>
									</div>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addBtn}
							onClick={() =>
								updateSitemapItems([
									...draft.technicalSeo.sitemapItems,
									{
										path: '/new-page',
										changeFrequency: 'weekly',
										priority: 0.5,
										enabled: true
									}
								])
							}
						>
							Добавить страницу в sitemap
						</button>
					</section>
				</>
			)}

			{isFooterArea && (
				<section className={styles.panel}>
					<SectionTitle
						title="Футер: О нас"
						description="Редактирует информационный блок в футере: заголовок, реквизиты, email и ссылки на социальные сети."
						risk="medium"
						riskText="Эти данные видны на всех страницах с футером. Перед сохранением проверьте реквизиты, email и внешние ссылки."
					>
						Футер: О нас
					</SectionTitle>
					<div className={styles.gridTwo}>
						<TextField
							id="footer-about-title"
							label="Заголовок"
							value={draft.footer.aboutTitle}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									footer: { ...prev.footer, aboutTitle: value }
								}))
							}
						/>
						<TextField
							id="footer-email"
							label="Email"
							value={draft.footer.email}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									footer: { ...prev.footer, email: value }
								}))
							}
						/>
					</div>
					<TextAreaField
						id="footer-info-lines"
						label="Информационные строки"
						value={draft.footer.infoLines.join('\n')}
						onChange={value =>
							updateDraft(prev => ({
								...prev,
								footer: {
									...prev.footer,
									infoLines: textToFeatures(value)
								}
							}))
						}
						hint="Каждая строка выводится отдельным абзацем."
					/>
					<div className={styles.gridTwo}>
						<TextField
							id="footer-vk-url"
							label="Ссылка VK"
							value={draft.footer.vkUrl}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									footer: { ...prev.footer, vkUrl: value }
								}))
							}
						/>
						<TextField
							id="footer-telegram-url"
							label="Ссылка Telegram"
							value={draft.footer.telegramUrl}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									footer: { ...prev.footer, telegramUrl: value }
								}))
							}
						/>
					</div>
					<div className={styles.gridTwo}>
						<TextField
							id="footer-vk-label"
							label="Подпись VK для доступности"
							value={draft.footer.vkAriaLabel}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									footer: { ...prev.footer, vkAriaLabel: value }
								}))
							}
						/>
						<TextField
							id="footer-telegram-label"
							label="Подпись Telegram для доступности"
							value={draft.footer.telegramAriaLabel}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									footer: {
										...prev.footer,
										telegramAriaLabel: value
									}
								}))
							}
						/>
					</div>
				</section>
			)}

			{isDemoArea && (
				<section className={styles.panel}>
					<SectionTitle
						title="Плавающие демо-виджеты"
						description="Это маленький демонстрационный виджет поверх главной: облачка, подписи и включение самого демо-блока."
						risk="medium"
						riskText="Если выключить блок или написать непонятный текст, посетитель хуже увидит живой пример продукта. Проверьте короткие фразы на мобильном экране."
					>
						Демо-виджеты
					</SectionTitle>
					<ToggleField
						label="Показывать плавающий демо-виджет"
						checked={draft.demoWidgets.enabled}
						onChange={checked =>
							updateDraft(prev => ({
								...prev,
								demoWidgets: {
									...prev.demoWidgets,
									enabled: checked
								}
							}))
						}
					/>
					<div className={styles.gridTwo}>
						{(
							[
								['wheel', 'Облако колеса'],
								['quiz', 'Облако квиза'],
								['callback', 'Облако звонка'],
								['countdown', 'Облако таймера']
							] as const
						).map(([key, label]) => (
							<TextField
								key={key}
								id={`demo-bubble-${key}`}
								label={label}
								value={draft.demoWidgets.bubbleTexts[key]}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										demoWidgets: {
											...prev.demoWidgets,
											bubbleTexts: {
												...prev.demoWidgets.bubbleTexts,
												[key]: value
											}
										}
									}))
								}
							/>
						))}
					</div>
					<div className={styles.gridThree}>
						<TextAreaField
							id="demo-label-wheel"
							label="Надпись колеса"
							value={draft.demoWidgets.labels.wheel}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									demoWidgets: {
										...prev.demoWidgets,
										labels: {
											...prev.demoWidgets.labels,
											wheel: value
										}
									}
								}))
							}
							rows={2}
						/>
						<TextAreaField
							id="demo-label-quiz"
							label="Надпись квиза"
							value={draft.demoWidgets.labels.quiz}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									demoWidgets: {
										...prev.demoWidgets,
										labels: {
											...prev.demoWidgets.labels,
											quiz: value
										}
									}
								}))
							}
							rows={2}
						/>
						<TextAreaField
							id="demo-label-countdown"
							label="Надпись таймера"
							value={draft.demoWidgets.labels.countdown}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									demoWidgets: {
										...prev.demoWidgets,
										labels: {
											...prev.demoWidgets.labels,
											countdown: value
										}
									}
								}))
							}
							rows={2}
						/>
					</div>
				</section>
			)}

			{isBodyArea && (
				<section className={styles.panel}>
					<div className={styles.panelHeader}>
						<div>
							<SectionTitle
								title="Код перед </body>"
								description="Выводит сохранённый HTML или script-блоки последним элементом внутри body."
								risk="high"
								riskText="Этот код выполняется на публичном сайте. Используйте только доверенные скрипты и проверяйте синтаксис перед сохранением."
							>
								Body
							</SectionTitle>
							<p className={styles.fieldHint}>
								Подходит для счётчиков, пикселей, виджетов чата и
								интеграционных script/noscript блоков.
							</p>
						</div>
						<ToggleField
							label="Включить вставку"
							checked={draft.body.enabled}
							onChange={checked =>
								updateDraft(prev => ({
									...prev,
									body: { ...prev.body, enabled: checked }
								}))
							}
						/>
					</div>
					<TextAreaField
						id="body-html"
						label="HTML / script перед </body>"
						value={draft.body.html}
						onChange={value =>
							updateDraft(prev => ({
								...prev,
								body: { ...prev.body, html: value }
							}))
						}
						rows={12}
						placeholder={
							'<script src="https://example.com/script.js"></script>'
						}
						hint="Код будет добавлен перед закрывающим тегом body после сохранения."
					/>
				</section>
			)}

			{isHeadArea && (
				<section className={styles.panel}>
					<div className={styles.panelHeader}>
						<div>
							<SectionTitle
								title="Код внутри <head>"
								description="Выводит сохранённый HTML или script/link/meta/style-блоки внутри head."
								risk="high"
								riskText="Этот код попадёт в head публичного сайта. Используйте только доверенные теги и проверяйте синтаксис перед сохранением."
							>
								Head
							</SectionTitle>
							<p className={styles.fieldHint}>
								Подходит для мета-тегов, пикселей, внешних script/link и
								проверочных тегов сервисов.
							</p>
						</div>
						<ToggleField
							label="Включить вставку"
							checked={draft.head.enabled}
							onChange={checked =>
								updateDraft(prev => ({
									...prev,
									head: { ...prev.head, enabled: checked }
								}))
							}
						/>
					</div>
					<TextAreaField
						id="head-html"
						label="HTML / script внутри <head>"
						value={draft.head.html}
						onChange={value =>
							updateDraft(prev => ({
								...prev,
								head: { ...prev.head, html: value }
							}))
						}
						rows={12}
						placeholder={'<meta name="example" content="value" />'}
						hint="Код будет добавлен внутри тега head после сохранения."
					/>
				</section>
			)}

			{isHomeArea && (
				<>
					<section className={styles.panel}>
						<SectionTitle
							title="Первый экран"
							description="Главный заголовок, процент, подзаголовок и CTA-кнопка в самом верху главной страницы."
							risk="high"
							riskText="Это первое, что видит посетитель. Слишком длинный текст может сломать композицию, а слабый оффер снизит конверсию."
						>
							Первый экран
						</SectionTitle>
						<div className={styles.gridTwo}>
							<TextAreaField
								id="hero-title-before"
								label="Заголовок до акцента"
								value={draft.hero.titleBeforeAccent}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										hero: {
											...prev.hero,
											titleBeforeAccent: value
										}
									}))
								}
								hint="Переносы строк сохраняются."
							/>
							<TextField
								id="hero-accent"
								label="Акцент"
								value={draft.hero.accentText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										hero: { ...prev.hero, accentText: value }
									}))
								}
							/>
						</div>
						<TextField
							id="hero-title-after"
							label="Заголовок после акцента"
							value={draft.hero.titleAfterAccent}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									hero: { ...prev.hero, titleAfterAccent: value }
								}))
							}
						/>
						<div className={styles.gridTwo}>
							<TextField
								id="hero-subtitle"
								label="Подзаголовок"
								value={draft.hero.subtitle}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										hero: { ...prev.hero, subtitle: value }
									}))
								}
							/>
							<TextField
								id="hero-primary"
								label="Текст кнопки"
								value={draft.hero.primaryButtonText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										hero: {
											...prev.hero,
											primaryButtonText: value
										}
									}))
								}
							/>
						</div>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<SectionTitle
								title="Блок с проблемой"
								description="Секция про уходящих посетителей и карточки сценариев, когда виджеты помогают удержать клиента."
								risk="medium"
								riskText="Если убрать боль клиента или сделать карточки слишком общими, блок станет менее убедительным. Количество карточек лучше держать умеренным."
							>
								Блок с проблемой
							</SectionTitle>
							<ToggleField
								label="Показывать"
								checked={draft.analysis.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										analysis: {
											...prev.analysis,
											enabled: checked
										}
									}))
								}
							/>
						</div>
						<TextField
							id="analysis-title"
							label="Заголовок"
							value={draft.analysis.title}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									analysis: { ...prev.analysis, title: value }
								}))
							}
						/>
						<TextAreaField
							id="analysis-subtitle"
							label="Подзаголовок"
							value={draft.analysis.subtitle}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									analysis: { ...prev.analysis, subtitle: value }
								}))
							}
						/>
						<div className={styles.list}>
							{draft.analysis.cards.map((card, index) => (
								<div
									key={`${card.text}-${index}`}
									className={styles.itemCard}
								>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Сценарий {index + 1}
										</span>
										<ListActions
											onMoveUp={() =>
												updateCardList(
													'analysis',
													moveItem(draft.analysis.cards, index, -1)
												)
											}
											onMoveDown={() =>
												updateCardList(
													'analysis',
													moveItem(draft.analysis.cards, index, 1)
												)
											}
											onRemove={() =>
												updateCardList(
													'analysis',
													removeItem(draft.analysis.cards, index)
												)
											}
											disableUp={index === 0}
											disableDown={
												index === draft.analysis.cards.length - 1
											}
										/>
									</div>
									<TextField
										id={`analysis-card-${index}`}
										label="Текст карточки"
										value={card.text}
										onChange={value =>
											updateCardList(
												'analysis',
												updateItem(draft.analysis.cards, index, {
													text: value
												})
											)
										}
									/>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addBtn}
							onClick={() =>
								updateCardList('analysis', [
									...draft.analysis.cards,
									{ text: 'Новая карточка' }
								])
							}
						>
							Добавить сценарий
						</button>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<SectionTitle
								title="Интеграции"
								description="Карусель готовых подключений: email, Telegram, CRM, аналитика и другие каналы передачи заявок."
								risk="medium"
								riskText="Не обещайте интеграции, которых нет в продукте. Ошибка здесь создаёт неверные ожидания у клиента."
							>
								Интеграции
							</SectionTitle>
							<ToggleField
								label="Показывать"
								checked={draft.integrations.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										integrations: {
											...prev.integrations,
											enabled: checked
										}
									}))
								}
							/>
						</div>
						<TextField
							id="integrations-title"
							label="Заголовок"
							value={draft.integrations.title}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									integrations: {
										...prev.integrations,
										title: value
									}
								}))
							}
						/>
						<div className={styles.list}>
							{draft.integrations.items.map((item, index) => (
								<div
									key={`${item.title}-${index}`}
									className={styles.itemCard}
								>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Интеграция {index + 1}
										</span>
										<ListActions
											onMoveUp={() =>
												updateIntegrationItems(
													moveItem(draft.integrations.items, index, -1)
												)
											}
											onMoveDown={() =>
												updateIntegrationItems(
													moveItem(draft.integrations.items, index, 1)
												)
											}
											onRemove={() =>
												updateIntegrationItems(
													removeItem(draft.integrations.items, index)
												)
											}
											disableUp={index === 0}
											disableDown={
												index === draft.integrations.items.length - 1
											}
										/>
									</div>
									<div className={styles.gridThree}>
										<TextField
											id={`integration-title-${index}`}
											label="Название"
											value={item.title}
											onChange={value =>
												updateIntegrationItems(
													updateItem(draft.integrations.items, index, {
														title: value
													})
												)
											}
										/>
										<TextField
											id={`integration-tag-${index}`}
											label="Тег"
											value={item.tag}
											onChange={value =>
												updateIntegrationItems(
													updateItem(draft.integrations.items, index, {
														tag: value
													})
												)
											}
										/>
										<div className={styles.field}>
											<label
												htmlFor={`integration-icon-${index}`}
												className={styles.fieldLabel}
											>
												Иконка
											</label>
											<select
												id={`integration-icon-${index}`}
												className={styles.select}
												value={item.iconKey}
												onChange={event =>
													updateIntegrationItems(
														updateItem(draft.integrations.items, index, {
															iconKey: event.target
																.value as HomePageIntegrationIconKey
														})
													)
												}
											>
												{ICON_OPTIONS.map(option => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</div>
									</div>
									<TextAreaField
										id={`integration-description-${index}`}
										label="Описание"
										value={item.description}
										onChange={value =>
											updateIntegrationItems(
												updateItem(draft.integrations.items, index, {
													description: value
												})
											)
										}
									/>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addBtn}
							onClick={() =>
								updateIntegrationItems([
									...draft.integrations.items,
									{
										title: 'Новая интеграция',
										tag: 'Интеграция',
										description: 'Описание интеграции',
										iconKey: 'webhook'
									}
								])
							}
						>
							Добавить интеграцию
						</button>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<SectionTitle
								title="Инструменты"
								description="Карточки виджетов на главной: названия, описания, превью и пометка «Скоро»."
								risk="medium"
								riskText="Для будущих виджетов оставляйте «Скоро». Если снять пометку раньше времени, пользователь может ожидать доступный инструмент."
							>
								Инструменты
							</SectionTitle>
							<ToggleField
								label="Показывать"
								checked={draft.tools.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										tools: { ...prev.tools, enabled: checked }
									}))
								}
							/>
						</div>
						<div className={styles.gridTwo}>
							<TextField
								id="tools-title"
								label="Заголовок"
								value={draft.tools.title}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										tools: { ...prev.tools, title: value }
									}))
								}
							/>
							<TextField
								id="tools-cta"
								label="Текст кнопки"
								value={draft.tools.ctaText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										tools: { ...prev.tools, ctaText: value }
									}))
								}
							/>
						</div>
						<div className={styles.list}>
							{draft.tools.items.map((item, index) => (
								<div
									key={`${item.title}-${index}`}
									className={styles.itemCard}
								>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Инструмент {index + 1}
										</span>
										<ListActions
											onMoveUp={() =>
												updateToolItems(
													moveItem(draft.tools.items, index, -1)
												)
											}
											onMoveDown={() =>
												updateToolItems(
													moveItem(draft.tools.items, index, 1)
												)
											}
											onRemove={() =>
												updateToolItems(
													removeItem(draft.tools.items, index)
												)
											}
											disableUp={index === 0}
											disableDown={index === draft.tools.items.length - 1}
										/>
									</div>
									<div className={styles.gridThree}>
										<TextField
											id={`tool-title-${index}`}
											label="Название"
											value={item.title}
											onChange={value =>
												updateToolItems(
													updateItem(draft.tools.items, index, {
														title: value
													})
												)
											}
										/>
										<div className={styles.field}>
											<label
												htmlFor={`tool-preview-${index}`}
												className={styles.fieldLabel}
											>
												Превью
											</label>
											<select
												id={`tool-preview-${index}`}
												className={styles.select}
												value={item.previewType}
												onChange={event =>
													updateToolItems(
														updateItem(draft.tools.items, index, {
															previewType: event.target
																.value as HomePageToolPreviewType
														})
													)
												}
											>
												{PREVIEW_OPTIONS.map(option => (
													<option key={option.value} value={option.value}>
														{option.label}
													</option>
												))}
											</select>
										</div>
										<ToggleField
											label="Скоро"
											checked={item.comingSoon}
											onChange={checked =>
												updateToolItems(
													updateItem(draft.tools.items, index, {
														comingSoon: checked
													})
												)
											}
										/>
									</div>
									<TextAreaField
										id={`tool-description-${index}`}
										label="Описание"
										value={item.description}
										onChange={value =>
											updateToolItems(
												updateItem(draft.tools.items, index, {
													description: value
												})
											)
										}
										hint="Переносы строк сохраняются."
									/>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addBtn}
							onClick={() =>
								updateToolItems([
									...draft.tools.items,
									{
										title: 'Новый инструмент',
										description: 'Описание инструмента',
										comingSoon: true,
										previewType: 'none'
									}
								])
							}
						>
							Добавить инструмент
						</button>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<SectionTitle
								title="Шаги установки"
								description="Короткая инструкция, которая объясняет посетителю, насколько просто подключить виджет."
								risk="low"
								riskText="Риск небольшой, но слишком длинные шаги усложнят восприятие. Лучше оставлять 3-4 коротких действия."
							>
								Шаги установки
							</SectionTitle>
							<ToggleField
								label="Показывать"
								checked={draft.steps.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										steps: { ...prev.steps, enabled: checked }
									}))
								}
							/>
						</div>
						<div className={styles.gridTwo}>
							<TextField
								id="steps-title"
								label="Заголовок"
								value={draft.steps.title}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										steps: { ...prev.steps, title: value }
									}))
								}
							/>
							<TextAreaField
								id="steps-result"
								label="Текст результата"
								value={draft.steps.resultText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										steps: { ...prev.steps, resultText: value }
									}))
								}
								rows={3}
							/>
						</div>
						<div className={styles.list}>
							{draft.steps.items.map((step, index) => (
								<div
									key={`${step.text}-${index}`}
									className={styles.itemCard}
								>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Шаг {index + 1}
										</span>
										<ListActions
											onMoveUp={() =>
												updateCardList(
													'steps',
													moveItem(draft.steps.items, index, -1)
												)
											}
											onMoveDown={() =>
												updateCardList(
													'steps',
													moveItem(draft.steps.items, index, 1)
												)
											}
											onRemove={() =>
												updateCardList(
													'steps',
													removeItem(draft.steps.items, index)
												)
											}
											disableUp={index === 0}
											disableDown={index === draft.steps.items.length - 1}
										/>
									</div>
									<TextField
										id={`step-text-${index}`}
										label="Текст"
										value={step.text}
										onChange={value =>
											updateCardList(
												'steps',
												updateItem(draft.steps.items, index, {
													text: value
												})
											)
										}
									/>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addBtn}
							onClick={() =>
								updateCardList('steps', [
									...draft.steps.items,
									{ text: 'Новый шаг' }
								])
							}
						>
							Добавить шаг
						</button>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<div>
								<SectionTitle
									title="Тарифы на лендинге"
									description="Маркетинговый блок тарифов на главной: названия, выгоды, подписи и кнопки. Реальные цены берутся из раздела Тарифы."
									risk="high"
									riskText="Изменения в этом блоке не меняют сумму оплаты. Реальные цены редактируются только в разделе Тарифы."
								>
									Тарифы на главной
								</SectionTitle>
								<p className={styles.fieldHint}>
									Цены на главной и странице оплаты подтягиваются из
									раздела Тарифы, чтобы не было рассинхрона.
								</p>
							</div>
							<ToggleField
								label="Показывать"
								checked={draft.pricing.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										pricing: { ...prev.pricing, enabled: checked }
									}))
								}
							/>
						</div>
						<div className={styles.gridThree}>
							<TextField
								id="pricing-title"
								label="Заголовок"
								value={draft.pricing.title}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										pricing: { ...prev.pricing, title: value }
									}))
								}
							/>
							<TextField
								id="pricing-button"
								label="Текст кнопок"
								value={draft.pricing.buttonText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										pricing: { ...prev.pricing, buttonText: value }
									}))
								}
							/>
							<TextField
								id="pricing-discount"
								label="Скидка"
								value={draft.pricing.discountText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										pricing: { ...prev.pricing, discountText: value }
									}))
								}
							/>
						</div>
						<div className={styles.gridTwo}>
							<TextField
								id="pricing-monthly"
								label="Переключатель помесячно"
								value={draft.pricing.monthlyToggleText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										pricing: {
											...prev.pricing,
											monthlyToggleText: value
										}
									}))
								}
							/>
							<TextField
								id="pricing-yearly"
								label="Переключатель за год"
								value={draft.pricing.yearlyToggleText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										pricing: {
											...prev.pricing,
											yearlyToggleText: value
										}
									}))
								}
							/>
						</div>
						<div className={styles.list}>
							{draft.pricing.plans.map((plan, index) => (
								<div key={plan.key} className={styles.itemCard}>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Тариф {plan.key}
										</span>
										<div className={styles.itemActions}>
											<ToggleField
												label="Звезда"
												checked={plan.star}
												onChange={checked =>
													updatePricingPlans(
														updateItem(draft.pricing.plans, index, {
															star: checked
														})
													)
												}
											/>
											<ToggleField
												label="Популярный"
												checked={plan.popular}
												onChange={checked =>
													updatePricingPlans(
														updateItem(draft.pricing.plans, index, {
															popular: checked
														})
													)
												}
											/>
										</div>
									</div>
									<div className={styles.gridThree}>
										<TextField
											id={`plan-title-${index}`}
											label="Название"
											value={plan.title}
											onChange={value =>
												updatePricingPlans(
													updateItem(draft.pricing.plans, index, {
														title: value
													})
												)
											}
										/>
										<TextField
											id={`plan-subtitle-${index}`}
											label="Подзаголовок"
											value={plan.subtitle}
											onChange={value =>
												updatePricingPlans(
													updateItem(draft.pricing.plans, index, {
														subtitle: value
													})
												)
											}
										/>
										<TextField
											id={`plan-badge-${index}`}
											label="Бейдж"
											value={plan.badge}
											onChange={value =>
												updatePricingPlans(
													updateItem(draft.pricing.plans, index, {
														badge: value
													})
												)
											}
										/>
									</div>
									<TextAreaField
										id={`plan-features-${index}`}
										label="Возможности"
										value={featuresToText(plan.features)}
										onChange={value =>
											updatePricingPlans(
												updateItem(draft.pricing.plans, index, {
													features: textToFeatures(value)
												})
											)
										}
										hint="Каждый пункт с новой строки."
										rows={5}
									/>
									<p className={styles.fieldHint}>
										Цены этой карточки редактируются в разделе Тарифы.
									</p>
								</div>
							))}
						</div>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<SectionTitle
								title="Вопросы и ответы"
								description="FAQ внизу главной: ответы про продукт, установку, оплату, уведомления и интеграции."
								risk="medium"
								riskText="Ответы могут содержать ссылки и HTML. Неверная ссылка или обещание несуществующей функции быстро приведёт к вопросам от клиентов."
							>
								FAQ
							</SectionTitle>
							<ToggleField
								label="Показывать"
								checked={draft.faq.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										faq: { ...prev.faq, enabled: checked }
									}))
								}
							/>
						</div>
						<TextField
							id="faq-title"
							label="Заголовок"
							value={draft.faq.title}
							onChange={value =>
								updateDraft(prev => ({
									...prev,
									faq: { ...prev.faq, title: value }
								}))
							}
						/>
						<div className={styles.list}>
							{draft.faq.items.map((item, index) => (
								<div
									key={`${item.question}-${index}`}
									className={styles.itemCard}
								>
									<div className={styles.itemHeader}>
										<span className={styles.itemTitle}>
											Вопрос {index + 1}
										</span>
										<ListActions
											onMoveUp={() =>
												updateDraft(prev => ({
													...prev,
													faq: {
														...prev.faq,
														items: moveItem(prev.faq.items, index, -1)
													}
												}))
											}
											onMoveDown={() =>
												updateDraft(prev => ({
													...prev,
													faq: {
														...prev.faq,
														items: moveItem(prev.faq.items, index, 1)
													}
												}))
											}
											onRemove={() =>
												updateDraft(prev => ({
													...prev,
													faq: {
														...prev.faq,
														items: removeItem(prev.faq.items, index)
													}
												}))
											}
											disableUp={index === 0}
											disableDown={index === draft.faq.items.length - 1}
										/>
									</div>
									<TextField
										id={`faq-question-${index}`}
										label="Вопрос"
										value={item.question}
										onChange={value =>
											updateDraft(prev => ({
												...prev,
												faq: {
													...prev.faq,
													items: prev.faq.items.map(innerItem =>
														innerItem === item
															? {
																	...innerItem,
																	question: value
																}
															: innerItem
													)
												}
											}))
										}
									/>
									<TextAreaField
										id={`faq-answer-${index}`}
										label="Ответ"
										value={item.answerHtml}
										onChange={value =>
											updateDraft(prev => ({
												...prev,
												faq: {
													...prev.faq,
													items: prev.faq.items.map(innerItem =>
														innerItem === item
															? {
																	...innerItem,
																	answerHtml: value
																}
															: innerItem
													)
												}
											}))
										}
										hint="Можно использовать HTML: ссылки, br, b, code."
										rows={5}
									/>
								</div>
							))}
						</div>
						<button
							type="button"
							className={styles.addBtn}
							onClick={() =>
								updateDraft(prev => ({
									...prev,
									faq: {
										...prev.faq,
										items: [
											...prev.faq.items,
											{
												question: 'Новый вопрос',
												answerHtml: 'Новый ответ'
											}
										]
									}
								}))
							}
						>
							Добавить вопрос
						</button>
					</section>

					<section className={styles.panel}>
						<div className={styles.panelHeader}>
							<SectionTitle
								title="Финальный призыв к действию"
								description="Последний баннер на главной перед завершением страницы: основной призыв и текст кнопки."
								risk="medium"
								riskText="Если выключить или ослабить этот блок, часть посетителей не увидит повторный призыв начать бесплатный период."
							>
								Финальный CTA
							</SectionTitle>
							<ToggleField
								label="Показывать"
								checked={draft.cta.enabled}
								onChange={checked =>
									updateDraft(prev => ({
										...prev,
										cta: { ...prev.cta, enabled: checked }
									}))
								}
							/>
						</div>
						<div className={styles.gridTwo}>
							<TextAreaField
								id="cta-text"
								label="Текст"
								value={draft.cta.text}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										cta: { ...prev.cta, text: value }
									}))
								}
								hint="Переносы строк сохраняются."
							/>
							<TextField
								id="cta-button"
								label="Текст кнопки"
								value={draft.cta.buttonText}
								onChange={value =>
									updateDraft(prev => ({
										...prev,
										cta: { ...prev.cta, buttonText: value }
									}))
								}
							/>
						</div>
					</section>
				</>
			)}
		</div>
	)
}

export default HomeContentEditor
