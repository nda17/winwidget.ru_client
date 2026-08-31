'use client'

import {
	AppIcon,
	Button,
	PageHeader,
	ReadOnlyBanner,
	ScreenState,
	SelectField,
	StatusBadge,
	TextField
} from '@/shared/ui'
import toast from 'react-hot-toast'

import styles from './SettingsScreen.module.scss'

const SettingsScreen = () => {
	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Конфигурация"
				title="Настройки CRM"
				description="Каркас показывает режим только для чтения и закрытый блок до подключения ролей и прав доступа."
				actions={<StatusBadge tone="accent">Демо состояний</StatusBadge>}
			/>

			<ReadOnlyBanner
				tone="warning"
				title="Настройки открыты только для просмотра"
				description="Роли и правила изменения ещё не подключены. Контролы действительно отключены, а не только визуально заблокированы."
				action={
					<Button
						variant="secondary"
						size="sm"
						onClick={() => toast('Управление правами пока не подключено')}
					>
						Почему недоступно
					</Button>
				}
			/>

			<div className={styles.settingsGrid}>
				<section
					className={styles.panel}
					aria-labelledby="workspace-title"
				>
					<div className={styles.panelHeader}>
						<div>
							<h2 id="workspace-title" className={styles.panelTitle}>
								Рабочее пространство
							</h2>
							<p className={styles.panelDescription}>
								Визуальная форма без сохранения.
							</p>
						</div>
						<AppIcon name="lock" size={20} />
					</div>
					<form className={styles.form}>
						<TextField
							label="Название"
							name="workspace-name"
							value="Локальное пространство · demo"
							disabled
							readOnly
						/>
						<SelectField
							label="Часовой пояс"
							name="timezone"
							value="Europe/Moscow"
							disabled
						>
							<option value="Europe/Moscow">Москва · demo</option>
						</SelectField>
						<SelectField
							label="Воронка по умолчанию"
							name="pipeline"
							value="main"
							disabled
						>
							<option value="main">Основная · demo</option>
						</SelectField>
						<Button disabled fullWidth>
							Сохранить настройки
						</Button>
					</form>
				</section>

				<section
					className={styles.panel}
					aria-labelledby="permissions-title"
				>
					<h2 id="permissions-title" className={styles.visuallyHidden}>
						Команда и роли
					</h2>
					<ScreenState
						variant="permission"
						title="Недостаточно прав для управления командой"
						description="Доступная для чтения часть CRM остаётся открытой, а закрывается только защищённый блок сотрудников и ролей."
						action={
							<Button
								variant="secondary"
								size="sm"
								onClick={() => toast('Запрос доступа пока недоступен')}
							>
								Запросить доступ
							</Button>
						}
					/>
				</section>
			</div>
		</div>
	)
}

export default SettingsScreen
