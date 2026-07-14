import {
	subscriptionService,
	AdminBonusAudience,
	IAdminActivateInput,
	IAdminExtendDaysInput,
	IAdminSubscriptionFilters,
	IAdminSubscriptionHistoryFilters
} from '@/entities/subscription'
import type { BillingPeriod, Plan } from '@/entities/subscription'
import { userService } from '@/entities/user'
import { useDebounce } from '@/shared/lib/hooks/useDebounce'
import { useAuthStore } from '@/entities/user'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import axios from 'axios'
import { ChangeEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().slice(0, 10)

interface BonusConfirmState {
	audience: AdminBonusAudience
	days: number
	userId?: string
}

interface UseAdminSubscriptionsParams {
	subscriptionPage: number
	subscriptionLimit: number
	historyPage: number
	historyLimit: number
	subscriptionFilters?: IAdminSubscriptionFilters
	historyFilters?: IAdminSubscriptionHistoryFilters
	onSubscriptionSuccess?: () => void
	onBonusSuccess?: () => void
}

const useAdminSubscriptions = ({
	subscriptionPage,
	subscriptionLimit,
	historyPage,
	historyLimit,
	subscriptionFilters,
	historyFilters,
	onSubscriptionSuccess,
	onBonusSuccess
}: UseAdminSubscriptionsParams) => {
	const queryClient = useQueryClient()

	const auth = useAuthStore(state => state.auth)

	const { data: subscriptions, isLoading } = useQuery({
		queryKey: [
			'admin-subscriptions',
			subscriptionPage,
			subscriptionLimit,
			subscriptionFilters
		],
		queryFn: () =>
			subscriptionService.adminGetAll(
				subscriptionPage,
				subscriptionLimit,
				subscriptionFilters
			),
		enabled: auth
	})

	const { data: subscriptionHistory, isLoading: isHistoryLoading } =
		useQuery({
			queryKey: [
				'admin-subscription-history',
				historyPage,
				historyLimit,
				historyFilters
			],
			queryFn: () =>
				subscriptionService.adminGetHistory(
					historyPage,
					historyLimit,
					historyFilters
				),
			enabled: auth
		})

	// ── User search for subscription actions ─────────────────────────
	const [userSearch, setUserSearch] = useState('')
	const [bonusUserSearch, setBonusUserSearch] = useState('')
	const debouncedSearch = useDebounce(userSearch, 400)
	const debouncedBonusSearch = useDebounce(bonusUserSearch, 400)

	const { data: userSearchResults, isFetching: isSearching } = useQuery({
		queryKey: ['user-search', debouncedSearch],
		queryFn: () => userService.fetchUserList(debouncedSearch, 1, 20),
		select: ({ data }) => data.items,
		enabled: debouncedSearch.length > 0
	})

	const { data: bonusUserSearchResults, isFetching: isBonusSearching } =
		useQuery({
			queryKey: [
				'user-search',
				'subscription-bonus',
				debouncedBonusSearch
			],
			queryFn: () =>
				userService.fetchUserList(debouncedBonusSearch, 1, 20),
			select: ({ data }) => data.items,
			enabled: debouncedBonusSearch.length > 0
		})

	useEffect(() => {
		if (!isSearching && !isBonusSearching) return
		const id = toast.loading('Поиск пользователя...')
		return () => toast.dismiss(id)
	}, [isBonusSearching, isSearching])

	useEffect(() => {
		if (userSearchResults && userSearchResults.length === 0) {
			toast('Пользователи не найдены', { icon: '🔍' })
		}
	}, [userSearchResults])

	useEffect(() => {
		if (bonusUserSearchResults && bonusUserSearchResults.length === 0) {
			toast('Пользователи не найдены', { icon: '🔍' })
		}
	}, [bonusUserSearchResults])

	// ── Activation form state ─────────────────────────────────────────
	const [selectedUserId, setSelectedUserId] = useState('')
	const [selectedUserName, setSelectedUserName] = useState('')
	const [bonusSelectedUserId, setBonusSelectedUserId] = useState('')
	const [bonusSelectedUserName, setBonusSelectedUserName] = useState('')
	const [plan, setPlan] = useState<Plan>('EASY')
	const [billingPeriod, setBillingPeriod] =
		useState<BillingPeriod>('MONTHLY')
	const [startsAt, setStartsAt] = useState(today())
	const [extendIfActive, setExtendIfActive] = useState(true)
	const [bonusAudience, setBonusAudience] =
		useState<AdminBonusAudience>('SINGLE')
	const [bonusDays, setBonusDays] = useState('')

	const selectUser = (id: string, label: string) => {
		setSelectedUserId(id)
		setSelectedUserName(label)
		setUserSearch('')
	}

	const selectBonusUser = (id: string, label: string) => {
		setBonusSelectedUserId(id)
		setBonusSelectedUserName(label)
		setBonusUserSearch('')
	}

	const resetActivationForm = () => {
		setSelectedUserId('')
		setSelectedUserName('')
		setUserSearch('')
		setPlan('EASY')
		setBillingPeriod('MONTHLY')
		setStartsAt(today())
		setExtendIfActive(true)
	}

	const resetBonusForm = () => {
		setBonusSelectedUserId('')
		setBonusSelectedUserName('')
		setBonusUserSearch('')
		setBonusAudience('SINGLE')
		setBonusDays('')
	}

	// ── Mutations ─────────────────────────────────────────────────────
	const { mutateAsync: activate, isPending: isActivating } = useMutation({
		mutationKey: ['admin-activate-subscription'],
		mutationFn: (body: IAdminActivateInput) =>
			subscriptionService.adminActivate(body),
		onSuccess() {
			toast.success('Подписка активирована')
			onSubscriptionSuccess?.()
			queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })
			resetActivationForm()
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(
					error.response?.data?.message ?? 'Ошибка активации подписки'
				)
			}
		}
	})

	const { mutateAsync: extendDays, isPending: isExtendingDays } =
		useMutation({
			mutationKey: ['admin-extend-subscription-days'],
			mutationFn: (body: IAdminExtendDaysInput) =>
				subscriptionService.adminExtendDays(body),
			onMutate() {
				return toast.loading(
					'Ожидайте, процесс начисления может занять время'
				)
			},
			onSuccess(result, _body, toastId) {
				toast.success(
					result.affectedUsersCount > 1
						? `Бонусные дни начислены: ${result.affectedUsersCount} пользователей`
						: 'Бонусные дни начислены',
					{ id: toastId }
				)
				onSubscriptionSuccess?.()
				onBonusSuccess?.()
				queryClient.invalidateQueries({
					queryKey: ['admin-subscriptions']
				})
				queryClient.invalidateQueries({
					queryKey: ['admin-subscription-history']
				})
				resetBonusForm()
			},
			onError(error, _body, toastId) {
				toast.error(
					axios.isAxiosError(error)
						? (error.response?.data?.message ??
								'Ошибка начисления бонусных дней')
						: 'Ошибка начисления бонусных дней',
					{ id: toastId }
				)
			}
		})

	const { mutateAsync: cancelMutation } = useMutation({
		mutationKey: ['admin-cancel-subscription'],
		mutationFn: (userId: string) =>
			subscriptionService.adminCancel(userId),
		onSuccess() {
			toast.success('Подписка отменена')
			onSubscriptionSuccess?.()
			queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(
					error.response?.data?.message ?? 'Ошибка отмены подписки'
				)
			}
		}
	})

	const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
	const [bonusConfirm, setBonusConfirm] =
		useState<BonusConfirmState | null>(null)

	const cancel = (userId: string) => setCancelTargetId(userId)

	const confirmCancel = () => {
		if (cancelTargetId) cancelMutation(cancelTargetId)
		setCancelTargetId(null)
	}

	const dismissCancel = () => setCancelTargetId(null)

	const dismissExtendDays = () => setBonusConfirm(null)

	const handleActivate = async () => {
		if (!selectedUserId) {
			toast.error('Выберите пользователя')
			return
		}
		const body: IAdminActivateInput = {
			userId: selectedUserId,
			plan,
			billingPeriod: plan === 'TRIAL' ? undefined : billingPeriod,
			startsAt,
			extendIfActive
		}
		await activate(body)
	}

	const handleExtendDays = async () => {
		if (bonusAudience === 'SINGLE' && !bonusSelectedUserId) {
			toast.error('Выберите пользователя')
			return
		}

		const days = Number(bonusDays)

		if (!Number.isInteger(days) || days < 1) {
			toast.error('Укажите количество дней')
			return
		}

		if (days > 3650) {
			toast.error('Максимум 3650 дней за одно начисление')
			return
		}

		setBonusConfirm({
			audience: bonusAudience,
			userId: bonusAudience === 'SINGLE' ? bonusSelectedUserId : undefined,
			days
		})
	}

	const confirmExtendDays = async () => {
		if (!bonusConfirm || isExtendingDays) return

		const body: IAdminExtendDaysInput = {
			userId: bonusConfirm.userId,
			audience: bonusConfirm.audience,
			days: bonusConfirm.days
		}

		setBonusConfirm(null)
		try {
			await extendDays(body)
		} catch {
			// Toast is shown by the mutation onError handler.
		}
	}

	return {
		subscriptions,
		subscriptionHistory,
		isLoading,
		isHistoryLoading,
		userSearch,
		setUserSearch: (e: ChangeEvent<HTMLInputElement>) =>
			setUserSearch(e.target.value),
		userSearchResults,
		selectedUserId,
		selectedUserName,
		selectUser,
		bonusUserSearch,
		setBonusUserSearch: (e: ChangeEvent<HTMLInputElement>) =>
			setBonusUserSearch(e.target.value),
		bonusUserSearchResults,
		bonusSelectedUserId,
		bonusSelectedUserName,
		selectBonusUser,
		bonusAudience,
		setBonusAudience,
		plan,
		setPlan,
		billingPeriod,
		setBillingPeriod,
		startsAt,
		setStartsAt,
		isActivating,
		handleActivate,
		bonusDays,
		setBonusDays,
		isExtendingDays,
		handleExtendDays,
		bonusConfirm,
		confirmExtendDays,
		dismissExtendDays,
		extendIfActive,
		setExtendIfActive,
		cancel,
		cancelTargetId,
		confirmCancel,
		dismissCancel
	}
}

export default useAdminSubscriptions
