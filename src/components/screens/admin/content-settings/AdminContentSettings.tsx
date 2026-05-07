'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import legalPagesService from '@/services/legal-pages/legal-pages.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NextPage } from 'next'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import toast from 'react-hot-toast'
import HomeContentEditor, {
	type HomeContentEditorArea
} from './home-content-editor/HomeContentEditor'
import styles from './AdminContentSettings.module.scss'

const Editor = dynamic(
	() => import('@/components/ui/tiptap-editor/TiptapEditor'),
	{ ssr: false }
)

const PAGES = [
	{
		slug: 'personal-policy',
		label: 'Политика обработки персональных данных'
	},
	{
		slug: 'consent-processing',
		label: 'Согласие на обработку персональных данных'
	},
	{ slug: 'cookie-notice', label: 'Политика обработки Cookie' },
	{ slug: 'oferta', label: 'Договор-оферта' }
] as const

type Slug = (typeof PAGES)[number]['slug']
type ContentArea = HomeContentEditorArea

const AREAS: Array<{ key: ContentArea; label: string }> = [
	{ key: 'home', label: 'Главная страница' },
	{ key: 'payment', label: 'Платежи' },
	{ key: 'demo', label: 'Демо-виджеты' },
	{ key: 'footer', label: 'Footer' },
	{ key: 'head', label: 'Head' },
	{ key: 'body', label: 'Body' },
	{ key: 'seo', label: 'SEO' }
]

