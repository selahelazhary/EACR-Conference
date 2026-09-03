import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#C2185B',
        spark: '#00ABCB',
        accent: {
          news: '#E72085',
          events: '#00ABCB',
          workshops: '#B8860B',
          speakers: '#7A2E8E',
          videos: '#C2185B',
          gallery: '#0F7C8A',
        }
      },
      fontFamily: {
        display: ['Tajawal', 'sans-serif'],
        body: ['IBM Plex Sans Arabic', 'sans-serif'],
      },
      direction: {
        rtl: 'rtl',
      }
    },
  },
  plugins: [],
}
export default config
