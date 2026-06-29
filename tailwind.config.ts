import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 🎯 เพิ่มกล่อง fontFamily ตรงนี้ครับ
      fontFamily: {
        sans: [
          'var(--font-roboto)',
          'var(--font-noto-thai)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        thai: ['var(--font-noto-thai)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config