import {
	claimSoakProbe,
	getEvidenceHeaders
} from '@/shared/server/identity-avatar-client-evidence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
	_request: Request,
	{
		params
	}: {
		params: { clientRevision: string; probeId: string }
	}
) {
	try {
		const status = claimSoakProbe(params.clientRevision, params.probeId)
		if (status === null) {
			return new Response(null, {
				status: 404,
				headers: getEvidenceHeaders('text/plain; charset=utf-8')
			})
		}
		return new Response(null, {
			status,
			headers: getEvidenceHeaders('application/octet-stream')
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
