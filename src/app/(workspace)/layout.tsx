import { AccessGate } from '@/features/crm-access-gate'
import { SessionGate } from '@/features/session-bootstrap'
import { CrmAppShell } from '@/widgets/crm-app-shell'
import type { PropsWithChildren } from 'react'

const WorkspaceLayout = ({ children }: PropsWithChildren) => {
	return (
		<SessionGate>
			<AccessGate>
				<CrmAppShell>{children}</CrmAppShell>
			</AccessGate>
		</SessionGate>
	)
}

export default WorkspaceLayout
