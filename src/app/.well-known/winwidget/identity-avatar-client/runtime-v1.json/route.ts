import {
	getEvidenceHeaders,
	getRuntimeEvidence
} from '@/shared/server/identity-avatar-client-evidence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
	try {
		return new Response(getRuntimeEvidence(), {
			status: 200,
			headers: getEvidenceHeaders('application/json; charset=utf-8')
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
