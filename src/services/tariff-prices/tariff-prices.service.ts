import {
	axiosClassicRequest,
	axiosInterceptorsRequest
} from '@/api/interceptors'
import type {
	TariffPrice,
	TariffPriceInput
} from '@/services/tariff-prices/tariff-prices.types'

const tariffPricesService = {
	async get(): Promise<TariffPrice[]> {
		const { data } = await axiosClassicRequest.get('/tariff-prices')
		return data
	},

	async update(prices: TariffPriceInput[]): Promise<TariffPrice[]> {
		const { data } = await axiosInterceptorsRequest.patch(
			'/tariff-prices',
			{ prices }
		)
		return data
	}
}

export default tariffPricesService
