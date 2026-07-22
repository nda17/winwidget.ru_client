'use client'

import styles from '@/screens/cabinet/ui/Cabinet.module.scss'
import authService, {
	type IUserSession
} from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/entities/user'
import { removeFromStorage } from '@/shared/api'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { FC, useState } from 'react'
import toast from 'react-hot-toast'

type Confirmation =
	| { type: 'session'; session: IUserSession }
	| { type: 'all' }
	| null

const formatDate = (value: string) =>
	`${new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Moscow'
	}).format(new Date(value))} МСК`

const getDeviceName = (userAgent: string | null) => {
	if (!userAgent) return 'Неизвестное устройство'

	const browser = userAgent.includes('Edg/')
		? 'Microsoft Edge'
		: userAgent.includes('Firefox/')
			? 'Firefox'
			: userAgent.includes('Chrome/')
				? 'Chrome'
				: userAgent.includes('Safari/')
					? 'Safari'
					: 'Браузер'
	const os = /iPhone|iPad/.test(userAgent)
		? 'iOS'
		: userAgent.includes('Android')
			? 'Android'
			: userAgent.includes('Windows')
				? 'Windows'
				: userAgent.includes('Mac OS')
					? 'macOS'
					: userAgent.includes('Linux')
						? 'Linux'
						: 'неизвестная ОС'

	return `${browser} · ${os}`
}

const CabinetSessions: FC = () => {
	const [confirmation, setConfirmation] = useState<Confirmation>(null)
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)
	const queryClient = useQueryClient()
	const router = useRouter()

	const {
		data: sessions = [],
		isLoading,
		isError
	} = useQuery({
		queryKey: ['auth-sessions'],
		queryFn: () => authService.getSessions()
	})

	const finishCurrentSession = () => {
		removeFromStorage()
		queryClient.clear()
		setAuth(false)
		setAuthResolved(true)
		router.replace('/login')
	}

	const revokeMutation = useMutation({
		mutationFn: (session: IUserSession) =>
			authService.revokeSession(session.id),
		onSuccess: (result, session) => {
			setConfirmation(null)
			toast.success(
				session.isCurrent
					? 'Вы вышли из аккаунта на этом устройстве'
					: 'Сессия устройства завершена'
			)

			if (result.currentSessionRevoked) {
				finishCurrentSession()
				return
			}

			queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })
		},
		onError: () => {
			toast.error('Не удалось завершить сессию. Попробуйте ещё раз.')
		}
	})

	const revokeAllMutation = useMutation({
		mutationFn: () => authService.revokeAllSessions(),
		onSuccess: () => {
			setConfirmation(null)
			toast.success('Вы вышли со всех устройств')
			finishCurrentSession()
		},
		onError: () => {
			toast.error('Не удалось завершить все сессии. Попробуйте ещё раз.')
		}
	})

	const isPending = revokeMutation.isPending || revokeAllMutation.isPending

	return (
		<>
			<section className={styles.section}>
				<div className={styles.sessionsHeader}>
					<div>
						<h2 className={styles.sessionsTitle}>Активные сессии</h2>
						<p className={styles.sessionsDescription}>
							Здесь отображаются устройства, на которых выполнен вход в ваш
							аккаунт.
						</p>
					</div>
					{sessions.length > 0 && (
						<button
							type="button"
							className={styles.sessionsDangerButton}
							onClick={() => setConfirmation({ type: 'all' })}
							disabled={isPending}
						>
							Выйти со всех устройств
						</button>
					)}
				</div>

				{isLoading && (
					<p className={styles.sessionsState}>Загружаем сессии…</p>
				)}
				{isError && (
					<p className={styles.sessionsError}>
						Не удалось загрузить активные сессии.
					</p>
				)}
				{!isLoading && !isError && sessions.length === 0 && (
					<p className={styles.sessionsState}>
						Активные сессии не найдены.
					</p>
				)}

				<div className={styles.sessionsList}>
					{sessions.map(session => (
						<article key={session.id} className={styles.sessionCard}>
							<div className={styles.sessionInfo}>
								<div className={styles.sessionNameRow}>
									<h3 className={styles.sessionName}>
										{getDeviceName(session.userAgent)}
									</h3>
									{session.isCurrent && (
										<span className={styles.currentSessionBadge}>
											Текущее устройство
										</span>
									)}
								</div>
								<dl className={styles.sessionMeta}>
									<div>
										<dt>IP-адрес</dt>
										<dd>{session.ipAddress || 'Не определён'}</dd>
									</div>
									<div>
										<dt>Вход</dt>
										<dd>{formatDate(session.createdAt)}</dd>
									</div>
									<div>
										<dt>Последняя активность</dt>
										<dd>{formatDate(session.lastUsedAt)}</dd>
									</div>
								</dl>
							</div>
							<button
								type="button"
								className={styles.sessionEndButton}
								onClick={() =>
									setConfirmation({ type: 'session', session })
								}
								disabled={isPending}
							>
								{session.isCurrent ? 'Выйти' : 'Завершить'}
							</button>
						</article>
					))}
				</div>
			</section>

			{confirmation?.type === 'session' && (
				<ConfirmDialog
					title={
						confirmation.session.isCurrent
							? 'Выйти на этом устройстве?'
							: 'Завершить сессию?'
					}
					message={
						confirmation.session.isCurrent
							? 'Для продолжения работы потребуется снова войти в аккаунт.'
							: `Устройство «${getDeviceName(confirmation.session.userAgent)}» потеряет доступ к аккаунту.`
					}
					confirmLabel={
						confirmation.session.isCurrent ? 'Выйти' : 'Завершить'
					}
					onCancel={() => setConfirmation(null)}
					onConfirm={() => revokeMutation.mutate(confirmation.session)}
				/>
			)}

			{confirmation?.type === 'all' && (
				<ConfirmDialog
					title="Выйти со всех устройств?"
					message="Все активные сессии, включая текущую, будут завершены. Для продолжения работы потребуется снова войти в аккаунт."
					confirmLabel="Выйти со всех"
					onCancel={() => setConfirmation(null)}
					onConfirm={() => revokeAllMutation.mutate()}
				/>
			)}
		</>
	)
}

export default CabinetSessions
