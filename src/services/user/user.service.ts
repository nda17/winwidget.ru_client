import { axiosInterceptorsRequest } from '@/api/interceptors'
import { IUserEditInput } from '@/components/screens/admin/user/edit/user-edit.interface'
import { IUser } from '@/shared/types/user.types'
import {
	BillingPeriod,
	Plan,
	Subscription
} from '@/services/widget/widget.types'

export interface IProfileEditInput {
	name?: string
	avatarPath?: string
	password?: string
}

export interface IProfileIdentityCodeInput {
	email?: string
	phone?: string
	code?: string
}

export interface IProfileTelegramBindingResponse {
	requestId: string
	botUrl: string
	expiresAt: string
}

export interface IUserListResponse {
	items: IUser[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export type AdminUserSubscriptionFilter = 'HAS' | 'NONE'

export interface IAdminUserListFilters {
	role?: 'USER' | 'ADMIN'
	registeredFrom?: string
	registeredTo?: string
	subscription?: AdminUserSubscriptionFilter
}

export type AdminUserOverviewPaymentStatus =
	| 'PENDING'
	| 'SUCCEEDED'
	| 'CANCELLED'

export type AdminUserOverviewWidgetType =
	| 'WHEEL'
	| 'QUIZ'
	| 'CALLBACK'
	| 'COUNTDOWN_TIMER'

export type AdminUserOverviewActivityRole = 'TARGET' | 'ADMIN'

export interface IAdminUserOverviewPayment {
	id: string
	yookassaId: string
	status: AdminUserOverviewPaymentStatus
	amount: string
	plan: Plan | null
	billingPeriod: BillingPeriod | null
	createdAt: string
	updatedAt: string
}

export interface IAdminUserOverviewCount {
	type: AdminUserOverviewWidgetType
	label: string
	count: number
}

export interface IAdminUserOverviewWidgetCount extends IAdminUserOverviewCount {
	active: number
	inactive: number
}

export interface IAdminUserOverviewWidget {
	id: string
	type: AdminUserOverviewWidgetType
	label: string
	name: string
	isActive: boolean
	installDomain: string
	leadsCount: number
	updatedAt: string
}

export interface IAdminUserOverviewLead {
	id: string
	type: AdminUserOverviewWidgetType
	label: string
	sourceName: string
	contact: string | null
	phone: string | null
	email: string | null
	url: string | null
	detail: string | null
	createdAt: string
}

export interface IAdminUserOverviewActivity {
	id: string
	section: string
	action: string
	description: string
	entityType: string | null
	entityLabel: string | null
	adminName: string | null
	adminEmail: string | null
	targetUserId: string | null
	createdAt: string
	role: AdminUserOverviewActivityRole
}

export interface IAdminUserOverview {
	subscription: Subscription | null
	payments: {
		total: number
		counts: Record<AdminUserOverviewPaymentStatus, number>
		latest: IAdminUserOverviewPayment[]
	}
	widgets: {
		total: number
		active: number
		inactive: number
		byType: IAdminUserOverviewWidgetCount[]
		latest: IAdminUserOverviewWidget[]
	}
	leads: {
		total: number
		byType: IAdminUserOverviewCount[]
		latest: IAdminUserOverviewLead[]
	}
	activity: {
		latest: IAdminUserOverviewActivity[]
	}
}

class UserService {
	private _BASE_URL = '/users'

	async fetchProfile() {
		return axiosInterceptorsRequest.get<IUser>(`${this._BASE_URL}/profile`)
	}

	async fetchUserList(
		searchTerm?: string,
		page = 1,
		limit = 20,
		filters?: IAdminUserListFilters
	) {
		return axiosInterceptorsRequest.get<IUserListResponse>(
			`${this._BASE_URL}/user-list`,
			{
				params: {
					searchTerm: searchTerm || undefined,
					page,
					limit,
					...filters
				}
			}
		)
	}

	async fetchUserById(id: string) {
		return axiosInterceptorsRequest.get<IUser>(
			`${this._BASE_URL}/edit/${id}`
		)
	}

	async fetchUserOverview(id: string) {
		return axiosInterceptorsRequest.get<IAdminUserOverview>(
			`${this._BASE_URL}/edit/${id}/overview`
		)
	}

	async deleteUser(id: string) {
		return axiosInterceptorsRequest.delete<string>(
			`${this._BASE_URL}/user/${id}`
		)
	}

	async updateUser(id: string, data: IUserEditInput) {
		return axiosInterceptorsRequest.patch<string>(
			`${this._BASE_URL}/user/${id}`,
			data
		)
	}

	async toggleUserActivation(id: string) {
		return axiosInterceptorsRequest.patch<IUser>(
			`${this._BASE_URL}/user/${id}/toggle-activation`
		)
	}

	async updateProfile(data: IProfileEditInput) {
		return axiosInterceptorsRequest.patch<boolean>(
			`${this._BASE_URL}/profile`,
			data
		)
	}

	async sendProfileEmailCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post(
			`${this._BASE_URL}/profile/bind/email/send-code`,
			{
				email: data.email
			}
		)
	}

	async verifyProfileEmailCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post<IUser>(
			`${this._BASE_URL}/profile/bind/email/verify`,
			{
				email: data.email,
				code: data.code
			}
		)
	}

	async sendProfilePhoneCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post(
			`${this._BASE_URL}/profile/bind/phone/send-code`,
			{
				phone: data.phone
			}
		)
	}

	async verifyProfilePhoneCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post<IUser>(
			`${this._BASE_URL}/profile/bind/phone/verify`,
			{
				phone: data.phone,
				code: data.code
			}
		)
	}

	async startProfileTelegramBinding() {
		const { data } =
			await axiosInterceptorsRequest.post<IProfileTelegramBindingResponse>(
				`${this._BASE_URL}/profile/bind/telegram/start`
			)

		return data
	}
}

const userService = new UserService()

export default userService
