import { axiosInterceptorsRequest } from '@/api/interceptors'

interface ICreatePaymentResponse {
	confirmationUrl: string
}

class PaymentService {
	private _BASE_URL = '/payments'

	async createPremiumPayment() {
		return axiosInterceptorsRequest.post<ICreatePaymentResponse>(
			`${this._BASE_URL}/create`
		)
	}
}

const paymentService = new PaymentService()

export default paymentService
