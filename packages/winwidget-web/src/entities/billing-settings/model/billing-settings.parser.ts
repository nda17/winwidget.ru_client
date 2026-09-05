import type { BillingPublicSettings } from './billing-settings.types'

const PUBLIC_SETTINGS_KEYS = [
	'autoRenewalSignupEnabled',
	'autoRenewalTerms',
	'paymentEnabled'
] as const
const AUTO_RENEWAL_TERMS_KEYS = ['text', 'version'] as const
const MAX_TERMS_VERSION_BYTES = 128
const MAX_TERMS_TEXT_BYTES = 64 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (
	value: Record<string, unknown>,
	expectedKeys: readonly string[]
) => {
	const actualKeys = Object.keys(value).sort()

	return (
		actualKeys.length === expectedKeys.length &&
		actualKeys.every((key, index) => key === expectedKeys[index])
	)
}

const isBoundedNonEmptyString = (
	value: unknown,
	maxBytes: number
): value is string => {
	if (
		typeof value !== 'string' ||
		!value.trim() ||
		value.length > maxBytes
	) {
		return false
	}

	return new TextEncoder().encode(value).byteLength <= maxBytes
}

export const parseBillingPublicSettings = (
	value: unknown
): BillingPublicSettings | null => {
	if (!isRecord(value) || !hasExactKeys(value, PUBLIC_SETTINGS_KEYS)) {
		return null
	}

	const terms = value.autoRenewalTerms

	if (
		typeof value.paymentEnabled !== 'boolean' ||
		typeof value.autoRenewalSignupEnabled !== 'boolean' ||
		!isRecord(terms) ||
		!hasExactKeys(terms, AUTO_RENEWAL_TERMS_KEYS) ||
		!isBoundedNonEmptyString(terms.version, MAX_TERMS_VERSION_BYTES) ||
		!isBoundedNonEmptyString(terms.text, MAX_TERMS_TEXT_BYTES)
	) {
		return null
	}

	return {
		paymentEnabled: value.paymentEnabled,
		autoRenewalSignupEnabled: value.autoRenewalSignupEnabled,
		autoRenewalTerms: {
			version: terms.version,
			text: terms.text
		}
	}
}
