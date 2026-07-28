import type { Plan, SubscriptionStatus } from '@/entities/subscription'
import type { WidgetLifecycleState } from '@/entities/site-widget'
import {
	CalculatorSettingsModal,
	CallbackSettingsModal,
	CountdownTimerSettingsModal,
	OnlineConsultantSettingsModal,
	QuizSettingsModal,
	StopOfferSettingsModal,
	WheelSettingsModal
} from '@/features/edit-widget-settings'
import {
	adminWidgetsService,
	type AdminWidgetDetails
} from '@/features/manage-widgets'
import { errorCatch } from '@/shared/api'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminWidgets.module.scss'

interface AdminWidgetEditorProps {
	details: AdminWidgetDetails
	ownerPlan: Plan | null
	subscriptionStatus: SubscriptionStatus | null
	onClose: () => void
	onSaved: (details: AdminWidgetDetails) => void
	onRefresh: () => Promise<AdminWidgetDetails | null>
}

const AdminWidgetEditor = ({
	details,
	ownerPlan,
	subscriptionStatus,
	onClose,
	onSaved,
	onRefresh
}: AdminWidgetEditorProps) => {
	const [hasLocalChanges, setHasLocalChanges] = useState(false)
	const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false)
	const [editorResetKey, setEditorResetKey] = useState(0)
	const canUseCustomButtonImage =
		ownerPlan === 'HARD' && subscriptionStatus === 'ACTIVE'
	const hasDraftChanges =
		details.entity.draftRevision !==
		details.entity.publishedFromDraftRevision

	const applyLifecycle = (lifecycle: WidgetLifecycleState<unknown>) => {
		onSaved({
			...details,
			entity: {
				...details.entity,
				name: lifecycle.name,
				publicKey: lifecycle.publicKey,
				isActive: lifecycle.isActive,
				installDomain: lifecycle.installDomain,
				config: lifecycle.config,
				draftRevision: lifecycle.draftRevision,
				publishedVersion: lifecycle.publishedVersion,
				publishedFromDraftRevision: lifecycle.publishedFromDraftRevision,
				publishedAt: lifecycle.publishedAt,
				createdAt: lifecycle.createdAt,
				updatedAt: lifecycle.updatedAt
			}
		} as AdminWidgetDetails)
	}

	const handleRevisionConflict = async () => {
		const refreshed = await onRefresh()

		return refreshed?.entity.draftRevision ?? null
	}

	const publishMutation = useMutation({
		mutationFn: () =>
			adminWidgetsService.publish(
				details.type,
				details.entity.id,
				details.entity.draftRevision
			),
		onMutate: () => toast.loading('Публикуем изменения виджета…'),
		onSuccess: (lifecycle, _, toastId) => {
			applyLifecycle(lifecycle)
			toast.success('Изменения опубликованы', { id: toastId })
		},
		onError: (error, _, toastId) => {
			if ((error as any)?.response?.status === 409) {
				void handleRevisionConflict()
			}
			toast.error(
				errorCatch(error) || 'Не удалось опубликовать изменения',
				{ id: toastId }
			)
		}
	})

	const discardMutation = useMutation({
		mutationFn: () =>
			adminWidgetsService.discardDraft(
				details.type,
				details.entity.id,
				details.entity.draftRevision
			),
		onMutate: () => toast.loading('Отменяем изменения черновика…'),
		onSuccess: (lifecycle, _, toastId) => {
			applyLifecycle(lifecycle)
			setEditorResetKey(current => current + 1)
			setIsConfirmingDiscard(false)
			toast.success('Черновик возвращён к опубликованной версии', {
				id: toastId
			})
		},
		onError: (error, _, toastId) => {
			if ((error as any)?.response?.status === 409) {
				void handleRevisionConflict()
			}
			toast.error(errorCatch(error) || 'Не удалось отменить изменения', {
				id: toastId
			})
		}
	})

	const lifecycleActions = (
		<div className={styles.editorLifecycle}>
			<div className={styles.editorLifecycleStatus}>
				<strong>
					{details.entity.publishedVersion > 0
						? `Опубликована версия ${details.entity.publishedVersion}`
						: 'Виджет ещё не опубликован'}
				</strong>
				<span>
					{hasLocalChanges
						? 'Сначала сохраните изменения формы в черновик.'
						: hasDraftChanges
							? 'Есть изменения, которые ещё не видят посетители.'
							: 'Опубликованная версия соответствует черновику.'}
				</span>
			</div>
			<div className={styles.editorLifecycleActions}>
				<button
					type="button"
					className={styles.actionButtonPrimary}
					onClick={() => publishMutation.mutate()}
					disabled={
						hasLocalChanges ||
						!hasDraftChanges ||
						publishMutation.isPending ||
						discardMutation.isPending
					}
				>
					{publishMutation.isPending ? 'Публикуем…' : 'Опубликовать'}
				</button>
				{hasDraftChanges && details.entity.publishedVersion > 0 && (
					<>
						{isConfirmingDiscard ? (
							<>
								<button
									type="button"
									className={styles.actionButtonDanger}
									onClick={() => discardMutation.mutate()}
									disabled={
										hasLocalChanges ||
										publishMutation.isPending ||
										discardMutation.isPending
									}
								>
									{discardMutation.isPending
										? 'Отменяем…'
										: 'Подтвердить отмену'}
								</button>
								<button
									type="button"
									className={styles.actionButton}
									onClick={() => setIsConfirmingDiscard(false)}
									disabled={discardMutation.isPending}
								>
									Не отменять
								</button>
							</>
						) : (
							<button
								type="button"
								className={styles.actionButton}
								onClick={() => setIsConfirmingDiscard(true)}
								disabled={
									hasLocalChanges ||
									publishMutation.isPending ||
									discardMutation.isPending
								}
							>
								Отменить черновик
							</button>
						)}
					</>
				)}
			</div>
		</div>
	)

	const presentationProps = {
		onDirtyChange: setHasLocalChanges,
		onRevisionConflict: handleRevisionConflict,
		lifecycleActions
	}

	switch (details.type) {
		case 'WHEEL':
			return (
				<WheelSettingsModal
					key={editorResetKey}
					{...presentationProps}
					widget={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('WHEEL', details.entity.id, payload)
								.then(response => response.entity),
						uploadButtonImage: file =>
							adminWidgetsService
								.uploadButtonImage('WHEEL', details.entity.id, file)
								.then(response => response.entity)
					}}
				/>
			)
		case 'QUIZ':
			return (
				<QuizSettingsModal
					key={editorResetKey}
					{...presentationProps}
					quiz={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('QUIZ', details.entity.id, payload)
								.then(response => response.entity),
						uploadButtonImage: file =>
							adminWidgetsService
								.uploadButtonImage('QUIZ', details.entity.id, file)
								.then(response => response.entity)
					}}
				/>
			)
		case 'CALLBACK':
			return (
				<CallbackSettingsModal
					key={editorResetKey}
					{...presentationProps}
					callback={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('CALLBACK', details.entity.id, payload)
								.then(response => response.entity),
						uploadButtonImage: file =>
							adminWidgetsService
								.uploadButtonImage('CALLBACK', details.entity.id, file)
								.then(response => response.entity)
					}}
				/>
			)
		case 'TIMER':
			return (
				<CountdownTimerSettingsModal
					key={editorResetKey}
					{...presentationProps}
					timer={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('TIMER', details.entity.id, payload)
								.then(response => response.entity),
						uploadButtonImage: file =>
							adminWidgetsService
								.uploadButtonImage('TIMER', details.entity.id, file)
								.then(response => response.entity)
					}}
				/>
			)
		case 'STOP_OFFER':
			return (
				<StopOfferSettingsModal
					key={editorResetKey}
					{...presentationProps}
					stopOffer={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('STOP_OFFER', details.entity.id, payload)
								.then(response => response.entity)
					}}
				/>
			)
		case 'ONLINE_CONSULTANT':
			return (
				<OnlineConsultantSettingsModal
					key={editorResetKey}
					{...presentationProps}
					onlineConsultant={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('ONLINE_CONSULTANT', details.entity.id, payload)
								.then(response => response.entity),
						uploadButtonImage: file =>
							adminWidgetsService
								.uploadButtonImage(
									'ONLINE_CONSULTANT',
									details.entity.id,
									file
								)
								.then(response => response.entity)
					}}
				/>
			)
		case 'CALCULATOR':
			return (
				<CalculatorSettingsModal
					key={editorResetKey}
					{...presentationProps}
					calculator={details.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={entity => onSaved({ ...details, entity })}
					persistence={{
						update: payload =>
							adminWidgetsService
								.update('CALCULATOR', details.entity.id, payload)
								.then(response => response.entity),
						uploadButtonImage: file =>
							adminWidgetsService
								.uploadButtonImage('CALCULATOR', details.entity.id, file)
								.then(response => response.entity)
					}}
				/>
			)
	}
}

export default AdminWidgetEditor
