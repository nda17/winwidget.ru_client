'use client'

import { errorCatch } from '@/api/api.helper'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import adminTelegramBotService from '@/services/admin-telegram-bot/admin-telegram-bot.service'
import devToolsService from '@/services/dev-tools/dev-tools.service'
import { useMutation, useQuery } from '@tanstack/react-query'
import { NextPage } from 'next'
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminDevTools.module.scss'

const AdminDevTools: NextPage = () => {
	const [restoreFile, setRestoreFile] = useState<File | null>(null)
	const [restoreConfirmation, setRestoreConfirmation] = useState('')

	const { data: settings, isLoading } = useQuery({
		queryKey: ['admin-telegram-bot-settings'],
		queryFn: adminTelegramBotService.get
	})

	const databaseRestoreMutation = useMutation({
		mutationFn: ({
			file,
			confirmation
		}: {
			file: File
			confirmation: string
		}) => devToolsService.restoreDatabaseBackup(file, confirmation),
		onSuccess: () => {
			setRestoreFile(null)
			setRestoreConfirmation('')
		}
	})

	const handleRestoreDatabaseBackup = () => {
		if (!restoreFile) {
			toast.error('Выберите файл backup .dump')
			return
		}

		const promise = databaseRestoreMutation.mutateAsync({
			file: restoreFile,
			confirmation: restoreConfirmation.trim()
		})

		toast.promise(promise, {
			loading: 'Восстанавливаем базу данных...',
			success: 'База данных восстановлена из backup',
			error: error => `Ошибка восстановления: ${errorCatch(error)}`
		})
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="DEV"
				title="DEV-инструменты"
				description="Раздел доступен только роли DEV и содержит операции, которые могут сильно повлиять на production-данные."
				risk="high"
				riskText="Восстановление базы заменяет текущие данные содержимым backup-файла. Перед запуском проверь окружение, файл и подтверждение."
			/>

			<div className={styles.card}>
				{isLoading ? (
					<>
						<SkeletonLoader count={1} className="h-[52px]" />
						<SkeletonLoader count={1} className="h-[52px]" />
					</>
				) : settings ? (
					<>
						<div>
							<p className={styles.label}>Восстановление из backup</p>
							<p className={styles.hint}>
								Операция принимает PostgreSQL `.dump` и запускает restore
								через серверный инструмент. Действие логируется в журнале
								событий.
							</p>
						</div>
						<div className={styles.restoreGrid}>
							<label className={styles.fileInputLabel}>
								<span>Файл .dump</span>
								<input
									type="file"
									accept=".dump"
									onChange={event =>
										setRestoreFile(event.target.files?.[0] ?? null)
									}
								/>
							</label>
							<input
								className={styles.input}
								value={restoreConfirmation}
								onChange={event =>
									setRestoreConfirmation(event.target.value)
								}
								placeholder={settings.databaseRestoreConfirmation}
							/>
							<button
								type="button"
								className={styles.dangerBtn}
								onClick={handleRestoreDatabaseBackup}
								disabled={databaseRestoreMutation.isPending}
							>
								Восстановить БД
							</button>
						</div>
						<p className={styles.hint}>
							Для подтверждения введите:{' '}
							<b>{settings.databaseRestoreConfirmation}</b>
							{restoreFile ? `; выбран файл ${restoreFile.name}` : ''}
						</p>
					</>
				) : (
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				)}
			</div>
		</section>
	)
}

export default AdminDevTools
