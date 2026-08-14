export interface SiteSettings {
	id: string
	bannerEnabled: boolean
	bannerText: string
	snowflakeEnabled: boolean
	paymentEnabled: boolean
	autoRenewalSignupEnabled: boolean
	autoRenewalChargesEnabled: boolean
	autoRenewalChargesEnabledAt: string
	affiliateProgramEnabled: boolean
	affiliateCashbackPercent: number
	autoRenewalTerms: {
		version: string
		text: string
	}
	updatedAt: string
}
