/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#0e1211',
        panel: '#141918',
        line: 'rgba(255,255,255,0.08)',
        mute: '#7f8f8a',
        dim: '#6f7f7a',
        fg: '#dfeae6',
        mint: '#3ddc97',
        mintsoft: '#8ef7c6'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
