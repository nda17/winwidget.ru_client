/** @type {import('next').NextConfig} */
const nextConfig = {
	rewrites: () => {
		return [
			{
				source: '/auth/google',
				destination: 'http://localhost:4200/auth/google'
			},
			{
				source: '/auth/github',
				destination: 'http://localhost:4200/auth/github'
			},
			{
				source: '/auth/yandex',
				destination: 'http://localhost:4200/auth/yandex'
			},
			{
				source: '/uploads/:path*',
				destination: `http://localhost:4200/uploads/:path*`
			}
		]
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
				port: '',
				pathname: '/**'
			},
			{
				protocol: 'https',
				hostname: 'avatars.githubusercontent.com',
				port: '',
				pathname: '/**'
			},
			{
				protocol: 'https',
				hostname: 'avatars.yandex.net',
				port: '',
				pathname: '/**'
			}
		]
	}
}

export default nextConfig
