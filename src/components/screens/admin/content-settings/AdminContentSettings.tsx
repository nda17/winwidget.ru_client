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
import HomeContentEditor from './home-content-editor/HomeContentEditor'
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
type ContentArea = 'home' | 'legal'

const AREAS: Array<{ key: ContentArea; label: string }> = [
	{ key: 'home', label: 'Главная страница' },
	{ key: 'legal', label: 'Юридические страницы' }
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

			{activeArea === 'home' ? (
				<>
					<AdminSectionHeading
						text="Редактирование главной страницы"
						title="Контент главной страницы"
						description="Редактирует публичные тексты, карточки, тарифы, интеграции и блоки главной страницы."
						risk="high"
						riskText="Изменения увидят посетители сайта. Ошибка в тексте, тарифе или порядке блоков может повлиять на продажи и доверие."
					/>
					<HomeContentEditor />
				</>
			) : (
				<>
					<AdminSectionHeading
						text="Редактирование юридических страниц"
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
			)}
		</section>
	)
}

export default AdminContentSettings
