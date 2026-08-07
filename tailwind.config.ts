import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#15AFA4',
          50: '#E8FAF9',
          100: '#C5F2F0',
          200: '#8FE6E2',
          300: '#59D9D3',
          400: '#2CCDC6',
          500: '#15AFA4',
          600: '#108C82',
          700: '#0C6960',
          800: '#08463F',
          900: '#04231F',
        },
        background: '#F8FAFB',
        sidebar: '#0F1724',
        card: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
