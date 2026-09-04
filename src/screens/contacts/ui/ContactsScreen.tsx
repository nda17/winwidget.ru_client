'use client'

import { useCrmWorkspaceAccess } from '@/entities/crm-access'
import {
	AppIcon,
	Button,
	DataTable,
	Drawer,
	PageHeader,
	SelectField,
	StatusBadge,
	TextField,
	type DataTableColumn
} from '@/shared/ui'
import {
	contacts,
	type ContactViewModel
} from '@/screens/contacts/model/contacts.fixtures'
import type { FormEvent } from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import styles from './ContactsScreen.module.scss'

const ContactsScreen = () => {
	const { canWrite } = useCrmWorkspaceAccess()
	const [selectedContact, setSelectedContact] =
		useState<ContactViewModel | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const isDrawerOpen = selectedContact !== null || isCreateOpen

	const columns: readonly DataTableColumn<ContactViewModel>[] = [
		{
			id: 'contact',
			header: 'Контакт',
			render: contact => (
				<button
					type="button"
					className={styles.contactButton}
					onClick={() => setSelectedContact(contact)}
				>
					<span className={styles.avatar} aria-hidden="true">
						{contact.initials}
					</span>
					<span className={styles.contactCopy}>
						<strong>{contact.name}</strong>
						<span>{contact.company}</span>
					</span>
				</button>
			)
		},
		{
			id: 'phone',
			header: 'Телефон',
			render: contact => contact.phone
		},
		{
			id: 'email',
			header: 'Email',
			render: contact => contact.email
		},
		{
			id: 'deals',
			header: 'Открытые сделки',
			align: 'center',
			render: contact => (
				<StatusBadge tone={contact.openDeals > 1 ? 'accent' : 'neutral'}>
					{contact.openDeals}
				</StatusBadge>
			)
		},
		{
			id: 'activity',
			header: 'Последняя активность',
			render: contact => contact.lastActivity
		}
	]

	const handleDemoSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canWrite) return
		toast.success('Демо-режим: контакт не сохранён')
	}

	const closeDrawer = () => {
		setSelectedContact(null)
		setIsCreateOpen(false)
	}

	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Клиентская база"
				title="Контакты"
				description="Таблица и форма демонстрируют будущую работу с клиентской базой без сохранения и автоматического поиска дублей."
				actions={
					<Button
						disabled={!canWrite}
						leadingIcon={<AppIcon name="plus" size={18} />}
						onClick={() => setIsCreateOpen(true)}
					>
						Новый контакт
					</Button>
				}
			/>

			<section
				className={styles.panel}
				aria-labelledby="contacts-list-title"
			>
				<div className={styles.panelHeader}>
					<div>
						<h2 id="contacts-list-title" className={styles.panelTitle}>
							Все контакты
						</h2>
						<p className={styles.panelDescription}>
							Телефоны и email являются заведомо синтетическими.
						</p>
					</div>
					<Button
						variant="secondary"
						size="sm"
						leadingIcon={<AppIcon name="filter" size={16} />}
						onClick={() => toast('Фильтры пока не подключены к данным')}
					>
						Фильтры
					</Button>
				</div>
				<DataTable
					caption="Демонстрационная таблица контактов"
					columns={columns}
					rows={contacts}
					getRowKey={contact => contact.id}
					embedded
				/>
			</section>

			<Drawer
				isOpen={isDrawerOpen}
				onClose={closeDrawer}
				title={selectedContact ? selectedContact.name : 'Новый контакт'}
				description="Форма является UX-прототипом и не сохраняет изменения."
				footer={
					<>
						<Button variant="secondary" onClick={closeDrawer}>
							Закрыть
						</Button>
						<Button
							type="submit"
							form="demo-contact-form"
							disabled={!canWrite}
						>
							Проверить макет
						</Button>
					</>
				}
			>
				{isDrawerOpen ? (
					<form
						key={selectedContact?.id ?? 'new-contact'}
						id="demo-contact-form"
						className={styles.form}
						onSubmit={handleDemoSubmit}
					>
						<TextField
							readOnly={!canWrite}
							label="Имя"
							name="name"
							defaultValue={selectedContact?.name}
							placeholder="Синтетический контакт"
							required
						/>
						<TextField
							readOnly={!canWrite}
							label="Компания"
							name="company"
							defaultValue={selectedContact?.company}
							placeholder="Название компании"
						/>
						<TextField
							readOnly={!canWrite}
							label="Телефон"
							name="phone"
							defaultValue={selectedContact?.phone}
							placeholder="+7 (900) 000-00-00"
						/>
						<TextField
							readOnly={!canWrite}
							label="Email"
							name="email"
							type="email"
							defaultValue={selectedContact?.email}
							placeholder="name@example.test"
						/>
						<SelectField
							disabled={!canWrite}
							label="Источник"
							name="source"
							defaultValue="manual"
						>
							<option value="manual">Создан вручную · demo</option>
							<option value="inbox">Входящее обращение · demo</option>
						</SelectField>
					</form>
				) : null}
			</Drawer>
		</div>
	)
}

export default ContactsScreen
