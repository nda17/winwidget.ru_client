import { describe, expect, it } from 'vitest'
import {
	parseCustomer,
	parseCustomerPage,
	parseCustomerResult
} from './customer.contract'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const contact = {
	id: '22222222-2222-4222-8222-222222222222',
	workspaceId,
	name: 'Тестовый клиент',
	notes: null,
	createdBySubject: 'user-1',
	teamId: null,
	version: 1,
	archivedAt: null,
	createdAt: '2026-09-05T00:00:00.000Z',
	updatedAt: '2026-09-05T00:00:00.000Z',
	phone: '+79000000001',
	email: 'test@example.test',
	companyId: null
}
const page = {
	schemaVersion: 1,
	page: 1,
	pageSize: 25,
	total: 1,
	items: [contact]
}
describe('customer exact contracts', () => {
	it('parses a contact without inventing DTO fields', () =>
		expect(parseCustomer(contact, 'contacts', workspaceId)).toEqual({
			...contact,
			kind: 'contacts'
		}))
	it.each([
		{ ...contact, unexpected: true },
		{ ...contact, workspaceId: '33333333-3333-4333-8333-333333333333' },
		{ ...contact, version: 0 },
		{ ...contact, phone: '79000000001' },
		{ ...contact, companyId: 'external-id' },
		{ ...contact, updatedAt: '2026-09-05' }
	])('rejects malformed/cross-workspace records', value =>
		expect(parseCustomer(value, 'contacts', workspaceId)).toBeNull()
	)
	it('parses an archive command but never lists archived records', () => {
		const archived = { ...contact, archivedAt: contact.updatedAt }
		expect(
			parseCustomerResult(
				{ schemaVersion: 1, contact: archived },
				'contacts',
				workspaceId,
				contact.id
			)?.archivedAt
		).toBe(contact.updatedAt)
		expect(
			parseCustomerPage(
				{ ...page, items: [archived] },
				'contacts',
				workspaceId,
				1,
				25
			)
		).toBeNull()
	})
	it('checks exact identity, pagination and duplicate list IDs', () => {
		expect(
			parseCustomerPage(page, 'contacts', workspaceId, 1, 25)?.items
		).toHaveLength(1)
		expect(
			parseCustomerPage(page, 'contacts', workspaceId, 2, 25)
		).toBeNull()
		expect(
			parseCustomerPage(
				{ ...page, total: 2, items: [contact, contact] },
				'contacts',
				workspaceId,
				1,
				25
			)
		).toBeNull()
		expect(
			parseCustomerResult(
				{ schemaVersion: 1, contact },
				'contacts',
				workspaceId,
				workspaceId
			)
		).toBeNull()
	})
	it('rejects unsafe company website protocols and embedded credentials', () => {
		const {
			phone: _phone,
			email: _email,
			companyId: _companyId,
			...base
		} = contact
		void _phone
		void _email
		void _companyId
		for (const website of [
			'javascript:alert(1)',
			'https://user:password@example.test',
			'file:///etc/passwd'
		])
			expect(
				parseCustomer(
					{ ...base, inn: null, website },
					'companies',
					workspaceId
				)
			).toBeNull()
		expect(
			parseCustomer(
				{ ...base, inn: '1234567890', website: 'https://example.test' },
				'companies',
				workspaceId
			)?.kind
		).toBe('companies')
	})
})
