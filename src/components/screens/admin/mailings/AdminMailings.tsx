'use client'

import { errorCatch } from '@/api/api.helper'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog'
import Heading from '@/components/ui/heading/Heading'
import adminMailingsService, {
	AdminMailingAudience,
	IAdminBroadcastResult
} from '@/services/admin-mailings/admin-mailings.service'
import { useMutation } from '@tanstack/react-query'
import { NextPage } from 'next'
import { FormEvent, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminMailings.module.scss'

const AUDIENCE_LABELS: Record<AdminMailingAudience, string> = {
	ACTIVE_SUBSCRIPTION: 'только пользователям с активной подпиской',
	ALL: 'всем пользователям с email'
}

const formatExecutedAt = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'medium'
	}).format(new Date(value))

const AdminMailings: NextPage = () => {
	const [subject, setSubject] = useState('')
	const [message, setMessage] = useState('')
	const [audience, setAudience] = useState<AdminMailingAudience>(
		'ACTIVE_SUBSCRIPTION'
	)
	const [confirmOpened, setConfirmOpened] = useState(false)
	const [lastResult, setLastResult] =
		useState<IAdminBroadcastResult | null>(null)

	const mailingMutation = useMutation({
		mutationKey: ['admin-mailing-broadcast'],
		mutationFn: adminMailingsService.sendBroadcast,
		onSuccess: result => {
			setLastResult(result)
			setConfirmOpened(false)
		}
	})

	const isActiveAudience = audience === 'ACTIVE_SUBSCRIPTION'
	const trimmedSubject = subject.trim()
	const trimmedMessage = message.trim()

	const validate = () => {
		if (trimmedSubject.length < 3) {
			toast.error('Введите тему письма')
			return false
		}

		if (trimmedMessage.length < 10) {
			toast.error('Введите текст оповещения')
			return false
		}

		return true
	}

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!validate()) return
		setConfirmOpened(true)
	}

	const confirmSending = () => {
		if (mailingMutation.isPending) return
		setConfirmOpened(false)

		const promise = mailingMutation.mutateAsync({
			subject: trimmedSubject,
			message: trimmedMessage,
			audience
		})

		toast.promise(promise, {
			loading: 'Отправляем рассылку...',
			success: result =>
				`Рассылка завершена. Отправлено: ${result.sentCount}`,
			error: error => `Ошибка рассылки: ${errorCatch(error)}`
		})
	}

	return (
		<section className={styles.wrapper}>
			{confirmOpened && (
				<ConfirmDialog
					title="Отправить рассылку?"
					message={`Письмо уйдёт ${AUDIENCE_LABELS[audience]}. Действие нельзя отменить после отправки.`}
					confirmLabel="Отправить"
					cancelLabel="Назад"
					onConfirm={confirmSending}
					onCancel={() => setConfirmOpened(false)}
				/>
			)}

			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Рассылки"
				title="Массовая рассылка"
				description="Отправляет email-оповещение пользователям, у которых в базе есть email."
				risk="high"
				riskText="Письмо отправляется сразу выбранной аудитории. Перед отправкой проверь тему, текст и режим аудитории."
			/>

			<form className={styles.card} onSubmit={handleSubmit}>
				<div className={styles.field}>
					<label htmlFor="mailing-subject" className={styles.label}>
						Тема письма
					</label>
					<input
						id="mailing-subject"
						name="mailing-subject"
						className={styles.input}
						value={subject}
						onChange={event => setSubject(event.target.value)}
						placeholder="Например: Важное обновление WinWidget"
						maxLength={120}
					/>
					<p className={styles.counter}>{subject.length}/120</p>
				</div>

				<div className={styles.field}>
					<label htmlFor="mailing-message" className={styles.label}>
						Текст оповещения
					</label>
					<textarea
						id="mailing-message"
						name="mailing-message"
						className={styles.textarea}
						value={message}
						onChange={event => setMessage(event.target.value)}
						placeholder="Введите текст письма"
						maxLength={5000}
						rows={9}
					/>
					<p className={styles.counter}>{message.length}/5000</p>
				</div>

				<div className={styles.audienceRow}>
					<div>
						<p className={styles.label}>Аудитория</p>
						<p className={styles.hint}>
							{isActiveAudience
								? 'Только пользователи с активной подпиской'
								: 'Все пользователи, у которых есть email в базе'}
						</p>
					</div>
					<button
						type="button"
						className={`${styles.toggle} ${isActiveAudience ? styles.toggleOn : ''}`}
						onClick={() =>
							setAudience(isActiveAudience ? 'ALL' : 'ACTIVE_SUBSCRIPTION')
						}
						aria-pressed={isActiveAudience}
					>
						<span className={styles.toggleThumb} />
					</button>
				</div>

				<div className={styles.audienceOptions}>
					<button
						type="button"
						className={`${styles.optionBtn} ${isActiveAudience ? styles.optionBtnActive : ''}`}
						onClick={() => setAudience('ACTIVE_SUBSCRIPTION')}
					>
						Активная подписка
					</button>
					<button
						type="button"
						className={`${styles.optionBtn} ${!isActiveAudience ? styles.optionBtnActive : ''}`}
						onClick={() => setAudience('ALL')}
					>
						Все с email
					</button>
				</div>

				<button
					type="submit"
					className={styles.sendBtn}
					disabled={mailingMutation.isPending}
				>
					{mailingMutation.isPending ? 'Отправляем...' : 'Отправить'}
				</button>
			</form>

			{lastResult && (
				<div className={styles.resultCard}>
					<p className={styles.resultTitle}>Последняя рассылка</p>
					<div className={styles.resultGrid}>
						<div>
							<span className={styles.resultLabel}>Аудитория</span>
							<span className={styles.resultValue}>
								{lastResult.audience === 'ACTIVE_SUBSCRIPTION'
									? 'Активная подписка'
									: 'Все с email'}
							</span>
						</div>
						<div>
							<span className={styles.resultLabel}>Получателей</span>
							<span className={styles.resultValue}>
								{lastResult.recipientCount}
							</span>
						</div>
						<div>
							<span className={styles.resultLabel}>Отправлено</span>
							<span className={styles.resultValue}>
								{lastResult.sentCount}
							</span>
						</div>
						<div>
							<span className={styles.resultLabel}>Ошибок</span>
							<span className={styles.resultValue}>
								{lastResult.failedCount}
							</span>
						</div>
					</div>
					<p className={styles.resultTime}>
						{formatExecutedAt(lastResult.executedAt)}
					</p>
				</div>
			)}
		</section>
	)
}

export default AdminMailings
