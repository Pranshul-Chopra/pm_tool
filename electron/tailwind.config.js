/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#111110',
        surface: {
          DEFAULT: '#1a1918',
          secondary: '#222120',
          hover: '#282725',
          active: '#302f2d',
        },
        border: {
          DEFAULT: '#2e2c2a',
          strong: '#3a3835',
          subtle: '#222120',
        },
        amber: {
          DEFAULT: '#e8a84c',
          dim: '#7a5820',
          faint: 'rgba(232, 168, 76, 0.08)',
          glow: 'rgba(232, 168, 76, 0.25)',
        },
        carbon: {
          DEFAULT: '#edeae4',
          muted: '#9b9690',
          faint: '#5c5955',
        },
        status: {
          green: '#5aab7f',
          blue: '#4c97e8',
          red: '#e85c4c',
          amber: '#e8a84c',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '10px',
        xl: '12px',
      }
    },
  },
  plugins: [],
}
