import { getRuntimeRebindArtifactResponse } from '@/shared/server/identity-avatar-client-evidence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
	_request: Request,
	{
		params
	}: {
		params: {
			clientRevision: string
			generation: string
			artifact: string
		}
	}
) {
	return getRuntimeRebindArtifactResponse(
		params.clientRevision,
		params.generation,
		params.artifact
	)
}
