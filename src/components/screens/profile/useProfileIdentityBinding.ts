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
		onMutate: () => toast.loading('Готовим привязку Telegram...'),
		onSuccess(_, __, toastId) {
			setTelegramBindingRequested(true)
			toast.success('Откройте Auth_bot и подтвердите привязку', {
				id: toastId
			})
		},
		onError(error, _, toastId) {
			toast.error(`Привязка Telegram: ${errorCatch(error)}`, {
				id: toastId
			})
		}
	})

	const {
		mutateAsync: startTelegramNotificationsAsync,
		isPending: isStartingTelegramNotifications
	} = useMutation({
		mutationKey: ['profile-start-telegram-notifications'],
		mutationFn: () => userService.startProfileTelegramNotifications(),
		onMutate: () =>
			toast.loading('Готовим подключение Telegram-уведомлений...'),
		onSuccess(_, __, toastId) {
			setTelegramNotificationsBindingRequested(true)
			toast.success('Откройте Info_bot и нажмите Start', {
				id: toastId
			})
		},
		onError(error, _, toastId) {
			toast.error(`Telegram-уведомления: ${errorCatch(error)}`, {
				id: toastId
			})
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
		isStartingTelegramNotifications,
		requestEmailCode,
		confirmEmailCode,
		requestPhoneCode,
		confirmPhoneCode,
		requestTelegramBinding,
		requestTelegramNotificationsBinding,
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
