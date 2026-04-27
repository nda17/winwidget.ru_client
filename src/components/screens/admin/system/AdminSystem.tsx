'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import adminHealthService, {
	type AdminHealthCheck,
	type AdminHealthStatus
} from '@/services/admin-health/admin-health.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { NextPage } from 'next'
import styles from './AdminSystem.module.scss'

const statusLabels: Record<AdminHealthStatus, string> = {
	ok: 'Работает',
	warning: 'Нужно внимание',
	down: 'Ошибка',
	disabled: 'Отключено'
}

const formatDate = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'medium'
	}).format(new Date(value))

const formatUptime = (seconds: number) => {
	const days = Math.floor(seconds / 86400)
	const hours = Math.floor((seconds % 86400) / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)

	if (days > 0) return `${days} д ${hours} ч`
	if (hours > 0) return `${hours} ч ${minutes} мин`

	return `${minutes} мин`
}

const AdminSystem: NextPage = () => {
	const auth = useAuthStore(state => state.auth)

	const { data, isLoading, isError, refetch, isFetching } = useQuery({
		queryKey: ['admin-health'],
		queryFn: adminHealthService.get,
		enabled: auth,
		refetchInterval: 30000
	})

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<SubHeading text="Система" />

			<div className={styles.section}>
				<div className={styles.header}>
					<div>
						<p className={styles.title}>Статус сервисов</p>
						<p className={styles.hint}>
							Обновляется автоматически каждые 30 секунд
						</p>
					</div>
					<button
						className={styles.refreshBtn}
						onClick={() => refetch()}
						disabled={isFetching}
					>
						Обновить
					</button>
				</div>

				{isLoading ? (
					<div className={styles.statusGrid}>
						<SkeletonLoader count={1} className="h-[122px]" />
						<SkeletonLoader count={1} className="h-[122px]" />
						<SkeletonLoader count={1} className="h-[122px]" />
						<SkeletonLoader count={1} className="h-[122px]" />
					</div>
				) : isError || !data ? (
					<p className={styles.empty}>
						Не удалось получить статус системы
					</p>
				) : (
					<>
						<div className={styles.meta}>
							<span>Режим: {data.mode}</span>
							<span>Аптайм: {formatUptime(data.uptimeSeconds)}</span>
							<span>Проверено: {formatDate(data.generatedAt)}</span>
						</div>
						<div className={styles.statusGrid}>
							{data.checks.map(check => (
								<HealthCard key={check.id} check={check} />
							))}
						</div>
					</>
				)}
			</div>
		</section>
	)
}

function HealthCard({ check }: { check: AdminHealthCheck }) {
	return (
		<article className={styles.card}>
			<div className={styles.cardTop}>
				<p className={styles.cardTitle}>{check.title}</p>
				<span
					className={clsx(styles.badge, styles[`badge_${check.status}`])}
				>
					{statusLabels[check.status]}
				</span>
			</div>
			<p className={styles.message}>{check.message}</p>
			{typeof check.latencyMs === 'number' && (
				<p className={styles.latency}>{check.latencyMs} мс</p>
			)}
		</article>
	)
}

export default AdminSystem
