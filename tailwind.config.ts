import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                sand: {
                    50: '#FDFAF4',
                    100: '#F5EFE0',
                    200: '#EBD9BF',
                    300: '#D8BF99',
                    400: '#C8A572',
                    500: '#B88A4D',
                },
                ink: {
                    50: '#F5F3F1',
                    100: '#E8E4DF',
                    200: '#C9BFB7',
                    300: '#9E908A',
                    400: '#6B5E56',
                    500: '#3D322D',
                    900: '#1C1917',
                },
                terracotta: {
                    50: '#FBF0EB',
                    100: '#F5D8CC',
                    200: '#EBAB91',
                    300: '#DC7A50',
                    400: '#C4622D',
                    500: '#A34F23',
                    600: '#7C3A18',
                },
                sage: {
                    50: '#EFF4EE',
                    100: '#D5E3D4',
                    200: '#AAC5A8',
                    300: '#7D9B76',
                    400: '#5E7D59',
                    500: '#435C3E',
                },
            },
            fontFamily: {
                display: ['Playfair Display', 'Georgia', 'serif'],
                sans: ['DM Sans', 'system-ui', 'sans-serif'],
            },
            backgroundImage: {
                'paper-texture':
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'spin-slow': 'spin 2s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            boxShadow: {
                card: '0 2px 16px -4px rgba(28, 25, 23, 0.12)',
                'card-hover': '0 8px 32px -4px rgba(28, 25, 23, 0.20)',
                'drawer': '0 -8px 32px -4px rgba(28, 25, 23, 0.16)',
            },
            borderRadius: {
                '2xl': '16px',
                '3xl': '24px',
            },
        },
    },
    plugins: [],
};

export default config;
