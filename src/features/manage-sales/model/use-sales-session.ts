'use client'

import {
	useCrmPermissions,
	useCrmWorkspaceAccess
} from '@/entities/crm-access'
import { useSessionStore } from '@/entities/session'

export const useSalesSession = () => {
	const workspace = useCrmWorkspaceAccess()
	const { session, sessionRevision } = useSessionStore()
	const permissions = useCrmPermissions(
		workspace.workspaceId,
		session,
		sessionRevision
	)
	const canRead =
		!!session &&
		!!permissions.data &&
		!permissions.isError &&
		permissions.data.permissions.includes('sales:read') &&
		permissions.data.role !== 'ANALYST'
	const canWrite =
		canRead &&
		workspace.canWrite &&
		!permissions.isFetching &&
		permissions.data?.state !== 'READ_ONLY' &&
		permissions.data?.permissions.includes('sales:write') === true
	const key = [
		workspace.workspaceId,
		session?.userId,
		sessionRevision
	] as const
	return {
		workspace,
		session,
		sessionRevision,
		permissions,
		canRead,
		canWrite,
		key
	}
}
