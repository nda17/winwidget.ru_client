import { errorCatch } from '@/api/api.helper'
import userService from '@/services/user/user.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'

export const useProfileIdentityBinding = () => {
	const queryClient = useQueryClient()
	const [emailCodeRequested, setEmailCodeRequested] = useState(false)
	const [phoneCodeRequested, setPhoneCodeRequested] = useState(false)
	const [telegramBindingRequested, setTelegramBindingRequested] =
		useState(false)
	const [
		telegramNotificationsBindingRequested,
		setTelegramNotificationsBindingRequested
	] = useState(false)

	const {
		mutateAsync: sendEmailCodeAsync,
		isPending: isSendingEmailCode
	} = useMutation({
		mutationKey: ['profile-send-email-code'],
		mutationFn: (email: string) =>
			userService.sendProfileEmailCode({ email }),
		onMutate: () => toast.loading('Отправляем код на email...'),
		onSuccess(_, __, toastId) {
			setEmailCodeRequested(true)
			toast.success('Код подтверждения отправлен на email', {
				id: toastId
			})
		},
		onError(error, _, toastId) {
			toast.error(`Привязка email: ${errorCatch(error)}`, { id: toastId })
		}
	})

	const {
		mutateAsync: verifyEmailCodeAsync,
		isPending: isVerifyingEmailCode
	} = useMutation({
		mutationKey: ['profile-verify-email-code'],
		mutationFn: ({ email, code }: { email: string; code: string }) =>
			userService.verifyProfileEmailCode({ email, code }),
		onMutate: () =>
			toast.loading('Проверяем код, пожалуйста подождите...'),
		onSuccess(_, __, toastId) {
			setEmailCodeRequested(false)
			toast.success('Email успешно привязан', { id: toastId })
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		},
		onError(error, _, toastId) {
			toast.error(`Подтверждение email: ${errorCatch(error)}`, {
				id: toastId
			})
		}
	})

	const {
		mutateAsync: sendPhoneCodeAsync,
		isPending: isSendingPhoneCode
	} = useMutation({
		mutationKey: ['profile-send-phone-code'],
		mutationFn: (phone: string) =>
			userService.sendProfilePhoneCode({ phone }),
		onMutate: () => toast.loading('Отправляем SMS с кодом...'),
		onSuccess(_, __, toastId) {
			setPhoneCodeRequested(true)
			toast.success('Код подтверждения отправлен по SMS', { id: toastId })
		},
		onError(error, _, toastId) {
			toast.error(`Привязка телефона: ${errorCatch(error)}`, {
				id: toastId
			})
		}
	})

	const {
		mutateAsync: verifyPhoneCodeAsync,
		isPending: isVerifyingPhoneCode
	} = useMutation({
		mutationKey: ['profile-verify-phone-code'],
		mutationFn: ({ phone, code }: { phone: string; code: string }) =>
			userService.verifyProfilePhoneCode({ phone, code }),
		onMutate: () =>
			toast.loading('Проверяем код, пожалуйста подождите...'),
		onSuccess(_, __, toastId) {
			setPhoneCodeRequested(false)
			toast.success('Телефон успешно привязан', { id: toastId })
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		},
		onError(error, _, toastId) {
			toast.error(`Подтверждение телефона: ${errorCatch(error)}`, {
				id: toastId
			})
		}
	})

	const {
		mutateAsync: startTelegramBindingAsync,
		isPending: isStartingTelegramBinding
	} = useMutation({
		mutationKey: ['profile-start-telegram-binding'],
		mutationFn: () => userService.startProfileTelegramBinding(),
		onSuccess() {
			setTelegramBindingRequested(true)
		},
		onError(error) {
			toast.error(`Привязка Telegram: ${errorCatch(error)}`)
		}
	})

	const {
		mutateAsync: unlinkTelegramBindingAsync,
		isPending: isUnlinkingTelegramBinding
	} = useMutation({
		mutationKey: ['profile-unlink-telegram-binding'],
		mutationFn: () => userService.unlinkProfileTelegramBinding(),
		onMutate: () => toast.loading('Отвязываем Telegram...'),
		onSuccess(_, __, toastId) {
			setTelegramBindingRequested(false)
			toast.success('Telegram отвязан как способ входа', {
				id: toastId
			})
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		},
		onError(error, _, toastId) {
			toast.error(`Отвязка Telegram: ${errorCatch(error)}`, {
				id: toastId
			})
		}
	})

	const {
		mutateAsync: cancelTelegramBindingAsync,
		isPending: isCancellingTelegramBinding
	} = useMutation({
		mutationKey: ['profile-cancel-telegram-binding'],
		mutationFn: () => userService.cancelProfileTelegramBinding(),
		onSuccess() {
			setTelegramBindingRequested(false)
		},
		onError(error) {
			toast.error(`Отмена Telegram: ${errorCatch(error)}`)
		}
	})

	const {
		mutateAsync: startTelegramNotificationsAsync,
		isPending: isStartingTelegramNotifications
	} = useMutation({
		mutationKey: ['profile-start-telegram-notifications'],
		mutationFn: () => userService.startProfileTelegramNotifications(),
		onSuccess() {
			setTelegramNotificationsBindingRequested(true)
		},
		onError(error) {
			toast.error(`Telegram-уведомления: ${errorCatch(error)}`)
		}
	})

	const {
		mutateAsync: cancelTelegramNotificationsAsync,
		isPending: isCancellingTelegramNotifications
	} = useMutation({
		mutationKey: ['profile-cancel-telegram-notifications'],
		mutationFn: () => userService.cancelProfileTelegramNotifications(),
		onSuccess() {
			setTelegramNotificationsBindingRequested(false)
		},
		onError(error) {
			toast.error(`Отмена Telegram-уведомлений: ${errorCatch(error)}`)
		}
	})

	const requestEmailCode = async (email: string) => {
		try {
			await sendEmailCodeAsync(email)
			return true
		} catch {
			return false
		}
	}

	const confirmEmailCode = async (payload: {
		email: string
		code: string
	}) => {
		try {
			await verifyEmailCodeAsync(payload)
			return true
		} catch {
			return false
		}
	}

	const requestPhoneCode = async (phone: string) => {
		try {
			await sendPhoneCodeAsync(phone)
			return true
		} catch {
			return false
		}
	}

	const confirmPhoneCode = async (payload: {
		phone: string
		code: string
	}) => {
		try {
			await verifyPhoneCodeAsync(payload)
			return true
		} catch {
			return false
		}
	}

	const requestTelegramBinding = async () => {
		try {
			return await startTelegramBindingAsync()
		} catch {
			return null
		}
	}

	const requestTelegramNotificationsBinding = async () => {
		try {
			return await startTelegramNotificationsAsync()
		} catch {
			return null
		}
	}

	const unlinkTelegramBinding = async () => {
		try {
			await unlinkTelegramBindingAsync()
			return true
		} catch {
			return false
		}
	}

	const cancelTelegramBinding = async () => {
		try {
			await cancelTelegramBindingAsync()
			return true
		} catch {
			return false
		}
	}

	const cancelTelegramNotificationsBinding = async () => {
		try {
			await cancelTelegramNotificationsAsync()
			return true
		} catch {
			return false
		}
	}

	return {
		emailCodeRequested,
		phoneCodeRequested,
		telegramBindingRequested,
		telegramNotificationsBindingRequested,
		isSendingEmailCode,
		isVerifyingEmailCode,
		isSendingPhoneCode,
		isVerifyingPhoneCode,
		isStartingTelegramBinding,
		isUnlinkingTelegramBinding,
		isCancellingTelegramBinding,
		isStartingTelegramNotifications,
		isCancellingTelegramNotifications,
		requestEmailCode,
		confirmEmailCode,
		requestPhoneCode,
		confirmPhoneCode,
		requestTelegramBinding,
		requestTelegramNotificationsBinding,
		unlinkTelegramBinding,
		cancelTelegramBinding,
		cancelTelegramNotificationsBinding,
		resetEmailBinding() {
			setEmailCodeRequested(false)
		},
		resetPhoneBinding() {
			setPhoneCodeRequested(false)
		},
		resetTelegramBinding() {
			setTelegramBindingRequested(false)
		},
		resetTelegramNotificationsBinding() {
			setTelegramNotificationsBindingRequested(false)
		}
	}
}
