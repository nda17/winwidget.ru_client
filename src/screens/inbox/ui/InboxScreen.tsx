'use client'

import { useCrmWorkspaceAccess } from '@/entities/crm-access'
import {
	AppIcon,
	Button,
	DataTable,
	Drawer,
	PageHeader,
	StatusBadge,
	type DataTableColumn,
	type StatusBadgeTone
} from '@/shared/ui'
import {
	inboxLeads,
	type InboxLeadViewModel
} from '@/screens/inbox/model/inbox.fixtures'
import { useState } from 'react'
import toast from 'react-hot-toast'

import styles from './InboxScreen.module.scss'

const statusTone: Record<InboxLeadViewModel['status'], StatusBadgeTone> = {
	Новый: 'info',
	Проверить: 'warning',
	Спам: 'danger'
}

const InboxScreen = () => {
	const { canWrite } = useCrmWorkspaceAccess()
	const [selectedLead, setSelectedLead] =
		useState<InboxLeadViewModel | null>(null)

	const columns: readonly DataTableColumn<InboxLeadViewModel>[] = [
		{
			id: 'lead',
			header: 'Обращение',
			render: lead => (
				<button
					type="button"
					className={styles.leadButton}
					onClick={() => setSelectedLead(lead)}
				>
					<span className={styles.avatar} aria-hidden="true">
						{lead.initials}
					</span>
					<span className={styles.leadCopy}>
						<strong>{lead.name}</strong>
						<span>{lead.context}</span>
					</span>
				</button>
			)
		},
		{
			id: 'source',
			header: 'Источник',
			render: lead => lead.source
		},
		{
			id: 'receivedAt',
			header: 'Получено',
			render: lead => lead.receivedAt
		},
		{
			id: 'responsible',
			header: 'Ответственный',
			render: lead => lead.responsible
		},
		{
			id: 'status',
			header: 'Статус',
			render: lead => (
				<StatusBadge tone={statusTone[lead.status]}>
					{lead.status}
				</StatusBadge>
			)
		}
	]

	const handleDemoAccept = () => {
		if (!canWrite) return
		toast('Демо-режим: принятие обращения пока не сохраняется')
	}

	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Рабочая очередь"
				title="Входящие"
				description="Новые обращения из подключённых источников. Сейчас показаны только синтетические данные интерфейса."
				actions={
					<Button
						variant="secondary"
						leadingIcon={<AppIcon name="filter" size={18} />}
						onClick={() => toast('Фильтры и пагинация пока не подключены')}
					>
						Фильтры
					</Button>
				}
			/>

			<section className={styles.panel} aria-labelledby="inbox-list-title">
				<div className={styles.panelHeader}>
					<div>
						<h2 id="inbox-list-title" className={styles.panelTitle}>
							Новые и непроверенные
						</h2>
						<p className={styles.panelDescription}>
							{inboxLeads.length} демонстрационных обращения
						</p>
					</div>
					<StatusBadge tone="accent">Демо-данные</StatusBadge>
				</div>

				<DataTable
					caption="Демонстрационный список входящих обращений"
					columns={columns}
					rows={inboxLeads}
					getRowKey={lead => lead.id}
					embedded
				/>
			</section>

			<Drawer
				isOpen={selectedLead !== null}
				onClose={() => setSelectedLead(null)}
				title={selectedLead?.name ?? 'Обращение'}
				description="Карточка построена на локальных демо-данных и ничего не сохраняет."
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => setSelectedLead(null)}
						>
							Закрыть
						</Button>
						<Button onClick={handleDemoAccept} disabled={!canWrite}>
							Принять в работу
						</Button>
					</>
				}
			>
				{selectedLead ? (
					<div className={styles.drawerContent}>
						<div className={styles.drawerStatusRow}>
							<StatusBadge tone={statusTone[selectedLead.status]}>
								{selectedLead.status}
							</StatusBadge>
							<span>{selectedLead.receivedAt}</span>
						</div>
						<dl className={styles.details}>
							<div>
								<dt>Источник</dt>
								<dd>{selectedLead.source}</dd>
							</div>
							<div>
								<dt>Телефон</dt>
								<dd>{selectedLead.phone}</dd>
							</div>
							<div>
								<dt>Email</dt>
								<dd>{selectedLead.email}</dd>
							</div>
							<div>
								<dt>Ответственный</dt>
								<dd>{selectedLead.responsible}</dd>
							</div>
						</dl>
						<div className={styles.messageCard}>
							<span>Комментарий обращения</span>
							<p>{selectedLead.message}</p>
						</div>
					</div>
				) : null}
			</Drawer>
		</div>
	)
}

export default InboxScreen
