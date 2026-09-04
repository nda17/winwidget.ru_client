import { describe, expect, it } from 'vitest'
import { parseCrmPermissions } from './crm-permissions'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const base = {
	schemaVersion: 1,
	workspaceId,
	subject: 'user-1',
	role: 'OWNER',
	state: 'ACTIVE',
	dataScope: 'ALL',
	teamIds: [],
	permissions: ['customers:read', 'customers:write', 'customers:export']
}
describe('workspace permission contract', () => {
	it('accepts a workspace-bound owner matrix', () =>
		expect(parseCrmPermissions(base, workspaceId)).toEqual(base))
	it.each([
		{ ...base, schemaVersion: 2 },
		{ ...base, role: 'MEMBER' },
		{ ...base, role: 'MANAGER' },
		{ ...base, state: 'READ_ONLY' },
		{ ...base, role: 'ANALYST' },
		{ ...base, permissions: ['customers:read', 'customers:read'] },
		{ ...base, permissions: ['unknown:permission'] },
		{ ...base, workspaceId: '22222222-2222-4222-8222-222222222222' },
		{ ...base, teamIds: ['invalid'] },
		{ ...base, token: 'unexpected' }
	])('fails closed on an incompatible or elevated matrix', value =>
		expect(parseCrmPermissions(value, workspaceId)).toBeNull()
	)
	it('accepts only aggregate access for ANALYST', () =>
		expect(
			parseCrmPermissions(
				{ ...base, role: 'ANALYST', permissions: ['sales:analytics'] },
				workspaceId
			)?.permissions
		).toEqual(['sales:analytics']))
	it('retains owner export in READ_ONLY', () =>
		expect(
			parseCrmPermissions(
				{
					...base,
					state: 'READ_ONLY',
					permissions: ['customers:read', 'customers:export']
				},
				workspaceId
			)?.state
		).toBe('READ_ONLY'))
})
