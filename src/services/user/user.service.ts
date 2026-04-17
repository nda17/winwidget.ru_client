import { axiosInterceptorsRequest } from '@/api/interceptors'
import { IUserEditInput } from '@/components/screens/admin/user/edit/user-edit.interface'
import { IUser } from '@/shared/types/user.types'

export interface IProfileEditInput {
	name?: string
	avatarPath?: string
	password?: string
}

export interface IProfileIdentityCodeInput {
	email?: string
	phone?: string
	code?: string
}

class UserService {
	private _BASE_URL = '/users'

	async fetchProfile() {
		return axiosInterceptorsRequest.get<IUser>(`${this._BASE_URL}/profile`)
	}

	async fetchUserList(searchTerm?: string) {
		return axiosInterceptorsRequest.get<IUser[]>(
			`${this._BASE_URL}/user-list`,
			{
				params: searchTerm
					? {
							searchTerm
						}
					: {}
			}
		)
	}

	async fetchUserById(id: string) {
		return axiosInterceptorsRequest.get<IUser>(
			`${this._BASE_URL}/edit/${id}`
		)
	}

	async deleteUser(id: string) {
		return axiosInterceptorsRequest.delete<string>(
			`${this._BASE_URL}/user/${id}`
		)
	}

	async updateUser(id: string, data: IUserEditInput) {
		return axiosInterceptorsRequest.patch<string>(
			`${this._BASE_URL}/user/${id}`,
			data
		)
	}

	async updateProfile(data: IProfileEditInput) {
		return axiosInterceptorsRequest.patch<boolean>(
			`${this._BASE_URL}/profile`,
			data
		)
	}

	async sendProfileEmailCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post(
			`${this._BASE_URL}/profile/bind/email/send-code`,
			{
				email: data.email
			}
		)
	}

	async verifyProfileEmailCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post<IUser>(
			`${this._BASE_URL}/profile/bind/email/verify`,
			{
				email: data.email,
				code: data.code
			}
		)
	}

	async sendProfilePhoneCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post(
			`${this._BASE_URL}/profile/bind/phone/send-code`,
			{
				phone: data.phone
			}
		)
	}

	async verifyProfilePhoneCode(data: IProfileIdentityCodeInput) {
		return axiosInterceptorsRequest.post<IUser>(
			`${this._BASE_URL}/profile/bind/phone/verify`,
			{
				phone: data.phone,
				code: data.code
			}
		)
	}
}

const userService = new UserService()

export default userService
