import { hasExactKeys, isRecord } from '@/shared/lib/contract'
import type { DealStatus } from './sales.contract'

export interface SalesAnalyticsItem {
	status: DealStatus
	count: number
	amountMinor: number
}

export interface SalesAnalytics {
	schemaVersion: 1
	currency: 'RUB'
	items: SalesAnalyticsItem[]
}

export const parseSalesAnalytics = (
	value: unknown
): SalesAnalytics | null => {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ['schemaVersion', 'currency', 'items']) ||
		value.schemaVersion !== 1 ||
		value.currency !== 'RUB' ||
		!Array.isArray(value.items) ||
		value.items.length !== 3
	)
		return null
	const statuses = new Set<DealStatus>()
	let totalCount = 0
	let totalAmount = 0
	for (const item of value.items) {
		if (
			!isRecord(item) ||
			!hasExactKeys(item, ['status', 'count', 'amountMinor']) ||
			!['OPEN', 'WON', 'LOST'].includes(String(item.status)) ||
			statuses.has(item.status as DealStatus) ||
			!Number.isSafeInteger(item.count) ||
			Number(item.count) < 0 ||
			!Number.isSafeInteger(item.amountMinor) ||
			Number(item.amountMinor) < 0 ||
			(item.count === 0 && item.amountMinor !== 0)
		)
			return null
		statuses.add(item.status as DealStatus)
		totalCount += Number(item.count)
		totalAmount += Number(item.amountMinor)
	}
	if (
		!Number.isSafeInteger(totalCount) ||
		!Number.isSafeInteger(totalAmount)
	)
		return null
	return value as unknown as SalesAnalytics
}
