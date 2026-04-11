import { IUser } from '@/shared/types/user.types'

export interface IUserEditInput
	extends Omit<IUser, 'verificationToken' | 'createdAt' | 'rights'> {
	isPhoneVerified?: boolean
	isUser?: boolean
	isAdmin?: boolean
	isManager?: boolean
	isPremium?: boolean
}
