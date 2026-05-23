/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ============================================
      // COLORS
      // ============================================
      colors: {
        // Brand Colors (MindX)
        'mindx-red': {
          DEFAULT: '#a1001f',
          dark: '#8a0019',
          light: '#c41230',
        },
        
        // Primary colors (using brand colors)
        primary: {
          DEFAULT: '#a1001f',
          foreground: '#ffffff',
        },
        
        // Neutral colors (10 shades: 50-950)
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        
        // Semantic colors
        success: {
          DEFAULT: '#16a34a',
          foreground: '#ffffff',
        },
        error: {
          DEFAULT: '#dc2626',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#ea580c',
          foreground: '#ffffff',
        },
        info: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
        
        // UI colors (semantic tokens)
        background: '#ffffff',
        foreground: '#171717',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#171717',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#171717',
        },
        secondary: {
          DEFAULT: '#f5f5f5',
          foreground: '#171717',
        },
        muted: {
          DEFAULT: '#f5f5f5',
          foreground: '#737373',
        },
        accent: {
          DEFAULT: '#f5f5f5',
          foreground: '#171717',
        },
        destructive: {
          DEFAULT: '#dc2626',
          foreground: '#ffffff',
        },
        border: '#e5e5e5',
        input: '#e5e5e5',
        ring: '#a1001f',
      },
      
      // ============================================
      // SPACING SYSTEM (4px base unit)
      // ============================================
      spacing: {
        0: '0px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
        32: '128px',
      },
      
      // ============================================
      // TYPOGRAPHY SCALE (1.250 ratio - Major Third)
      // Base: 16px
      // ============================================
      fontSize: {
        xs: ['10.24px', { lineHeight: '1.5' }],      // 16 / 1.25^2
        sm: ['12.8px', { lineHeight: '1.5' }],       // 16 / 1.25
        base: ['16px', { lineHeight: '1.5' }],       // base
        lg: ['20px', { lineHeight: '1.5' }],         // 16 * 1.25
        xl: ['25px', { lineHeight: '1.5' }],         // 16 * 1.25^2
        '2xl': ['31.25px', { lineHeight: '1.25' }],  // 16 * 1.25^3
        '3xl': ['39.06px', { lineHeight: '1.25' }],  // 16 * 1.25^4
        '4xl': ['48.83px', { lineHeight: '1.25' }],  // 16 * 1.25^5
        '5xl': ['61.04px', { lineHeight: '1.25' }],  // 16 * 1.25^6
        '6xl': ['76.29px', { lineHeight: '1.25' }],  // 16 * 1.25^7
      },
      
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      
      lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75',
        loose: '2',
      },
      
      fontFamily: {
        sans: [
          'Exo',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      
      // ============================================
      // BORDER RADIUS SCALE
      // ============================================
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      
      // ============================================
      // SHADOW SYSTEM (elevation levels)
      // ============================================
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        none: 'none',
      },
      
      // ============================================
      // Z-INDEX SCALE (named layers)
      // ============================================
      zIndex: {
        base: '0',
        dropdown: '1000',
        sticky: '1100',
        fixed: '1200',
        'modal-backdrop': '1300',
        modal: '1400',
        popover: '1500',
        tooltip: '1600',
      },
      
      // ============================================
      // ANIMATION DURATIONS
      // ============================================
      transitionDuration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      
      // ============================================
      // ANIMATION TIMING FUNCTIONS
      // ============================================
      transitionTimingFunction: {
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        linear: 'linear',
      },
      
      // ============================================
      // CONTAINER MAX-WIDTHS (responsive breakpoints)
      // ============================================
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      
      // ============================================
      // CONTAINER PADDING
      // ============================================
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
      
      // ============================================
      // GAP UTILITIES (for flex and grid)
      // ============================================
      gap: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      
      // ============================================
      // KEYFRAMES FOR ANIMATIONS
      // ============================================
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-out': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(10px)', opacity: '0' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'scale-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      
      // ============================================
      // ANIMATION UTILITIES
      // ============================================
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        'fade-out': 'fade-out 300ms ease-in',
        'slide-in': 'slide-in 300ms ease-out',
        'slide-out': 'slide-out 300ms ease-in',
        'scale-in': 'scale-in 300ms ease-out',
        'scale-out': 'scale-out 300ms ease-in',
        spin: 'spin 1s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s infinite',
      },
    },
  },
  plugins: [],
}
