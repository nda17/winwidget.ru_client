'use client'

import {
	AppIcon,
	Button,
	DataTable,
	PageHeader,
	ScreenState,
	StatusBadge,
	type DataTableColumn,
	type StatusBadgeTone
} from '@/shared/ui'
import {
	tasks,
	type TaskViewModel
} from '@/screens/tasks/model/tasks.fixtures'
import toast from 'react-hot-toast'

import styles from './TasksScreen.module.scss'

const statusTone: Record<TaskViewModel['status'], StatusBadgeTone> = {
	Просрочено: 'danger',
	Сегодня: 'warning',
	Запланировано: 'info'
}

const columns: readonly DataTableColumn<TaskViewModel>[] = [
	{
		id: 'task',
		header: 'Задача',
		render: task => (
			<div className={styles.taskCopy}>
				<strong>{task.title}</strong>
				<span>{task.deal}</span>
			</div>
		)
	},
	{
		id: 'contact',
		header: 'Контакт',
		render: task => task.contact
	},
	{
		id: 'due',
		header: 'Срок',
		render: task => (
			<div className={styles.dueCell}>
				<StatusBadge tone={statusTone[task.status]}>
					{task.status}
				</StatusBadge>
				<span>{task.dueLabel}</span>
			</div>
		)
	},
	{
		id: 'owner',
		header: 'Ответственный',
		render: task => task.owner
	},
	{
		id: 'action',
		header: <span className={styles.visuallyHidden}>Действие</span>,
		align: 'right',
		render: task => (
			<Button
				variant="ghost"
				size="sm"
				onClick={() =>
					toast(`Демо-режим: задача «${task.title}» не изменена`)
				}
			>
				Выполнено
			</Button>
		)
	}
]

const TasksScreen = () => {
	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Следующие действия"
				title="Задачи"
				description="Рабочая очередь менеджера: просроченные, сегодняшние и ближайшие действия."
				actions={
					<Button
						leadingIcon={<AppIcon name="plus" size={18} />}
						onClick={() =>
							toast('Демо-режим: создание задач пока не сохраняется')
						}
					>
						Новая задача
					</Button>
				}
			/>

			<section className={styles.panel} aria-labelledby="tasks-list-title">
				<div className={styles.panelHeader}>
					<div>
						<h2 id="tasks-list-title" className={styles.panelTitle}>
							Приоритет на сегодня
						</h2>
						<p className={styles.panelDescription}>
							Сортировка и пагинация появятся на серверной стороне.
						</p>
					</div>
					<StatusBadge tone="warning">1 просрочена</StatusBadge>
				</div>
				<DataTable
					caption="Демонстрационный список задач"
					columns={columns}
					rows={tasks}
					getRowKey={task => task.id}
					embedded
				/>
			</section>

			<section
				className={styles.emptyPanel}
				aria-labelledby="unscheduled-title"
			>
				<h2 id="unscheduled-title" className={styles.visuallyHidden}>
					Задачи без срока
				</h2>
				<ScreenState
					variant="empty"
					title="Задач без срока нет"
					description="Пустое состояние остаётся полезным и подсказывает, что очередь обработана."
					compact
				/>
			</section>
		</div>
	)
}

export default TasksScreen
