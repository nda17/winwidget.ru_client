import subscriptionService, {
	IAdminActivateInput
} from '@/services/subscription/subscription.service'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'
import userService from '@/services/user/user.service'
import { useDebounce } from '@/hooks/useDebounce'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import axios from 'axios'
import { ChangeEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().slice(0, 10)

const useAdminSubscriptions = () => {
	const queryClient = useQueryClient()

	const { data: subscriptions, isLoading } = useQuery({
		queryKey: ['admin-subscriptions'],
		queryFn: () => subscriptionService.adminGetAll()
	})

	// ── User search for activation form ──────────────────────────────
	const [userSearch, setUserSearch] = useState('')
	const debouncedSearch = useDebounce(userSearch, 400)

	const { data: userSearchResults, isFetching: isSearching } = useQuery({
		queryKey: ['user-search', debouncedSearch],
		queryFn: () => userService.fetchUserList(debouncedSearch),
		select: ({ data }) => data,
		enabled: debouncedSearch.length > 0
	})

	useEffect(() => {
		if (!isSearching) return
		const id = toast.loading('Поиск пользователя...')
		return () => toast.dismiss(id)
	}, [isSearching])

	useEffect(() => {
		if (userSearchResults && userSearchResults.length === 0) {
			toast('Пользователи не найдены', { icon: '🔍' })
		}
	}, [userSearchResults])

	// ── Activation form state ─────────────────────────────────────────
	const [selectedUserId, setSelectedUserId] = useState('')
	const [selectedUserName, setSelectedUserName] = useState('')
	const [plan, setPlan] = useState<Plan>('EASY')
	const [billingPeriod, setBillingPeriod] =
		useState<BillingPeriod>('MONTHLY')
	const [startsAt, setStartsAt] = useState(today())
	const [extendIfActive, setExtendIfActive] = useState(true)

	const selectUser = (id: string, label: string) => {
		setSelectedUserId(id)
		setSelectedUserName(label)
		setUserSearch('')
	}

	const resetForm = () => {
		setSelectedUserId('')
		setSelectedUserName('')
		setUserSearch('')
		setPlan('EASY')
		setBillingPeriod('MONTHLY')
		setStartsAt(today())
		setExtendIfActive(true)
	}

	// ── Mutations ─────────────────────────────────────────────────────
	const { mutateAsync: activate, isPending: isActivating } = useMutation({
		mutationKey: ['admin-activate-subscription'],
		mutationFn: (body: IAdminActivateInput) =>
			subscriptionService.adminActivate(body),
		onSuccess() {
			toast.success('Подписка активирована')
			queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })
			resetForm()
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(
					error.response?.data?.message ?? 'Ошибка активации подписки'
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

	return {
		subscriptions,
		isLoading,
		userSearch,
		setUserSearch: (e: ChangeEvent<HTMLInputElement>) =>
			setUserSearch(e.target.value),
		userSearchResults,
		selectedUserId,
		selectedUserName,
		selectUser,
		plan,
		setPlan,
		billingPeriod,
		setBillingPeriod,
		startsAt,
		setStartsAt,
		isActivating,
		handleActivate,
		extendIfActive,
		setExtendIfActive,
		cancel,
		cancelTargetId,
		confirmCancel,
		dismissCancel
	}
}

export default useAdminSubscriptions
