'use client'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import notesService, { Note } from '@/services/notes/notes.service'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { KeyboardEvent, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminNotes.module.scss'

const AdminNotes: NextPage = () => {
	const queryClient = useQueryClient()
	const [inputText, setInputText] = useState('')

	const { data: notes = [], isLoading } = useQuery({
		queryKey: ['notes'],
		queryFn: notesService.getAll
	})

	const createMutation = useMutation({
		mutationFn: (text: string) => notesService.create(text),
		onMutate: () => toast.loading('Добавляем задачу...'),
		onSuccess: (_, __, toastId) => {
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

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') handleAdd()
	}

	const pending = notes.filter(n => !n.done)
	const done = notes.filter(n => n.done)

	return (
		<div className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<SubHeading text="Заметки" />

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

				{isLoading ? (
					<div className={styles.skeletonList}>
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
					</div>
				) : notes.length === 0 ? (
					<p className={styles.empty}>Задач пока нет</p>
				) : (
					<>
						{pending.length > 0 && (
							<NoteList
								notes={pending}
								onToggle={handleToggle}
								onDelete={n => deleteMutation.mutate(n.id)}
							/>
						)}
						{done.length > 0 && (
							<>
								<p className={styles.doneLabel}>
									Выполнено ({done.length})
								</p>
								<NoteList
									notes={done}
									onToggle={handleToggle}
									onDelete={n => deleteMutation.mutate(n.id)}
								/>
							</>
						)}
					</>
				)}
			</div>
		</div>
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
