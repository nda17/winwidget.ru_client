'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import adminEventLogService, {
	AdminEventLogAction,
	AdminEventLogSection,
	IAdminEventLogItem
} from '@/services/admin-event-log/admin-event-log.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import styles from './AdminEventLog.module.scss'

const SECTION_LABELS: Record<AdminEventLogSection, string> = {
	PAYMENTS: 'Платежи',
	MAILINGS: 'Рассылки',
	TASKS: 'Ручные задачи',
	SUBSCRIPTIONS: 'Подписки',
	USERS: 'Пользователи',
	BACKLOG: 'Бэклог'
}

const ACTION_LABELS: Record<AdminEventLogAction, string> = {
	PAYMENT_MANUAL_CHECK: 'Проверка платежа',
	PAYMENT_CLEANUP_RUN: 'Очистка платежей',
	MAILING_BROADCAST_SEND: 'Ручная рассылка',
	SUBSCRIPTION_ACTIVATE: 'Активация подписки',
	SUBSCRIPTION_EXTEND_DAYS: 'Бонусные дни',
	SUBSCRIPTION_CANCEL: 'Отмена подписки',
	SUBSCRIPTION_EXPIRY_CHECK_RUN: 'Проверка подписок',
	VERIFICATION_CHALLENGE_CLEANUP_RUN: 'Очистка кодов',
	USER_UPDATE: 'Редактирование пользователя',
	USER_TOGGLE_ACTIVATION: 'Активация пользователя',
	USER_DELETE: 'Удаление пользователя',
	BACKLOG_TASK_CREATE: 'Создание задачи',
	BACKLOG_TASK_UPDATE: 'Обновление задачи',
	BACKLOG_TASK_DELETE: 'Удаление задачи'
}

const formatDateTime = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(new Date(value))

const formatActor = (item: IAdminEventLogItem) =>
	item.adminName ||
	item.adminEmail ||
	item.adminId ||
	'Администратор не найден'

const formatTarget = (item: IAdminEventLogItem) =>
	item.targetUserName ||
	item.targetUserEmail ||
	item.entityLabel ||
	item.targetUserId ||
	item.entityId ||
	'—'

const getPrimitiveMetadata = (item: IAdminEventLogItem, key: string) => {
	const value = item.metadata?.[key]

	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return String(value)
	}

	return null
}

const formatMetadata = (item: IAdminEventLogItem) => {
	const metadata = item.metadata
	if (!metadata) return '—'

	const parts: string[] = []
	const affectedCount = getPrimitiveMetadata(item, 'affectedCount')
	const recipientCount = getPrimitiveMetadata(item, 'recipientCount')
	const sentCount = getPrimitiveMetadata(item, 'sentCount')
	const failedCount = getPrimitiveMetadata(item, 'failedCount')
	const days = getPrimitiveMetadata(item, 'days')
	const plan = getPrimitiveMetadata(item, 'plan')
	const billingPeriod = getPrimitiveMetadata(item, 'billingPeriod')
	const providerStatus = getPrimitiveMetadata(item, 'providerStatus')
	const localStatus = getPrimitiveMetadata(item, 'localStatus')
	const status = getPrimitiveMetadata(item, 'status')
	const updatedFields = metadata.updatedFields

	if (affectedCount) parts.push(`Затронуто: ${affectedCount}`)
	if (recipientCount) parts.push(`Получателей: ${recipientCount}`)
	if (sentCount) parts.push(`Отправлено: ${sentCount}`)
	if (failedCount) parts.push(`Ошибок: ${failedCount}`)
	if (days) parts.push(`Дней: ${days}`)
	if (plan) parts.push(`Тариф: ${plan}`)
	if (billingPeriod) parts.push(`Период: ${billingPeriod}`)
	if (providerStatus) parts.push(`YooKassa: ${providerStatus}`)
	if (localStatus) parts.push(`Локально: ${localStatus}`)
	if (status) parts.push(`Статус: ${status}`)
	if (Array.isArray(updatedFields) && updatedFields.length) {
		parts.push(`Поля: ${updatedFields.join(', ')}`)
	}
	if (metadata.passwordChanged === true) {
		parts.push('Пароль изменён')
	}

	return parts.join(' · ') || '—'
}

