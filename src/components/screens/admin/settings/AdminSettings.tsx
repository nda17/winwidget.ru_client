'use client'

import adminTasksService, {
	type ManualAdminTaskId,
	type ManualAdminTaskRunResult
} from '@/services/admin-tasks/admin-tasks.service'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { revalidateSiteSettings } from '@/services/site-settings/site-settings.actions'
import siteSettingsService from '@/services/site-settings/site-settings.service'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminSettings.module.scss'

const MANUAL_TASKS: Array<{
	id: ManualAdminTaskId
	title: string
	description: string
	buttonLabel: string
	loadingLabel: string
}> = [
	{
		id: 'paymentCleanup',
		title: 'Очистка зависших платежей',
		description:
			'Запускает внеплановую очистку старых платежей со статусом ожидания.',
		buttonLabel: 'Запустить',
		loadingLabel: 'Запускаем очистку платежей...'
	},
	{
		id: 'subscriptionExpiryCheck',
		title: 'Проверка истёкших подписок',
		description:
			'Внепланово деактивирует подписки, срок действия которых уже истёк.',
		buttonLabel: 'Запустить',
		loadingLabel: 'Проверяем подписки...'
	},
	{
		id: 'verificationChallengeCleanup',
		title: 'Очистка verification challenges',
		description:
			'Удаляет просроченные challenge-записи для подтверждения email и телефона.',
		buttonLabel: 'Запустить',
		loadingLabel: 'Очищаем verification challenges...'
	}
]

const formatExecutedAt = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'medium'
	}).format(new Date(value))

const AdminSettings: NextPage = () => {
	const queryClient = useQueryClient()
	const router = useRouter()
	const [manualTaskResults, setManualTaskResults] = useState<
		Partial<Record<ManualAdminTaskId, ManualAdminTaskRunResult>>
	>({})

	const { data: settings, isLoading } = useQuery({
		queryKey: ['site-settings'],
		queryFn: siteSettingsService.get
	})

	const [bannerText, setBannerText] = useState('')

	useEffect(() => {
		if (settings) setBannerText(settings.bannerText)
	}, [settings])

	const mutation = useMutation({
		mutationFn: siteSettingsService.update,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['site-settings'] })
			await revalidateSiteSettings()
			router.refresh()
		}
	})

	const saveWithToast = (
		patch: Parameters<typeof siteSettingsService.update>[0],
		label?: string
	) => {
		const promise = mutation.mutateAsync(patch)
		toast.promise(promise, {
			loading: label ?? 'Сохранение...',
			success: 'Сохранено',
			error: 'Ошибка сохранения'
		})
	}

	const manualTaskMutation = useMutation({
		mutationFn: adminTasksService.runTask,
		onSuccess: result => {
			setManualTaskResults(prev => ({
				...prev,
				[result.taskId]: result
			}))
		}
	})

	const activeManualTaskId = manualTaskMutation.isPending
		? manualTaskMutation.variables
		: null

	const runManualTaskWithToast = (taskId: ManualAdminTaskId) => {
		const task = MANUAL_TASKS.find(item => item.id === taskId)
		if (!task) return

		const promise = manualTaskMutation.mutateAsync(taskId)

		toast.promise(promise, {
			loading: task.loadingLabel,
			success: result => result.message,
			error: 'Ошибка запуска задачи'
		})
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<SubHeading text="Новогодний режим" />

			<div className={styles.section}>
				{isLoading ? (
					<div className={styles.toggleRow}>
						<div style={{ flex: 1 }}>
							<SkeletonLoader count={1} className="h-[18px] w-48 mb-2" />
							<SkeletonLoader count={1} className="h-[14px] w-72" />
						</div>
						<SkeletonLoader count={1} className="h-[28px] w-[52px]" />
					</div>
				) : (
					<div className={styles.toggleRow}>
						<div>
							<p className={styles.fieldLabel}>Снежинки на сайте</p>
							<p className={styles.fieldHint}>
								Летящие снежинки отображаются на всех страницах сайта
							</p>
						</div>
						<button
							className={`${styles.toggle} ${settings?.snowflakeEnabled ? styles.toggleOn : ''}`}
							onClick={() =>
								saveWithToast(
									{ snowflakeEnabled: !settings?.snowflakeEnabled },
									'Применяем настройку...'
								)
							}
							disabled={mutation.isPending}
						>
							<span className={styles.toggleThumb} />
						</button>
					</div>
				)}
			</div>

			<SubHeading text="Баннер на сайте" />

			<div className={styles.section}>
				{isLoading ? (
					<>
						<div className={styles.toggleRow}>
							<div style={{ flex: 1 }}>
								<SkeletonLoader count={1} className="h-[18px] w-48 mb-2" />
								<SkeletonLoader count={1} className="h-[14px] w-72" />
							</div>
							<SkeletonLoader count={1} className="h-[28px] w-[52px]" />
						</div>
						<SkeletonLoader count={1} className="h-[80px]" />
						<SkeletonLoader count={1} className="h-[38px] w-36" />
					</>
				) : (
					<>
						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Показывать баннер</p>
								<p className={styles.fieldHint}>
									Баннер отображается на всех страницах сайта
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.bannerEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{ bannerEnabled: !settings?.bannerEnabled },
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.field}>
							<label htmlFor="banner-text" className={styles.fieldLabel}>
								Текст баннера
							</label>
							<textarea
								id="banner-text"
								className={styles.textarea}
								placeholder="Например: Технические работы с 22:00 до 00:00. Сервис может быть недоступен."
								value={bannerText}
								onChange={e => setBannerText(e.target.value)}
								rows={3}
								maxLength={300}
								aria-describedby="banner-text-count"
							/>
							<span id="banner-text-count" className={styles.charCount}>
								{bannerText.length} / 300
							</span>
						</div>

						<button
							className={styles.saveBtn}
							onClick={() => saveWithToast({ bannerText })}
							disabled={
								mutation.isPending || bannerText === settings?.bannerText
							}
						>
							Сохранить текст
						</button>
					</>
				)}
			</div>

			<SubHeading text="Ручной запуск задач" />

			<div className={styles.section}>
				<div className={styles.taskList}>
					{MANUAL_TASKS.map(task => {
						const result = manualTaskResults[task.id]
						const isRunning =
							manualTaskMutation.isPending &&
							activeManualTaskId === task.id

						return (
							<div key={task.id} className={styles.taskRow}>
								<div className={styles.taskMeta}>
									<p className={styles.fieldLabel}>{task.title}</p>
									<p className={styles.fieldHint}>{task.description}</p>
									{result && (
										<p className={styles.taskResult}>
											{result.message}
											<span className={styles.taskTimestamp}>
												Последний запуск:{' '}
												{formatExecutedAt(result.executedAt)}
											</span>
										</p>
									)}
								</div>

								<button
									type="button"
									className={styles.taskBtn}
									onClick={() => runManualTaskWithToast(task.id)}
									disabled={manualTaskMutation.isPending}
								>
									{isRunning ? 'Запуск...' : task.buttonLabel}
								</button>
							</div>
						)
					})}
				</div>
			</div>
		</section>
	)
}

export default AdminSettings
