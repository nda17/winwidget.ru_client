import { axiosClassicRequest } from '@/api/interceptors'
import {
	removeFromStorage,
	saveTokenStorage
} from '@/services/auth/auth.helper'
import { IFormData } from '@/shared/types/form.types'
import { IUser } from '@/shared/types/user.types'

interface IAuthResponse {
	accessToken: string
	user: IUser
}

interface IEmail {
	email?: string
	phone?: string
}

interface IPhonePayload {
	phone: string
	password?: string
	code?: string
	referrerId?: string
}

interface IEmailCodePayload {
	email: string
	password?: string
	code?: string
	referrerId?: string
}

interface ITelegramAuthVerifyPayload {
	requestId: string
	code: string
}

interface ITelegramAuthCompletePayload {
	requestId: string
}

interface ITelegramAuthCancelPayload {
	requestId: string
}

export interface IEmailRegistrationResponse {
	email: string
	expiresAt: string
	resendAvailableAt: string
}

export interface ITelegramAuthStartResponse {
	requestId: string
	botUrl: string
	expiresAt: string
}

export type ITelegramAuthCompleteResponse =
	| {
			confirmed: false
	  }
	| {
			confirmed: true
			accessToken: string
			user: IUser
	  }

export enum EnumTokens {
	'ACCESS_TOKEN' = 'accessToken',
	'REFRESH_TOKEN' = 'refreshToken'
}

class AuthService {
	private refreshPromise: Promise<any> | null = null

	async main(type: 'login', data: IFormData, token?: string | null) {
		const response = await axiosClassicRequest.post<IAuthResponse>(
			`/auth/${type}`,
			data,
			{
				headers: {
					recaptcha: token
				}
			}
		)

		if (response.data.accessToken) {
			saveTokenStorage(response.data.accessToken)
		}

		return response
	}

	async getNewTokens() {
		if (this.refreshPromise) return this.refreshPromise

		this.refreshPromise = axiosClassicRequest
			.post<IAuthResponse>('/auth/access-token')
			.then(response => {
				if (response.data.accessToken) {
					saveTokenStorage(response.data.accessToken)
				}
				return response
			})
			.finally(() => {
				this.refreshPromise = null
			})

		return this.refreshPromise
	}

	async getNewTokensByRefresh(refreshToken: string) {
		const response = await axiosClassicRequest.post<IAuthResponse>(
			'/auth/access-token',
			{},
			{
				headers: {
					Cookie: `refreshToken=${refreshToken}`
				}
			}
		)

		return response.data
	}

	async getRestorePassword(data: IEmail, token?: string | null) {
		const response = await axiosClassicRequest.patch<IEmail>(
			'/auth/restore-password',
			{ email: data.email, phone: data.phone },
			{
				headers: {
					recaptcha: token
				}
			}
		)

		return response
	}

	async logout() {
		const response =
			await axiosClassicRequest.post<boolean>('/auth/logout')

		if (response.data) {
			removeFromStorage()
		}

		return response
	}

	async sendEmailCode(data: IEmailCodePayload, token?: string | null) {
		return axiosClassicRequest.post<IEmailRegistrationResponse>(
			'/auth/register',
			{
				email: data.email,
				password: data.password
			},
			{
				headers: {
					recaptcha: token
				}
			}
		)
	}

	async registerByEmail(data: IEmailCodePayload, token?: string | null) {
		const response = await axiosClassicRequest.post<IAuthResponse>(
			'/auth/email/register',
			{
				email: data.email,
				code: data.code,
				referrerId: data.referrerId
			},
			{
				headers: {
					recaptcha: token
				}
			}
		)

		if (response.data.accessToken) {
			saveTokenStorage(response.data.accessToken)
		}

		return response
	}

	async resendEmailCode(data: IEmailCodePayload, token?: string | null) {
		return axiosClassicRequest.post<IEmailRegistrationResponse>(
			'/auth/email/resend-code',
			{
				email: data.email
			},
			{
				headers: {
					recaptcha: token
				}
			}
		)
	}

	async sendPhoneCode(data: IPhonePayload, token?: string | null) {
		return axiosClassicRequest.post<boolean>(
			'/auth/phone/send-code',
			{ phone: data.phone },
			{
				headers: {
					recaptcha: token
				}
			}
		)
	}

	async registerByPhone(data: IPhonePayload, token?: string | null) {
		const response = await axiosClassicRequest.post<IAuthResponse>(
			'/auth/phone/register',
			{
				phone: data.phone,
				password: data.password,
				code: data.code,
				referrerId: data.referrerId
			},
			{
				headers: {
					recaptcha: token
				}
			}
		)

		if (response.data.accessToken) {
			saveTokenStorage(response.data.accessToken)
		}

		return response
	}

	async loginByPhone(data: IPhonePayload, token?: string | null) {
		const response = await axiosClassicRequest.post<IAuthResponse>(
			'/auth/phone/login',
			{
				phone: data.phone,
				password: data.password
			},
			{
				headers: {
					recaptcha: token
				}
			}
		)

		if (response.data.accessToken) {
			saveTokenStorage(response.data.accessToken)
		}

		return response
	}

	async startTelegramAuth(token?: string | null) {
		return axiosClassicRequest.post<ITelegramAuthStartResponse>(
			'/auth/telegram/start',
			{},
			{
				headers: {
					recaptcha: token
				}
			}
		)
	}

	async verifyTelegramAuth(
		data: ITelegramAuthVerifyPayload,
		token?: string | null
	) {
		const response = await axiosClassicRequest.post<IAuthResponse>(
			'/auth/telegram/verify',
			{
				requestId: data.requestId,
				code: data.code
			},
			{
				headers: {
					recaptcha: token
				}
			}
		)

		if (response.data.accessToken) {
			saveTokenStorage(response.data.accessToken)
		}

		return response
	}

	async completeTelegramAuth(data: ITelegramAuthCompletePayload) {
		const response =
			await axiosClassicRequest.post<ITelegramAuthCompleteResponse>(
				'/auth/telegram/complete',
				{
					requestId: data.requestId
				}
			)

		if (response.data.confirmed && response.data.accessToken) {
			saveTokenStorage(response.data.accessToken)
		}

		return response
	}

	async cancelTelegramAuth(data: ITelegramAuthCancelPayload) {
		return axiosClassicRequest.post('/auth/telegram/cancel', {
			requestId: data.requestId
		})
	}
}

const authService = new AuthService()

export default authService
