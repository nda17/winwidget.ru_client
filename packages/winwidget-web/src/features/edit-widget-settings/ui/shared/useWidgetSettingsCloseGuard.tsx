'use client'

import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface UseWidgetSettingsCloseGuardParams {
	hasUnsavedChanges: boolean
	isBusy?: boolean
	onClose: () => void
}

const useWidgetSettingsCloseGuard = ({
	hasUnsavedChanges,
	isBusy = false,
	onClose
}: UseWidgetSettingsCloseGuardParams) => {
	const [isConfirmOpen, setIsConfirmOpen] = useState(false)

	const requestClose = useCallback(() => {
		if (isBusy) return

		if (hasUnsavedChanges) {
			setIsConfirmOpen(true)
			return
		}

		onClose()
	}, [hasUnsavedChanges, isBusy, onClose])

	const discardChanges = useCallback(() => {
		setIsConfirmOpen(false)
		toast('Изменения не сохранены', { icon: '↩️' })
		onClose()
	}, [onClose])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || isConfirmOpen) return

			event.preventDefault()
			requestClose()
		}

		document.addEventListener('keydown', handleKeyDown)

		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isConfirmOpen, requestClose])

	const closeGuardDialog = isConfirmOpen ? (
		<ConfirmDialog
			title="Закрыть настройки?"
			message="Несохранённые изменения будут потеряны."
			confirmLabel="Закрыть без сохранения"
			cancelLabel="Продолжить редактирование"
			onConfirm={discardChanges}
			onCancel={() => setIsConfirmOpen(false)}
		/>
	) : null

	return { requestClose, closeGuardDialog }
}

export default useWidgetSettingsCloseGuard