const AdminEventLog: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const [currentPage, setCurrentPage] = useState(1)
	const itemQuantity = 20

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ['admin-event-log', currentPage, itemQuantity],
		queryFn: () => adminEventLogService.getAll(currentPage, itemQuantity),
		enabled: auth
	})

	const totalItems = data?.total ?? 0
	const totalPages = data?.totalPages ?? currentPage
	const activePage = data?.items ?? []
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const prevPage = () => setCurrentPage(page => Math.max(1, page - 1))
	const nextPage = () =>
		setCurrentPage(page => Math.min(totalPages, page + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Журнал событий"
				title="Журнал действий администратора"
				description="Показывает ручные действия администраторов: платежи, рассылки, задачи, подписки, пользователей и служебные операции."
				risk="low"
				riskText="Раздел только показывает уже записанные события и не меняет данные проекта."
			/>

			{isLoading ? (
				<div className={styles.card}>
					{Array.from({ length: 6 }).map((_, index) => (
						<SkeletonLoader
							key={index}
							count={1}
							className={styles.skeletonRow}
						/>
					))}
				</div>
			) : totalItems ? (
				<div className={styles.listSection}>
					<div className={styles.listMeta}>
						<div>
							<p className={styles.metaTitle}>События</p>
							<p className={styles.metaSubtitle}>
								Всего записей: {totalItems}
							</p>
						</div>
						<p className={styles.metaSubtitle}>
							{isFetching
								? 'Обновляем...'
								: `Страница ${data?.page ?? currentPage} из ${totalPages}`}
						</p>
					</div>

					<div className={styles.mobileList}>
						{activePage.map(item => (
							<div key={item.id} className={styles.eventCard}>
								<div className={styles.cardRow}>
									<span className={styles.cardLabel}>Дата</span>
									<span className={styles.cardValue}>
										{formatDateTime(item.createdAt)}
									</span>
								</div>
								<div className={styles.cardRow}>
									<span className={styles.cardLabel}>Админ</span>
									<span className={styles.cardValue}>
										{formatActor(item)}
									</span>
								</div>
								<div className={styles.cardRow}>
									<span className={styles.cardLabel}>Раздел</span>
									<span
										className={clsx(
											styles.sectionBadge,
											styles[`section-${item.section.toLowerCase()}`]
										)}
									>
										{SECTION_LABELS[item.section] ?? item.section}
									</span>
								</div>
								<div className={styles.cardRow}>
									<span className={styles.cardLabel}>Действие</span>
									<span className={styles.cardValue}>
										{ACTION_LABELS[item.action] ?? item.action}
									</span>
								</div>
								<div className={styles.cardRow}>
									<span className={styles.cardLabel}>Объект</span>
									<span className={styles.cardValue}>
										{formatTarget(item)}
									</span>
								</div>
								<div className={styles.cardDetails}>
									<p>{item.description}</p>
									<span>{formatMetadata(item)}</span>
								</div>
							</div>
						))}
					</div>

					<div className={styles.tableScroll}>
						<table className={styles.table}>
							<caption className="srOnly">
								Журнал действий администратора
							</caption>
							<thead>
								<tr>
									<th scope="col">Дата</th>
									<th scope="col">Администратор</th>
									<th scope="col">Раздел</th>
									<th scope="col">Действие</th>
									<th scope="col">Объект</th>
									<th scope="col">Детали</th>
									<th scope="col">IP</th>
								</tr>
							</thead>
							<tbody>
								{activePage.map(item => (
									<tr key={item.id}>
										<td>{formatDateTime(item.createdAt)}</td>
										<td>
											<span className={styles.actor}>
												{formatActor(item)}
											</span>
											{item.adminEmail && (
												<span className={styles.actorEmail}>
													{item.adminEmail}
												</span>
											)}
										</td>
										<td>
											<span
												className={clsx(
													styles.sectionBadge,
													styles[`section-${item.section.toLowerCase()}`]
												)}
											>
												{SECTION_LABELS[item.section] ?? item.section}
											</span>
										</td>
										<td>{ACTION_LABELS[item.action] ?? item.action}</td>
										<td>{formatTarget(item)}</td>
										<td>
											<span className={styles.description}>
												{item.description}
											</span>
											<span className={styles.details}>
												{formatMetadata(item)}
											</span>
										</td>
										<td>{item.ip || '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{totalItems > itemQuantity && (
						<Pagination
							listPage={listPage}
							currentPage={currentPage}
							prevPage={prevPage}
							nextPage={nextPage}
							changeActivePage={changeActivePage}
						/>
					)}
				</div>
			) : (
				<div className={styles.card}>
					<p className={styles.metaSubtitle}>Событий пока нет</p>
				</div>
			)}
		</section>
	)
}

export default AdminEventLog
