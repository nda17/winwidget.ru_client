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

export interface BillingProviderReadiness {
	schemaVersion: 1
	source: 'CODE_AND_PERSISTED_SETTINGS'
	provider: {
		name: 'YOOKASSA'
		mode: 'production' | 'non-production'
		shopIdConfigured: boolean
		secretKeyConfigured: boolean
		credentialsConfigured: boolean
	}
	features: {
		paymentEnabled: boolean
		autoRenewalSignupEnabled: boolean
		autoRenewalChargesEnabled: boolean
	}
	receipt: {
		schemaVersion: 1
		contractVersion: string
		requestIncluded: true
		customerContactRequired: true
		item: {
			vatCode: number
			paymentSubject: string
			paymentMode: string
		}
		internet: true
		normalizedStoredFields: string[]
		rawProviderResponseStored: true
	}
	webhook: {
		codeConfigured: true
		method: 'POST'
		route: string
		acceptedEvents: string[]
		duplicateDeliveryFence: 'authenticated-provider-object-reverification'
	}
	externalVerification: {
		merchantAutoPayments: 'NOT_VERIFIED'
		onlineCashRegister: 'NOT_VERIFIED'
		ofd: 'NOT_VERIFIED'
	}
}
