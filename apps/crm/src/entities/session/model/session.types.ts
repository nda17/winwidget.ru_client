export type SessionStatus =
	| 'checking'
	| 'authenticated'
	| 'anonymous'
	| 'error'

export interface AuthenticatedSession {
	accessToken: string
	userId: string
}

export interface SessionState {
	status: SessionStatus
	session: AuthenticatedSession | null
	errorMessage: string | null
	sessionRevision: number
}
