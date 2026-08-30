/** @type {import('next').NextConfig} */
const nextConfig = {
	agentRules: false,
	output: 'standalone',
	poweredByHeader: false,
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'Content-Security-Policy',
						value: "frame-ancestors 'none'"
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin'
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff'
					},
					{
						key: 'X-Frame-Options',
						value: 'DENY'
					},
					{
						key: 'X-Robots-Tag',
						value: 'noindex, nofollow, noarchive'
					}
				]
			}
		]
	}
}

export default nextConfig
