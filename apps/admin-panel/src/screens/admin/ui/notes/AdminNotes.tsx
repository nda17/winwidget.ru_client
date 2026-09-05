'use client'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import Heading from '@/shared/ui/heading/Heading'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import { notesService, IAdminNoteFilters, Note } from '@/entities/note'
import { useAuthStore } from '@/entities/user'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminNotes.module.scss'

type NoteStatusFilter = IAdminNoteFilters['status'] | 'ALL'

interface NoteFilterDraft {
	status: NoteStatusFilter
	createdFrom: string
	createdTo: string
}

const DEFAULT_NOTE_FILTERS: NoteFilterDraft = {
	status: 'ALL',
	createdFrom: '',
	createdTo: ''
}

const STATUS_FILTER_OPTIONS: Array<{
	value: NoteStatusFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все задачи' },
	{ value: 'PENDING', label: 'В работе' },
	{ value: 'DONE', label: 'Выполнено' }
]

const normalizeNoteFilters = (
	draft: NoteFilterDraft
): IAdminNoteFilters => ({
	status: draft.status === 'ALL' ? undefined : draft.status,
	createdFrom: draft.createdFrom || undefined,
	createdTo: draft.createdTo || undefined
})

const AdminNotes: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [inputText, setInputText] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
	const [currentPage, setCurrentPage] = useState(1)
	const [filterDraft, setFilterDraft] = useState(DEFAULT_NOTE_FILTERS)
	const [filters, setFilters] = useState<IAdminNoteFilters>({})
	const itemQuantity = 10

	const { data, isLoading } = useQuery({
		queryKey: ['notes', currentPage, itemQuantity, filters],
		queryFn: () => notesService.getAll(currentPage, itemQuantity, filters),
		enabled: auth
	})

	const createMutation = useMutation({
		mutationFn: (text: string) => notesService.create(text),
		onMutate: () => toast.loading('Добавляем задачу...'),
		onSuccess: (_, __, toastId) => {
			setCurrentPage(1)
			queryClient.invalidateQueries({ queryKey: ['notes'] })
			setInputText('')
			toast.success('Задача добавлена', { id: toastId as string })
		},
		onError: (_, __, toastId) => {
			toast.error('Ошибка добавления', { id: toastId as string })
		}
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => notesService.delete(id),
		onMutate: () => toast.loading('Удаляем задачу...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['notes'] })
			toast.success('Задача удалена', { id: toastId as string })
		},
		onError: (_, __, toastId) => {
			toast.error('Ошибка удаления', { id: toastId as string })
		}
	})

	const handleToggle = (note: Note) => {
		const promise = notesService
			.update(note.id, { done: !note.done })
			.then(() => queryClient.invalidateQueries({ queryKey: ['notes'] }))

		toast.promise(promise, {
			loading: note.done
				? 'Снимаем отметку...'
				: 'Отмечаем выполненной...',
			success: note.done ? 'Отметка снята' : 'Задача выполнена ✓',
			error: 'Ошибка обновления'
		})
	}

	const handleAdd = () => {
		const text = inputText.trim()
		if (!text) return
		createMutation.mutate(text)
	}

	const applyFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setFilters(normalizeNoteFilters(filterDraft))
		setCurrentPage(1)
		toast.success('Фильтры бэклога применены')
	}

	const resetFilters = () => {
		setFilterDraft(DEFAULT_NOTE_FILTERS)
		setFilters({})
		setCurrentPage(1)
		toast.success('Фильтры бэклога сброшены')
	}

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') handleAdd()
	}

	const confirmDelete = () => {
		if (!deleteTarget) return

		deleteMutation.mutate(deleteTarget.id)
		setDeleteTarget(null)
	}

	const activeNotes = data?.items ?? []
	const activePending = activeNotes.filter(n => !n.done)
	const activeDone = activeNotes.filter(n => n.done)
	const totalItems = data?.total ?? 0
	const totalPages = data?.totalPages ?? currentPage
	const doneTotal = data?.doneTotal ?? 0
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const prevPage = () => {
		if (currentPage !== 1) setCurrentPage(prev => prev - 1)
	}

	const nextPage = () => {
		if (currentPage !== totalPages) setCurrentPage(prev => prev + 1)
	}

	const changeActivePage = (page: number) => setCurrentPage(page)

	return (
		<section className={styles.wrapper}>
			{deleteTarget && (
				<ConfirmDialog
					title="Удалить заметку?"
					message="Заметка будет удалёна без возможности восстановления"
					confirmLabel="Удалить"
					cancelLabel="Отмена"
					onConfirm={confirmDelete}
					onCancel={() => setDeleteTarget(null)}
				/>
			)}
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Бэклог"
				title="Внутренний бэклог"
				description="Простой список рабочих заметок и задач для администраторов проекта."
				risk="low"
				riskText="На пользователей и сервис не влияет. Риск только организационный: удалённая задача пропадёт из списка."
			/>

			<div className={styles.section}>
				<div className={styles.inputRow}>
					<input
						className={styles.input}
						type="text"
						placeholder="Новая задача..."
						value={inputText}
						onChange={e => setInputText(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<button
						className={styles.addBtn}
						onClick={handleAdd}
						disabled={!inputText.trim() || createMutation.isPending}
					>
						Добавить
					</button>
				</div>
				<form className={styles.filters} onSubmit={applyFilters}>
					<div className={styles.filterGrid}>
						<label className={styles.filterField}>
							<span className={styles.filterLabel}>Статус</span>
							<select
								className={styles.filterInput}
								value={filterDraft.status}
								onChange={event =>
									setFilterDraft(prev => ({
										...prev,
										status: event.target.value as NoteStatusFilter
									}))
								}
							>
								{STATUS_FILTER_OPTIONS.map(option => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<label className={styles.filterField}>
							<span className={styles.filterLabel}>Создано с</span>
							<input
								className={styles.filterInput}
								type="date"
								value={filterDraft.createdFrom}
								onChange={event =>
									setFilterDraft(prev => ({
										...prev,
										createdFrom: event.target.value
									}))
								}
							/>
						</label>
						<label className={styles.filterField}>
							<span className={styles.filterLabel}>Создано по</span>
							<input
								className={styles.filterInput}
								type="date"
								value={filterDraft.createdTo}
								onChange={event =>
									setFilterDraft(prev => ({
										...prev,
										createdTo: event.target.value
									}))
								}
							/>
						</label>
					</div>
					<div className={styles.filterActions}>
						<button type="submit" className={styles.filterApply}>
							Применить
						</button>
						<button
							type="button"
							className={styles.filterReset}
							onClick={resetFilters}
						>
							Сбросить
						</button>
					</div>
				</form>

				{isLoading ? (
					<div className={styles.skeletonList}>
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
					</div>
				) : totalItems === 0 ? (
					<p className={styles.empty}>Задач пока нет</p>
				) : (
					<>
						{activePending.length > 0 && (
							<NoteList
								notes={activePending}
								onToggle={handleToggle}
								onDelete={setDeleteTarget}
							/>
						)}
						{activeDone.length > 0 && (
							<>
								<p className={styles.doneLabel}>Выполнено ({doneTotal})</p>
								<NoteList
									notes={activeDone}
									onToggle={handleToggle}
									onDelete={setDeleteTarget}
								/>
							</>
						)}
						{totalItems > itemQuantity && (
							<Pagination
								listPage={listPage}
								currentPage={currentPage}
								prevPage={prevPage}
								nextPage={nextPage}
								changeActivePage={changeActivePage}
							/>
						)}
					</>
				)}
			</div>
		</section>
	)
}

function NoteList({
	notes,
	onToggle,
	onDelete
}: {
	notes: Note[]
	onToggle: (n: Note) => void
	onDelete: (n: Note) => void
}) {
	return (
		<ul className={styles.list}>
			{notes.map(note => (
				<li
					key={note.id}
					className={`${styles.item} ${note.done ? styles.itemDone : ''}`}
				>
					<button
						className={`${styles.checkbox} ${note.done ? styles.checkboxChecked : ''}`}
						onClick={() => onToggle(note)}
						aria-label={
							note.done ? 'Отметить невыполненной' : 'Отметить выполненной'
						}
					>
						{note.done && (
							<svg width="12" height="10" viewBox="0 0 12 10" fill="none">
								<path
									d="M1 5L4.5 8.5L11 1.5"
									stroke="white"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</button>
					<span className={styles.text}>{note.text}</span>
					<button
						className={styles.deleteBtn}
						onClick={() => onDelete(note)}
						aria-label="Удалить"
					>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<path
								d="M2 2L12 12M12 2L2 12"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</li>
			))}
		</ul>
	)
}

export default AdminNotes
