import { UserRole } from '@/services/auth/auth.types'

export interface IUser {
	id: string
	name?: string
	email?: string | null
	phone?: string | null
	isPhoneVerified?: boolean
	password?: string
	avatarPath?: string
	rights: UserRole[]
	createdAt: string
}
