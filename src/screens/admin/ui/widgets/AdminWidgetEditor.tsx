import type { Plan, SubscriptionStatus } from '@/entities/subscription'
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

interface AdminWidgetEditorProps {
	details: AdminWidgetDetails
	ownerPlan: Plan | null
	subscriptionStatus: SubscriptionStatus | null
	onClose: () => void
	onSaved: (details: AdminWidgetDetails) => void
}

const AdminWidgetEditor = ({
	details,
	ownerPlan,
	subscriptionStatus,
	onClose,
	onSaved
}: AdminWidgetEditorProps) => {
	const canUseCustomButtonImage =
		ownerPlan === 'HARD' && subscriptionStatus === 'ACTIVE'

	switch (details.type) {
		case 'WHEEL':
			return (
				<WheelSettingsModal
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
