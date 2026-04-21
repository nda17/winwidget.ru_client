'use client'

import { FC, useId } from 'react'
import styles from './ConfirmDialog.module.scss'

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

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onCancel}
				aria-label="Закрыть диалог"
			/>
			<div
				className={styles.dialog}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={messageId}
			>
				<h3 id={titleId} className={styles.title}>
					{title}
				</h3>
				<p id={messageId} className={styles.message}>
					{message}
				</p>
				<div className={styles.actions}>
					<button
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
