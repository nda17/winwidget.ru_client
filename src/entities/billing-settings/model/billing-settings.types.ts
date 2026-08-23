export interface AutoRenewalTerms {
	version: string
	text: string
}

export interface BillingPublicSettings {
	paymentEnabled: boolean
	autoRenewalSignupEnabled: boolean
	autoRenewalTerms: AutoRenewalTerms
}

export interface BillingAdminSettings extends BillingPublicSettings {
	id: 'singleton'
	autoRenewalChargesEnabled: boolean
	autoRenewalChargesEnabledAt: string
	affiliateProgramEnabled: boolean
	affiliateCashbackPercent: number
	updatedAt: string
}

export type BillingAdminSettingsPatch = Partial<
	Pick<
		BillingAdminSettings,
		| 'paymentEnabled'
		| 'autoRenewalSignupEnabled'
		| 'autoRenewalChargesEnabled'
		| 'affiliateProgramEnabled'
		| 'affiliateCashbackPercent'
	>
>
