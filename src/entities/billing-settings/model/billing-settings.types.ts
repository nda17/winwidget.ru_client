export interface BillingPublicSettings {
	paymentEnabled: boolean
	autoRenewalSignupEnabled: boolean
	autoRenewalTerms: {
		version: string
		text: string
	}
}

export interface BillingAdminSettings extends BillingPublicSettings {
	id: 'singleton'
	autoRenewalChargesEnabled: boolean
	autoRenewalChargesEnabledAt: string
	affiliateProgramEnabled: boolean
	affiliateCashbackPercent: number
	updatedAt: string
}

export type BillingSettingsPatch = Partial<
	Pick<
		BillingAdminSettings,
		| 'paymentEnabled'
		| 'autoRenewalSignupEnabled'
		| 'autoRenewalChargesEnabled'
		| 'affiliateProgramEnabled'
		| 'affiliateCashbackPercent'
	>
>
