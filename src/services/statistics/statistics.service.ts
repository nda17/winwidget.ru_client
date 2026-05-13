import { axiosInterceptorsRequest } from '@/api/interceptors'
import { Plan, SubscriptionStatus } from '@/services/widget/widget.types'

export interface IUserRegistrationsByMonth {
	month: string
	year: number
	count: number
}

export interface IStatisticsOverview {
	totalUsers: number
	activeUsers30d: number
	newUsers30d: number
	multiLoginUsers: number
	adminUsers: number
}

export type StatisticsWidgetType =
	| 'wheel'
	| 'quiz'
	| 'callback'
	| 'countdownTimer'
	| 'stopOffer'

export interface IStatisticsChartPoint {
	label: string
}

export interface IStatisticsRevenuePoint extends IStatisticsChartPoint {
	periodKey: string
	revenue: number
	payments: number
}

export interface IStatisticsLeadDayPoint extends IStatisticsChartPoint {
	date: string
	wheel: number
	quiz: number
	callback: number
	countdownTimer: number
	stopOffer: number
	total: number
}

export interface IStatisticsCountPoint {
	label: string
	count: number
}

export interface IStatisticsLeadTypePoint extends IStatisticsCountPoint {
	type: StatisticsWidgetType
}

export interface IStatisticsWidgetTypePoint {
	type: StatisticsWidgetType
	label: string
	total: number
	active: number
	inactive: number
	withoutDomain: number
	activeWithoutDomain: number
	new30d: number
}

export interface IStatisticsSubscriptionPlanPoint extends IStatisticsCountPoint {
	plan: Plan
}

export interface IStatisticsSubscriptionStatusPoint extends IStatisticsCountPoint {
	status: SubscriptionStatus
}

export interface IStatisticsDashboard {
	generatedAt: string
	finance: {
		revenueAllTime: number
		revenue30d: number
		revenueCurrentMonth: number
		succeededPayments30d: number
		pendingPaymentsCurrent: number
		cancelledPayments30d: number
		averageCheck30d: number
		payingUsersTotal: number
		payingUsers30d: number
	}
	subscriptions: {
		active: number
		paidActive: number
		trialActive: number
		expiringToday: number
		expiring3d: number
		expiring7d: number
		expiredActive: number
		byPlan: IStatisticsSubscriptionPlanPoint[]
		byStatus: IStatisticsSubscriptionStatusPoint[]
	}
	leads: {
		total30d: number
		previous30d: number
		growth30d: number | null
		today: number
		allTime: number
		byType30d: IStatisticsLeadTypePoint[]
		byDay: IStatisticsLeadDayPoint[]
	}
	widgets: {
		total: number
		active: number
		inactive: number
		withoutDomain: number
		activeWithoutDomain: number
		new30d: number
		byType: IStatisticsWidgetTypePoint[]
	}
	users: {
		total: number
		publicTotal: number
		active30d: number
		new30d: number
		admins: number
		withoutEmail: number
		withoutPhone: number
		withoutContacts: number
		telegramLinked: number
	}
	charts: {
		revenueByMonth: IStatisticsRevenuePoint[]
	}
}

class StatisticsService {
	private _BASE_URL = '/statistics'

	async getRegistrationsByMonth() {
		return axiosInterceptorsRequest.get<IUserRegistrationsByMonth[]>(
			`${this._BASE_URL}/registrations-by-month`
		)
	}

	async getDashboard() {
		return axiosInterceptorsRequest.get<IStatisticsDashboard>(
			`${this._BASE_URL}/dashboard`
		)
	}

	async getOverview() {
		return axiosInterceptorsRequest.get<IStatisticsOverview>(
			`${this._BASE_URL}/overview`
		)
	}
}

const statisticsService = new StatisticsService()

export default statisticsService
