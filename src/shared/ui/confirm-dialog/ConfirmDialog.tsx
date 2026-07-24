'use client'

import { FC, useEffect, useId, useRef } from 'react'
import styles from './ConfirmDialog.module.scss'

const FOCUSABLE_ELEMENTS_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',')
const activeDialogIds: symbol[] = []

interface IConfirmDialogProps {
	title: string
	message: string
	confirmLabel?: string
	cancelLabel?: string
	onConfirm: () => void
	onCancel: () => void
}

const ConfirmDialog: FC<IConfirmDialogProps> = ({
	title,
	message,
	confirmLabel = 'Подтвердить',
	cancelLabel = 'Отмена',
	onConfirm,
	onCancel
}) => {
	const titleId = useId()
	const messageId = useId()
	const dialogRef = useRef<HTMLDivElement>(null)
	const cancelButtonRef = useRef<HTMLButtonElement>(null)
	const onCancelRef = useRef(onCancel)
	const dialogIdRef = useRef(Symbol('confirm-dialog'))
	const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
	const hasCapturedFocusRef = useRef(false)

	useEffect(() => {
		onCancelRef.current = onCancel
	}, [onCancel])

	const handleBackdropClick = () => {
		if (
			activeDialogIds[activeDialogIds.length - 1] === dialogIdRef.current
		) {
			onCancel()
		}
	}

	useEffect(() => {
		const dialogId = dialogIdRef.current
		if (!hasCapturedFocusRef.current) {
			previouslyFocusedElementRef.current =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null
			hasCapturedFocusRef.current = true
		}
		const isTopmostDialog = () =>
			activeDialogIds[activeDialogIds.length - 1] === dialogId

		activeDialogIds.push(dialogId)
		cancelButtonRef.current?.focus()

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!isTopmostDialog()) return

			if (event.key === 'Escape') {
				event.preventDefault()
				event.stopPropagation()
				onCancelRef.current()
				return
			}

			if (event.key !== 'Tab') return

			const dialog = dialogRef.current
			if (!dialog) return

			const focusableElements = Array.from(
				dialog.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS_SELECTOR)
			).filter(element => element.tabIndex >= 0)

			if (!focusableElements.length) {
				event.preventDefault()
				dialog.focus()
				return
			}

			const firstElement = focusableElements[0]
			const lastElement = focusableElements[focusableElements.length - 1]
			const activeElement = document.activeElement

			if (
				event.shiftKey &&
				(activeElement === firstElement || !dialog.contains(activeElement))
			) {
				event.preventDefault()
				lastElement.focus()
				return
			}

			if (
				!event.shiftKey &&
				(activeElement === lastElement || !dialog.contains(activeElement))
			) {
				event.preventDefault()
				firstElement.focus()
			}
		}

		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			const wasTopmostDialog = isTopmostDialog()
			const dialogIndex = activeDialogIds.lastIndexOf(dialogId)
			if (dialogIndex !== -1) {
				activeDialogIds.splice(dialogIndex, 1)
			}
			if (
				wasTopmostDialog &&
				previouslyFocusedElementRef.current?.isConnected
			) {
				previouslyFocusedElementRef.current.focus()
			}
		}
	}, [])

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={handleBackdropClick}
				aria-label="Закрыть диалог"
				tabIndex={-1}
			/>
			<div
				ref={dialogRef}
				className={styles.dialog}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={messageId}
				tabIndex={-1}
			>
				<h3 id={titleId} className={styles.title}>
					{title}
				</h3>
				<p id={messageId} className={styles.message}>
					{message}
				</p>
				<div className={styles.actions}>
					<button
						ref={cancelButtonRef}
						type="button"
						className={styles.cancelBtn}
						onClick={onCancel}
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						className={styles.confirmBtn}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmDialog
