import { CrmAppShell } from '@/widgets/crm-app-shell'
import type { PropsWithChildren } from 'react'

const WorkspaceLayout = ({ children }: PropsWithChildren) => {
	return <CrmAppShell>{children}</CrmAppShell>
}

export default WorkspaceLayout
