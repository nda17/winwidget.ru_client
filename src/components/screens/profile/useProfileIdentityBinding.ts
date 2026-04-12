import { errorCatch } from '@/api/api.helper'
import userService from '@/services/user/user.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'

export const useProfileIdentityBinding = () => {
	const queryClient = useQueryClient()
	const [emailCodeRequested, setEmailCodeRequested] = useState(false)
	const [phoneCodeRequested, setPhoneCodeRequested] = useState(false)

	const { mutateAsync: sendEmailCodeAsync, isPending: isSendingEmailCode } =
		useMutation({
			mutationKey: ['profile-send-email-code'],
			mutationFn: (email: string) => userService.sendProfileEmailCode({ email }),
			onSuccess() {
				setEmailCodeRequested(true)
				toast.success('Код подтверждения отправлен на email')
			},
			onError(error) {
				toast.error(`Привязка email: ${errorCatch(error)}`)
			}
		})

	const {
		mutateAsync: verifyEmailCodeAsync,
		isPending: isVerifyingEmailCode
	} = useMutation({
		mutationKey: ['profile-verify-email-code'],
		mutationFn: ({ email, code }: { email: string; code: string }) =>
			userService.verifyProfileEmailCode({ email, code }),
		onSuccess() {
			setEmailCodeRequested(false)
			toast.success('Email успешно привязан')
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		},
		onError(error) {
			toast.error(`Подтверждение email: ${errorCatch(error)}`)
		}
	})

	const { mutateAsync: sendPhoneCodeAsync, isPending: isSendingPhoneCode } =
		useMutation({
			mutationKey: ['profile-send-phone-code'],
			mutationFn: (phone: string) => userService.sendProfilePhoneCode({ phone }),
			onSuccess() {
				setPhoneCodeRequested(true)
				toast.success('Код подтверждения отправлен по SMS')
			},
			onError(error) {
				toast.error(`Привязка телефона: ${errorCatch(error)}`)
			}
		})

	const {
		mutateAsync: verifyPhoneCodeAsync,
		isPending: isVerifyingPhoneCode
	} = useMutation({
		mutationKey: ['profile-verify-phone-code'],
		mutationFn: ({ phone, code }: { phone: string; code: string }) =>
			userService.verifyProfilePhoneCode({ phone, code }),
		onSuccess() {
			setPhoneCodeRequested(false)
			toast.success('Телефон успешно привязан')
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		},
		onError(error) {
			toast.error(`Подтверждение телефона: ${errorCatch(error)}`)
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

	return {
		emailCodeRequested,
		phoneCodeRequested,
		isSendingEmailCode,
		isVerifyingEmailCode,
		isSendingPhoneCode,
		isVerifyingPhoneCode,
		requestEmailCode,
		confirmEmailCode,
		requestPhoneCode,
		confirmPhoneCode,
		resetEmailBinding() {
			setEmailCodeRequested(false)
		},
		resetPhoneBinding() {
			setPhoneCodeRequested(false)
		}
	}
}
