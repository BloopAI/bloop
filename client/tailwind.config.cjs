/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E5E9FF',
          100: '#B8C3FF',
          200: '#8A9CFF',
          300: '#5D75FF',
          400: '#304FFF',
          500: '#0228FF',
          600: '#0020D6',
          700: '#001AAD',
          800: '#001485',
          900: '#000E5C',
        },
        secondary: {
          50: '#FFFAE5',
          100: '#FFF0B7',
          200: '#FFE78A',
          300: '#FFDD5C',
          400: '#FFD42E',
          500: '#FDC900',
          600: '#D4A900',
          700: '#AB8800',
          800: '#836800',
          900: '#5A4700',
        },
        gray: {
          50: '#F9F9F9',
          100: '#F1F1F2',
          200: '#DDDDE1',
          300: '#CACACF',
          400: '#90909A',
          500: '#5E5E67',
          600: '#404049',
          700: '#27272D',
          800: '#1D1D20',
          900: '#131315',
        },
        danger: {
          50: '#FFE4E6',
          100: '#FECDD3',
          200: '#FDA4AE',
          300: '#FB7185',
          400: '#F43F5E',
          500: '#E11D48',
          600: '#BF123C',
          700: '#9E1239',
          800: '#881337',
        },
        warning: {
          50: '#F9E9E3',
          100: '#F0A892',
          200: '#EF8767',
          300: '#ED6E47',
          400: '#C94B24',
          500: '#A03818',
          600: '#882E12',
          700: '#72240C',
          800: '#591C09',
        },
        success: {
          50: '#F1FEF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#85EEAC',
          400: '#4BDF80',
          500: '#21C55E',
          600: '#16A24A',
          700: '#15803D',
          800: '#156534',
        },
        violet: {
          50: '#f5f3ff',
          100: '#ECE8FE',
          200: '#DDD6FE',
          300: '#C4B5FE',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
        },
        pink: {
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#EC4899',
          600: '#DB2777',
          700: '#BE185D',
          800: '#9D174D',
        },
        orange: {
          50: '#FFEEEA',
          100: '#FFD8CF',
          200: '#FFC6B9',
          300: '#FFB1A0',
          400: '#FD9E88',
          500: '#F78166',
          600: '#E9694C',
          700: '#DB5334',
          800: '#CB4425',
        },
        yellow: {
          50: '#FFFCE8',
          100: '#FEF9C2',
          200: '#FFF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#EAB408',
          600: '#C98A04',
          700: '#A16207',
          800: '#844D0E',
        },
        teal: {
          50: '#F0FDFA',
          100: '#CBFBF1',
          200: '#99F6E4',
          300: '#5EEAD5',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
        },
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BEF8',
          500: '#0EA4E9',
          600: '#0284C7',
          700: '#0269A0',
          800: '#075985',
        },
        lime: {
          50: '#F8FEE7',
          100: '#ECFCCA',
          200: '#D9F99E',
          300: '#BEF264',
          400: '#A3E536',
          500: '#84CC17',
          600: '#65A30D',
          700: '#4D7C0F',
          800: '#3F6212',
        },
        purple: "#652D90"
      },
      boxShadow: {
        "rings-blue": "0px 0px 0px 2px rgba(194, 197, 255, 0.16)",
        'light': '0px 1px 6px rgba(0, 0, 0, 0.25)',
        'lighter': '0px 1px 3px rgba(62, 70, 85, 0.12)',
        'light-bigger': '0px 6px 16px rgba(0, 0, 0, 0.25)',
        'big': '0px 16px 34px rgba(0, 0, 0, 0.5)',
        'medium': '0px 16px 24px rgba(0, 0, 0, 0.25)'
      },
      height: {
        "11.5": "2.875rem",
        '13': '3.375rem',
        85: '21.25rem',
      },
      width: {
        "11.5": "2.875rem",
        '13': '3.375rem',
        "30": "7.5rem",
        "68": "17.75rem",
        "90": "20.25rem",
        "98": "26.5rem",
        '99': '29.625rem',
        '100': '32rem'
      },
      borderRadius: {
        'px': '1px',
        1: "0.075rem",
        4: "0.25rem",
        14: "0.875rem"
      },
      padding: {
        "2.5": "0.625rem"
      },
      margin: {
        13: '3.375rem'
      },
      maxWidth:{
        '5': '5rem',
        '12': '12rem',
        'md2': '29.625rem',
        'md3': '30.25rem',
        '5.5xl': '70rem',
        '6.5xl': '77.5rem'
      },
      minWidth: {
        "6": "1.5rem"
      },
      borderWidth: {
        6:"6px"
      },
      scale: {
        25: "0.25"
      },
      transitionTimingFunction: {
        'in-bounce': "cubic-bezier(0.17, 0.67, 0.83, 0.67)",
        'in-slow': "cubic-bezier(0.4, 0, 0, 1)",
        'out-slow': "cubic-bezier(0.6, 0.6, 0, 1)"
      },
      transitionProperty: {
        visibility: 'visibility'
      },
      gridTemplateColumns: {
        "4-fit": "repeat(4, auto)"
      },
      display: ['hover', 'focus', 'group-hover'],
      backdropBlur: {
        'md': "6px"
      },
      dropShadow: {
        'light': '0px 1px 6px rgba(0, 0, 0, 0.25)',
        'light-bigger': '0px 6px 16px rgba(0, 0, 0, 0.25)'
      },
      backgroundImage: {
        skeleton: 'linear-gradient(90deg, rgba(29, 29, 32, .1) 0%, rgba(29, 29, 32, .1) 33%, #1D1D20 60%, rgba(29, 29, 32, .1) 100%)',
      },
      backgroundSize :{
        '50%': '50%',
      },
      zIndex: {
        60: 60,
        70: 70,
        80: 80,
        90: 90,
        100: 100,
      },
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
        'move-x': 'move-x 2.5s linear infinite',
        'move-x-fast': 'move-bg 1.5s linear infinite',
        'flash-highlight': 'flash-highlight 1.5s linear',
      },
      keyframes: {
        'move-x': {
          '0%': {
            transform: 'translateX(-75%)',
          },
          '25%': {
            transform: 'translateX(-25%)',
          },
          '50%': {
            transform: 'translateX(25%)',
          },
          '100%': {
            transform: 'translateX(75%)',
          },
        },
        'move-bg' :{
          '0%': {
            backgroundPosition: '110% 0',
          },
          '100%':{
            backgroundPosition: '0 0%'
          }
        },
        'flash-highlight': {
          '0%': { backgroundColor: 'transparent' },
          '10%': { backgroundColor: '#FFFAE5' },
          '25%': { backgroundColor: 'rgba(253,201,0,0.25)' },
          '80%': { backgroundColor: 'rgba(253,201,0,0.25)' },
          '100%': { backgroundColor: 'transparent' },
        }
      }
    },
    fontFamily: {
      default: ['Inter', 'sans-serif'],
      code: ['Menlo', 'sans-serif'],
    },
    namedGroups: ["tooltip","foo", "bar"],
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
    require('tailwindcss-labeled-groups')(['custom'])
  ],
};
