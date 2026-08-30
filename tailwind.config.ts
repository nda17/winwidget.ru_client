import type { Config } from 'tailwindcss'

const config: Config = {
	content: ['./src/**/*.{js,ts,jsx,tsx,mdx,scss}'],
	theme: {
		extend: {
			colors: {
				primary: '#ff9902'
			},
			fontFamily: {
				sans: [
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'sans-serif'
				]
			}
		}
	},
	plugins: []
}

export default config
