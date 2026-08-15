import {
	getEvidenceHeaders,
	getReleaseArtifact
} from '@/shared/server/identity-avatar-client-evidence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
	_request: Request,
	{
		params
	}: {
		params: { clientRevision: string; artifact: string }
	}
) {
	try {
		const artifact = getReleaseArtifact(
			params.clientRevision,
			params.artifact
		)
		if (!artifact) {
			return new Response(null, {
				status: 404,
				headers: getEvidenceHeaders('text/plain; charset=utf-8')
			})
		}
		return new Response(artifact.body, {
			status: 200,
			headers: getEvidenceHeaders(artifact.contentType)
		})
	} catch {
		return new Response(null, {
			status: 503,
			headers: {
				'Cache-Control': 'no-store, max-age=0',
				Pragma: 'no-cache',
				'X-Content-Type-Options': 'nosniff'
			}
		})
	}
}
