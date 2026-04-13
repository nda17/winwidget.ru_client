'use client'
import useNetworkStatus from '@/hooks/useNetworkStatus'

const NetworkStatusProvider = () => {
	useNetworkStatus()
	return null
}

export default NetworkStatusProvider
