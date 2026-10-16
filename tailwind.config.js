/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('border'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        'accent-2': token('accent-2'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        theme: 'var(--radius)',
      },
      borderWidth: {
        theme: 'var(--border-width)',
      },
      boxShadow: {
        theme: '0 2px 10px -2px rgb(var(--shadow-color) / 0.25)',
        glow: '0 0 0 1px rgb(var(--c-accent) / 0.5), 0 0 18px -2px rgb(var(--c-accent) / 0.45)',
      },
      keyframes: {
        'dice-tumble': {
          '0%': { transform: 'rotate(0deg) scale(0.6)', opacity: '0.4' },
          '60%': { transform: 'rotate(540deg) scale(1.15)', opacity: '1' },
          '100%': { transform: 'rotate(720deg) scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'dice-tumble': 'dice-tumble 0.9s cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
