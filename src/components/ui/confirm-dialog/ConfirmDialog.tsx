'use client'

import { FC } from 'react'
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
	return (
		<div className={styles.overlay} onClick={onCancel}>
			<div className={styles.dialog} onClick={e => e.stopPropagation()}>
				<h3 className={styles.title}>{title}</h3>
				<p className={styles.message}>{message}</p>
				<div className={styles.actions}>
					<button className={styles.cancelBtn} onClick={onCancel}>
						{cancelLabel}
					</button>
					<button className={styles.confirmBtn} onClick={onConfirm}>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmDialog
