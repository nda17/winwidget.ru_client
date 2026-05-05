import subscriptionService, {
	IAdminActivateInput,
	IAdminExtendDaysInput
} from '@/services/subscription/subscription.service'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'
import userService from '@/services/user/user.service'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/auth-store/auth-store'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import axios from 'axios'
import { ChangeEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().slice(0, 10)

interface UseAdminSubscriptionsParams {
	subscriptionPage: number
	subscriptionLimit: number
	historyPage: number
	historyLimit: number
	onSubscriptionSuccess?: () => void
	onBonusSuccess?: () => void
}

const useAdminSubscriptions = ({
	subscriptionPage,
	subscriptionLimit,
	historyPage,
	historyLimit,
	onSubscriptionSuccess,
	onBonusSuccess
}: UseAdminSubscriptionsParams) => {
	const queryClient = useQueryClient()

	const auth = useAuthStore(state => state.auth)

	const { data: subscriptions, isLoading } = useQuery({
		queryKey: ['admin-subscriptions', subscriptionPage, subscriptionLimit],
		queryFn: () =>
			subscriptionService.adminGetAll(subscriptionPage, subscriptionLimit),
		enabled: auth
	})

	const { data: subscriptionHistory, isLoading: isHistoryLoading } =
		useQuery({
			queryKey: ['admin-subscription-history', historyPage, historyLimit],
			queryFn: () =>
				subscriptionService.adminGetHistory(historyPage, historyLimit),
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
			onSuccess() {
				toast.success('Бонусные дни начислены')
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
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(
						error.response?.data?.message ??
							'Ошибка начисления бонусных дней'
					)
				}
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

	const cancel = (userId: string) => setCancelTargetId(userId)

	const confirmCancel = () => {
		if (cancelTargetId) cancelMutation(cancelTargetId)
		setCancelTargetId(null)
	}

	const dismissCancel = () => setCancelTargetId(null)

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
		if (!bonusSelectedUserId) {
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

		const body: IAdminExtendDaysInput = {
			userId: bonusSelectedUserId,
			days
		}
		await extendDays(body)
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
		extendIfActive,
		setExtendIfActive,
		cancel,
		cancelTargetId,
		confirmCancel,
		dismissCancel
	}
}

export default useAdminSubscriptions
