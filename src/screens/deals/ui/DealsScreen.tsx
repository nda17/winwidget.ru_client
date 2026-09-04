'use client'

import { useCrmWorkspaceAccess } from '@/entities/crm-access'
import {
	AppIcon,
	Button,
	Drawer,
	KanbanBoard,
	PageHeader,
	SelectField,
	StatusBadge,
	TextField,
	TextareaField,
	type KanbanColumn,
	type StatusBadgeTone
} from '@/shared/ui'
import {
	dealColumns,
	type DealCardViewModel
} from '@/screens/deals/model/deals.fixtures'
import type { FormEvent } from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import styles from './DealsScreen.module.scss'

const priorityTone: Record<
	DealCardViewModel['priority'],
	StatusBadgeTone
> = {
	normal: 'neutral',
	attention: 'warning',
	overdue: 'danger'
}

const priorityLabel: Record<DealCardViewModel['priority'], string> = {
	normal: 'По плану',
	attention: 'Сегодня',
	overdue: 'Просрочено'
}

const DealsScreen = () => {
	const { canWrite } = useCrmWorkspaceAccess()
	const [selectedDeal, setSelectedDeal] =
		useState<DealCardViewModel | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(false)

	const kanbanColumns: readonly KanbanColumn<DealCardViewModel>[] =
		dealColumns.map(column => ({
			id: column.id,
			title: column.title,
			items: column.items,
			meta: column.summary
		}))

	const handleDemoSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canWrite) return
		toast.success('Демо-режим: форма проверена, данные не сохранены')
	}

	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Продажи"
				title="Сделки"
				description="Статический канбан демонстрирует плотность карточек и будущий рабочий процесс без перемещения и сохранения."
				actions={
					<Button
						disabled={!canWrite}
						leadingIcon={<AppIcon name="plus" size={18} />}
						onClick={() => setIsCreateOpen(true)}
					>
						Новая сделка
					</Button>
				}
			/>

			<div className={styles.prototypeNote}>
				<AppIcon name="lock" size={18} />
				<span>
					Перемещение карточек отключено: в локальном прототипе изменения
					не сохраняются.
				</span>
			</div>

			<KanbanBoard
				ariaLabel="Демонстрационная воронка сделок"
				columns={kanbanColumns}
				getItemKey={deal => deal.id}
				renderItem={(deal, column) => (
					<button
						type="button"
						className={styles.dealCard}
						onClick={() => setSelectedDeal(deal)}
						aria-label={`Открыть сделку «${deal.title}» на этапе «${String(column.title)}»`}
					>
						<span className={styles.cardTopline}>
							<StatusBadge tone={priorityTone[deal.priority]}>
								{priorityLabel[deal.priority]}
							</StatusBadge>
							<strong>{deal.amount}</strong>
						</span>
						<span className={styles.cardTitle}>{deal.title}</span>
						<span className={styles.cardContact}>
							{deal.contact} · {deal.company}
						</span>
						<span className={styles.nextAction}>
							<AppIcon name="clock" size={16} />
							<span>
								{deal.nextAction}
								<small>{deal.dueLabel}</small>
							</span>
						</span>
						<span className={styles.owner}>{deal.owner}</span>
					</button>
				)}
			/>

			<Drawer
				isOpen={selectedDeal !== null}
				onClose={() => setSelectedDeal(null)}
				title={selectedDeal?.title ?? 'Сделка'}
				description="Карточка сделки только для чтения на синтетических данных."
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => setSelectedDeal(null)}
						>
							Закрыть
						</Button>
						<Button
							disabled={!canWrite}
							onClick={() =>
								toast('Демо-режим: действие пока не сохраняется')
							}
						>
							Взял в работу
						</Button>
					</>
				}
			>
				{selectedDeal ? (
					<div className={styles.drawerContent}>
						<div className={styles.dealSummary}>
							<span>Сумма</span>
							<strong>{selectedDeal.amount}</strong>
						</div>
						<dl className={styles.details}>
							<div>
								<dt>Контакт</dt>
								<dd>{selectedDeal.contact}</dd>
							</div>
							<div>
								<dt>Компания</dt>
								<dd>{selectedDeal.company}</dd>
							</div>
							<div>
								<dt>Следующий шаг</dt>
								<dd>{selectedDeal.nextAction}</dd>
							</div>
							<div>
								<dt>Срок</dt>
								<dd>{selectedDeal.dueLabel}</dd>
							</div>
						</dl>
					</div>
				) : null}
			</Drawer>

			<Drawer
				isOpen={isCreateOpen}
				onClose={() => setIsCreateOpen(false)}
				title="Новая сделка"
				description="Поля являются UX-макетом и не определяют структуру сохраняемых данных."
				footer={
					<Button type="submit" form="demo-deal-form" disabled={!canWrite}>
						Проверить макет
					</Button>
				}
			>
				{isCreateOpen ? (
					<form
						id="demo-deal-form"
						className={styles.form}
						onSubmit={handleDemoSubmit}
					>
						<TextField
							readOnly={!canWrite}
							label="Название"
							name="title"
							placeholder="Например, пилот для отдела продаж"
							required
						/>
						<TextField
							readOnly={!canWrite}
							label="Контакт"
							name="contact"
							placeholder="Синтетический контакт"
						/>
						<div className={styles.formGrid}>
							<SelectField
								disabled={!canWrite}
								label="Воронка"
								name="pipeline"
								defaultValue="main"
							>
								<option value="main">Основная · demo</option>
							</SelectField>
							<SelectField
								label="Этап"
								name="stage"
								defaultValue="new"
								disabled={!canWrite}
							>
								<option value="new">Новые</option>
								<option value="work">В работе</option>
							</SelectField>
						</div>
						<TextField
							readOnly={!canWrite}
							label="Сумма"
							name="amount"
							inputMode="numeric"
							placeholder="0 ₽"
						/>
						<TextareaField
							readOnly={!canWrite}
							label="Комментарий"
							name="comment"
							placeholder="Контекст для первого действия"
							rows={4}
						/>
					</form>
				) : null}
			</Drawer>
		</div>
	)
}

export default DealsScreen
