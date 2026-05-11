import { axiosInterceptorsRequest } from '@/api/interceptors'

export type AffiliateReferralStatus =
	| 'REGISTERED'
	| 'REWARD_PENDING'
	| 'CANCELLED'
	| 'PAID'

export interface AffiliateSettings {
	enabled: boolean
	cashbackPercent: number
}

export interface AffiliateUserSummary {
	id: string
	name: string | null
	email: string | null
	phone: string | null
}

export interface AffiliateReferral {
	id: string
	status: AffiliateReferralStatus
	rewardAvailable: boolean
	referrer: AffiliateUserSummary
	referredUser: AffiliateUserSummary
	paymentAmount: number | null
	cashbackPercent: number | null
	cashbackAmount: number | null
	availableAt: string | null
	cancelledAt: string | null
	paidAt: string | null
	firstPayment: {
		id: string
		yookassaId: string
		status: string
		amount: string
		createdAt: string
	} | null
	createdAt: string
	updatedAt: string
}

export interface AffiliateProgramResponse {
	settings: AffiliateSettings
	referralLink: string
	items: AffiliateReferral[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface AdminAffiliateReferralsResponse {
	items: AffiliateReferral[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface AdminAffiliateFilters {
	status?: AffiliateReferralStatus
	search?: string
}

const affiliateService = {
	async getPublicSettings(): Promise<AffiliateSettings> {
		const { data } = await axiosInterceptorsRequest.get(
			'/affiliate/public-settings'
		)
		return data
	},

	async getMyProgram(
		page: number,
		limit: number
	): Promise<AffiliateProgramResponse> {
		const { data } = await axiosInterceptorsRequest.get('/affiliate/me', {
			params: { page, limit }
		})
		return data
	},

	async adminGetSettings(): Promise<AffiliateSettings> {
		const { data } = await axiosInterceptorsRequest.get(
			'/affiliate/admin/settings'
		)
		return data
	},

	async adminUpdateSettings(
		payload: Partial<AffiliateSettings>
	): Promise<AffiliateSettings> {
		const { data } = await axiosInterceptorsRequest.patch(
			'/affiliate/admin/settings',
			payload
		)
		return data
	},

	async adminGetReferrals(
		page: number,
		limit: number,
		filters?: AdminAffiliateFilters
	): Promise<AdminAffiliateReferralsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/affiliate/admin/referrals',
			{
				params: { page, limit, ...filters }
			}
		)
		return data
	}
}

export default affiliateService
