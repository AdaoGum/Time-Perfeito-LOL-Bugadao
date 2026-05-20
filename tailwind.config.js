/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        marker: ['Permanent Marker', 'cursive'],
        rock: ['Rock Salt', 'cursive'],
        creep: ['Creepster', 'cursive'],
      },
      boxShadow: {
        lava: '0 0 30px rgba(249, 115, 22, 0.25)',
        ritual: '0 0 24px rgba(6, 182, 212, 0.22)',
      },
      backgroundImage: {
        'stone-texture': 'radial-gradient(circle at top, rgba(148, 163, 184, 0.18), transparent 50%), linear-gradient(135deg, rgba(12, 10, 9, 0.96), rgba(23, 23, 23, 0.96))',
      },
    },
  },
  plugins: [],
}
