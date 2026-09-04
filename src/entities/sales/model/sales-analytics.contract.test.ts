import { describe, expect, it } from 'vitest'
import { parseSalesAnalytics } from './sales-analytics.contract'

const valid = {
	schemaVersion: 1,
	currency: 'RUB',
	items: [
		{ status: 'OPEN', count: 2, amountMinor: 55000 },
		{ status: 'WON', count: 1, amountMinor: 12345 },
		{ status: 'LOST', count: 0, amountMinor: 0 }
	]
}

describe('Sales analytics aggregate contract', () => {
	it('accepts exact complete aggregates without PII, including zero-value deals', () => {
		expect(parseSalesAnalytics(valid)).toEqual(valid)
		expect(
			parseSalesAnalytics({
				...valid,
				items: valid.items.map(item => ({ ...item, amountMinor: 0 }))
			})
		).not.toBeNull()
	})
	it.each([
		null,
		{ ...valid, schemaVersion: 2 },
		{ ...valid, currency: 'USD' },
		{ ...valid, contacts: [] },
		{ ...valid, items: valid.items.slice(1) },
		{ ...valid, items: [valid.items[0], valid.items[0], valid.items[2]] },
		{
			...valid,
			items: [
				{ ...valid.items[0], email: 'synthetic@example.test' },
				...valid.items.slice(1)
			]
		},
		{
			...valid,
			items: [
				{ ...valid.items[0], status: 'ARCHIVED' },
				...valid.items.slice(1)
			]
		},
		{
			...valid,
			items: [{ ...valid.items[0], count: -1 }, ...valid.items.slice(1)]
		},
		{
			...valid,
			items: [
				{ ...valid.items[0], amountMinor: 0.1 },
				...valid.items.slice(1)
			]
		},
		{
			...valid,
			items: [{ ...valid.items[0], count: '2' }, ...valid.items.slice(1)]
		},
		{
			...valid,
			items: [{ ...valid.items[0], count: 0 }, ...valid.items.slice(1)]
		},
		{
			...valid,
			items: [
				{ ...valid.items[0], count: Number.MAX_SAFE_INTEGER },
				...valid.items.slice(1)
			]
		},
		{
			...valid,
			items: [
				{ ...valid.items[0], amountMinor: Number.MAX_SAFE_INTEGER },
				...valid.items.slice(1)
			]
		}
	])('rejects incomplete, unsafe or expanded aggregates', value => {
		expect(parseSalesAnalytics(value)).toBeNull()
	})
})