const AdminContentSettings: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const [activeArea, setActiveArea] = useState<ContentArea>('home')
	const [activeSlug, setActiveSlug] = useState<Slug>('personal-policy')
	const [drafts, setDrafts] = useState<Record<string, string>>({})
	const queryClient = useQueryClient()

	const { data: pages, isLoading } = useQuery({
		queryKey: ['legal-pages'],
		queryFn: legalPagesService.getAll,
		enabled: auth
	})

	const [isSaving, setIsSaving] = useState(false)

	const save = (slug: Slug) => {
		setIsSaving(true)
		const promise = legalPagesService
			.update(slug, drafts[slug] ?? '')
			.then(() => {
				queryClient.invalidateQueries({ queryKey: ['legal-pages'] })
				setDrafts(prev => {
					const next = { ...prev }
					delete next[slug]
					return next
				})
			})
			.finally(() => setIsSaving(false))
		toast.promise(promise, {
			loading: 'Сохранение...',
			success: 'Сохранено',
			error: 'Ошибка сохранения'
		})
	}

	const activePage = pages?.find(p => p.slug === activeSlug)
	const activeContent =
		activeSlug in drafts ? drafts[activeSlug] : (activePage?.content ?? '')
	const isDirty = activeSlug in drafts
	const renderLegalEditor = () => (
		<>
			<AdminSectionHeading
				text="Юридическая информация"
				title="Юридические страницы"
				description="Редактирует публичные документы: политику, согласия, cookie notice и оферту."
				risk="high"
				riskText="Некорректный текст может создать юридические риски. Перед сохранением проверь документ и согласуй формулировки."
			/>

			<div className={styles.pageTabs}>
				{PAGES.map(page => (
					<button
						key={page.slug}
						className={`${styles.pageTab} ${activeSlug === page.slug ? styles.pageTabActive : ''}`}
						onClick={() => setActiveSlug(page.slug)}
					>
						{page.label}
					</button>
				))}
			</div>

			<div className={styles.section}>
				<div className={styles.sectionHeader}>
					<p className={styles.fieldLabel}>
						{PAGES.find(p => p.slug === activeSlug)?.label}
					</p>
					{isDirty && (
						<span className={styles.dirtyBadge}>
							Несохранённые изменения
						</span>
					)}
				</div>

				{isLoading ? (
					<p className={styles.loading}>Загрузка...</p>
				) : (
					<Editor
						value={activeContent}
						onChange={html =>
							setDrafts(prev => ({
								...prev,
								[activeSlug]: html
							}))
						}
					/>
				)}

				<div className={styles.btnRow}>
					<button
						className={styles.saveBtn}
						disabled={!isDirty || isSaving}
						onClick={() => save(activeSlug)}
					>
						Сохранить
					</button>
					{isDirty && (
						<button
							className={styles.resetBtn}
							onClick={() =>
								setDrafts(prev => {
									const next = { ...prev }
									delete next[activeSlug]
									return next
								})
							}
						>
							Сбросить
						</button>
					)}
				</div>
			</div>
		</>
	)

	const renderAreaContent = () => {
		switch (activeArea) {
			case 'footer':
				return (
					<>
						<AdminSectionHeading
							text="Редактирование footer"
							title="Footer"
							description="Объединяет блок «О нас», контакты футера и юридические документы."
							risk="high"
							riskText="Эта информация видна на публичных страницах. Проверьте реквизиты, контакты, ссылки и юридические формулировки перед сохранением."
						/>
						<HomeContentEditor area="footer" />
						{renderLegalEditor()}
					</>
				)
			case 'seo':
				return (
					<>
						<AdminSectionHeading
							text="Редактирование SEO"
							title="SEO-настройки"
							description="Управляет SEO главной страницы, robots.txt и sitemap.xml."
							risk="high"
							riskText="Ошибки в robots или sitemap могут повлиять на индексацию сайта. Не добавляйте служебные страницы в sitemap."
						/>
						<HomeContentEditor area="seo" />
					</>
				)
			case 'demo':
				return (
					<>
						<AdminSectionHeading
							text="Редактирование демо-виджетов"
							title="Демо-виджеты"
							description="Управляет контентом плавающих демо-виджетов на главной странице."
							risk="medium"
							riskText="Короткие тексты демо-блока видны посетителю сразу. Проверьте их на понятность и длину."
						/>
						<HomeContentEditor area="demo" />
					</>
				)
			case 'payment':
				return (
					<>
						<AdminSectionHeading
							text="Редактирование платежей"
							title="Платежи"
							description="Управляет контентом страницы оплаты: заголовками, пояснениями, кнопками и списком возможностей тарифов."
							risk="high"
							riskText="Реальные суммы платежей редактируются только в разделе Тарифы. Здесь меняйте только тексты и карточки, чтобы не было рассинхрона."
						/>
						<HomeContentEditor area="payment" />
					</>
				)
			case 'body':
				return (
					<>
						<AdminSectionHeading
							text="Вставка перед закрывающим body"
							title="Body"
							description="Позволяет добавить HTML или скрипты, которые будут выведены перед закрывающим тегом body."
							risk="high"
							riskText="Любой код здесь выполняется на сайте. Ошибка может сломать страницы или создать XSS-риск, поэтому вставляйте только доверенный код."
						/>
						<HomeContentEditor area="body" />
					</>
				)
			case 'head':
				return (
					<>
						<AdminSectionHeading
							text="Вставка в head"
							title="Head"
							description="Позволяет добавить HTML или скрипты, которые будут выведены внутри тега head."
							risk="high"
							riskText="Любой код здесь попадает в head сайта. Ошибка может сломать SEO, загрузку страниц или создать XSS-риск, поэтому вставляйте только доверенный код."
						/>
						<HomeContentEditor area="head" />
					</>
				)
			default:
				return (
					<>
						<AdminSectionHeading
							text="Редактирование главной страницы"
							title="Контент главной страницы"
							description="Редактирует публичные тексты, карточки, тарифы, интеграции и блоки главной страницы."
							risk="high"
							riskText="Изменения увидят посетители сайта. Ошибка в тексте, тарифе или порядке блоков может повлиять на продажи и доверие."
						/>
						<HomeContentEditor area="home" />
					</>
				)
		}
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<div className={styles.pageTabs}>
				{AREAS.map(area => (
					<button
						key={area.key}
						className={`${styles.pageTab} ${activeArea === area.key ? styles.pageTabActive : ''}`}
						onClick={() => setActiveArea(area.key)}
					>
						{area.label}
					</button>
				))}
			</div>

			{renderAreaContent()}
		</section>
	)
}

export default AdminContentSettings
