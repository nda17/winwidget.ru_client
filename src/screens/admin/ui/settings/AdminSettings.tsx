'use client'

import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import AdminTooltip from '@/screens/admin/ui/common/admin-tooltip/AdminTooltip'
import Heading from '@/shared/ui/heading/Heading'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	adminTasksService,
	type ManualAdminTaskId,
	type ManualAdminTaskRunResult
} from '@/features/run-admin-task'
import { revalidateSiteSettings } from '@/entities/site-settings/actions'
import { siteSettingsService } from '@/entities/site-settings'
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

	const {
		data: settings,
		isLoading,
		isError,
		refetch: refetchSettings
	} = useQuery({
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

	const retrySettingsWithToast = () => {
		const promise = refetchSettings().then(result => {
			if (result.isError || !result.data) {
				throw result.error ?? new Error('Настройки не получены')
			}
			return result.data
		})

		toast.promise(promise, {
			loading: 'Повторно загружаем настройки...',
			success: 'Настройки загружены',
			error: 'Не удалось загрузить настройки'
		})
	}

	if (isLoading) {
		return (
			<section className={styles.wrapper}>
				<Heading text="Панель администратора" />
				<AdminNavigation />
				<AdminSectionHeading
					title="Настройки сайта"
					description="Загружаем актуальные значения настроек."
					text="Настройки"
				/>
				<div className={styles.section}>
					{Array.from({ length: 3 }).map((_, index) => (
						<div key={index} className={styles.toggleRow}>
							<div style={{ flex: 1 }}>
								<SkeletonLoader count={1} className="h-[18px] w-48 mb-2" />
								<SkeletonLoader count={1} className="h-[14px] w-72" />
							</div>
							<SkeletonLoader count={1} className="h-[28px] w-[52px]" />
						</div>
					))}
				</div>
			</section>
		)
	}

	if (isError || !settings) {
		return (
			<section className={styles.wrapper}>
				<Heading text="Панель администратора" />
				<AdminNavigation />
				<AdminSectionHeading
					title="Настройки недоступны"
					description="Тумблеры заблокированы, потому что актуальные значения не удалось получить с сервера."
					risk="high"
					riskText="Не меняйте критические настройки вслепую. Сначала восстановите загрузку текущего состояния."
					text="Ошибка загрузки"
				/>
				<div className={styles.section}>
					<p className={styles.fieldHint}>
						Повторите загрузку. До успешного ответа сервера никакие
						настройки не будут изменены.
					</p>
					<button
						type="button"
						className={styles.taskBtn}
						onClick={retrySettingsWithToast}
					>
						Загрузить ещё раз
					</button>
				</div>
			</section>
		)
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				title="Приём платежей"
				description="Управляет доступностью оплаты тарифов через ЮKassa для пользователей сайта."
				risk="high"
				riskText="Если выключить по ошибке, пользователи не смогут оплатить или продлить тариф, пока настройку не включат обратно."
				text="Оплата"
			/>

			<div className={styles.section}>
				{isLoading ? (
					<>
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index} className={styles.toggleRow}>
								<div style={{ flex: 1 }}>
									<SkeletonLoader
										count={1}
										className="h-[18px] w-48 mb-2"
									/>
									<SkeletonLoader count={1} className="h-[14px] w-72" />
								</div>
								<SkeletonLoader count={1} className="h-[28px] w-[52px]" />
							</div>
						))}
					</>
				) : (
					<>
						<div className={styles.toggleRow}>
							<div>
								<div className={styles.fieldLabelRow}>
									<p className={styles.fieldLabel}>
										Приём платежей через ЮKassa
									</p>
									<AdminTooltip
										title="Общий стоп платежей"
										description="Останавливает новые разовые оплаты, новые подключения автопродления и выполнение уже запланированных автоматических списаний."
										risk="high"
										riskText="После обратного включения списания, расчётная дата которых пришлась на остановку, не догоняются: автопродление переводится на безопасную паузу."
									/>
								</div>
								<p className={styles.fieldHint}>
									Главный выключатель новых и автоматических платежей
								</p>
							</div>
							<button
								type="button"
								aria-label="Приём платежей через ЮKassa"
								aria-pressed={settings.paymentEnabled}
								className={`${styles.toggle} ${settings.paymentEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{ paymentEnabled: !settings.paymentEnabled },
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>
						<div className={styles.toggleRow}>
							<div>
								<div className={styles.fieldLabelRow}>
									<p className={styles.fieldLabel}>
										Разрешать подключение автопродления
									</p>
									<AdminTooltip
										title="Новые подключения"
										description="Влияет только на новые оплаты: при выключении пользователь не сможет выбрать автопродление, но разовая оплата и уже действующие согласия продолжат работать."
										risk="medium"
										riskText="Настройка не останавливает уже запланированные списания."
									/>
								</div>
								<p className={styles.fieldHint}>
									Управляет галочкой автопродления на странице оплаты
								</p>
							</div>
							<button
								type="button"
								aria-label="Разрешать подключение автопродления"
								aria-pressed={settings.autoRenewalSignupEnabled}
								className={`${styles.toggle} ${
									settings.autoRenewalSignupEnabled ? styles.toggleOn : ''
								}`}
								onClick={() =>
									saveWithToast(
										{
											autoRenewalSignupEnabled:
												!settings.autoRenewalSignupEnabled
										},
										'Обновляем доступность автопродления...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>
						<div className={styles.toggleRow}>
							<div>
								<div className={styles.fieldLabelRow}>
									<p className={styles.fieldLabel}>
										Выполнять автоматические списания
									</p>
									<AdminTooltip
										title="Аварийная остановка"
										description="Останавливает scheduler и повторные попытки для всех пользователей, не удаляя их согласия и сохранённые настройки."
										risk="high"
										riskText="Если расчётная дата наступила во время остановки, после включения такое списание не догоняется задним числом: цикл переводится на безопасную паузу."
									/>
								</div>
								<p className={styles.fieldHint}>
									Глобальный стоп плановых списаний и retry 24/72
								</p>
							</div>
							<button
								type="button"
								aria-label="Выполнять автоматические списания"
								aria-pressed={settings.autoRenewalChargesEnabled}
								className={`${styles.toggle} ${
									settings.autoRenewalChargesEnabled ? styles.toggleOn : ''
								}`}
								onClick={() =>
									saveWithToast(
										{
											autoRenewalChargesEnabled:
												!settings.autoRenewalChargesEnabled
										},
										'Обновляем выполнение автосписаний...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>
					</>
				)}
			</div>

			<AdminSectionHeading
				title="Авторизация и защита"
				description="Здесь включаются и выключаются reCAPTCHA и социальный вход через Google, Яндекс, GitHub или Telegram."
				risk="high"
				riskText="Отключение reCAPTCHA снижает защиту форм от спама. Отключение соцвхода может закрыть пользователям привычный способ входа."
				text="Авторизация и защита"
			/>

			<div className={styles.section}>
				{isLoading ? (
					<>
						{Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className={styles.toggleRow}>
								<div style={{ flex: 1 }}>
									<SkeletonLoader
										count={1}
										className="h-[18px] w-48 mb-2"
									/>
									<SkeletonLoader count={1} className="h-[14px] w-72" />
								</div>
								<SkeletonLoader count={1} className="h-[28px] w-[52px]" />
							</div>
						))}
					</>
				) : (
					<>
						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Проверка reCAPTCHA</p>
								<p className={styles.fieldHint}>
									Если выключено, формы входа, регистрации и восстановления
									пароля не требуют проверку reCAPTCHA
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.recaptchaEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{
											recaptchaEnabled: !settings?.recaptchaEnabled
										},
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Вход через Google</p>
								<p className={styles.fieldHint}>
									Если выключено, кнопка Google скрывается, а прямой
									переход на Google-авторизацию блокируется
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.googleAuthEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{
											googleAuthEnabled: !settings?.googleAuthEnabled
										},
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Вход через Яндекс</p>
								<p className={styles.fieldHint}>
									Если выключено, кнопка Яндекс скрывается, а прямой
									переход на Яндекс-авторизацию блокируется
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.yandexAuthEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{
											yandexAuthEnabled: !settings?.yandexAuthEnabled
										},
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Вход через GitHub</p>
								<p className={styles.fieldHint}>
									Если выключено, кнопка GitHub скрывается, а прямой
									переход на GitHub-авторизацию блокируется
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.githubAuthEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{
											githubAuthEnabled: !settings?.githubAuthEnabled
										},
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Вход через VK</p>
								<p className={styles.fieldHint}>
									Если выключено, кнопка VK скрывается, а прямой переход на
									VK-авторизацию блокируется
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.vkAuthEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{
											vkAuthEnabled: !settings?.vkAuthEnabled
										},
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.fieldLabel}>Вход через Telegram</p>
								<p className={styles.fieldHint}>
									Если выключено, кнопка Telegram скрывается, а запрос к
									Auth_bot блокируется
								</p>
							</div>
							<button
								className={`${styles.toggle} ${settings?.telegramAuthEnabled ? styles.toggleOn : ''}`}
								onClick={() =>
									saveWithToast(
										{
											telegramAuthEnabled: !settings?.telegramAuthEnabled
										},
										'Применяем настройку...'
									)
								}
								disabled={mutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>
					</>
				)}
			</div>

			<AdminSectionHeading
				title="Баннер на сайте"
				description="Показывает общее сообщение на страницах сайта: например, предупреждение о работах или важное объявление."
				risk="medium"
				riskText="Неверный текст увидят все пользователи. Перед сохранением проверь смысл, даты и контакты."
				text="Баннер на сайте"
			/>

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

			<AdminSectionHeading
				title="Ручной запуск задач"
				description="Позволяет вне расписания запустить системные задачи обслуживания: очистку платежей, проверку подписок и удаление устаревших challenge-записей."
				risk="high"
				riskText="Запускай только когда понимаешь цель задачи: действие влияет на реальные платежи, подписки или записи подтверждения."
				text="Ручной запуск задач"
			/>

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

			<AdminSectionHeading
				title="Новогодний режим"
				description="Включает декоративные снежинки на страницах сайта для сезонного оформления."
				risk="low"
				riskText="На данные и оплату не влияет. Возможный риск только визуальный: эффект может быть неуместен вне сезона."
				text="Новогодний режим"
			/>

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
		</section>
	)
}

export default AdminSettings
