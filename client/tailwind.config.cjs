/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        "bg-sub": "rgba(var(--bg-sub), 1)",
        "bg-sub-hover": "rgba(var(--bg-sub-hover), 1)",
        "bg-base": "rgba(var(--bg-base), 1)",
        "bg-base-hover": "rgba(var(--bg-base-hover), 1)",
        "bg-selected": "rgba(var(--bg-selected), 0.12)",
        "bg-shade": "rgba(var(--bg-shade), 1)",
        "bg-shade-hover": "rgba(var(--bg-shade-hover), 1)",
        "bg-border": "rgba(var(--bg-border), 1)",
        "bg-border-hover": "rgba(var(--bg-border-hover), 1)",
        "bg-border-selected": "rgba(var(--bg-border-selected), 1)",
        "bg-divider": "rgba(var(--bg-divider), 1)",
        "bg-contrast": "rgba(var(--bg-contrast), 1)",
        "bg-contrast-hover": "rgba(var(--bg-contrast-hover), 1)",
        "label-title": "rgba(var(--label-title), 1)",
        "label-base": "rgba(var(--label-base), 1)",
        "label-muted": "rgba(var(--label-muted), 1)",
        "label-faint": "rgba(var(--label-faint), 1)",
        "label-link": "rgba(var(--label-link), 1)",
        "label-contrast": "rgba(var(--label-contrast), 1)",
        "label-control": "rgba(var(--label-control), 1)",
        "sub-surface": "rgba(var(--sub-surface), 0.75)",
        "shade-surface": "rgba(var(--shade-surface), 0.75)",
        "base-surface": "rgba(var(--base-surface), 0.75)",
        "brand-default": "rgba(var(--brand-default), 1)",
        "brand-default-hover": "rgba(var(--brand-default-hover), 1)",
        "brand-default-subtitle": "rgba(var(--brand-default-subtitle), 1)",
        "brand-studio": "rgba(var(--brand-studio), 1)",
        "brand-studio-hover": "rgba(var(--brand-studio-hover), 1)",
        "brand-studio-subtle": "rgba(var(--brand-studio-subtle), 1)",
        "green": "rgba(var(--green), 1)",
        "green-subtle": "rgba(var(--green-subtle), 1)",
        "green-subtle-hover": "rgba(var(--green-subtle-hover), 1)",
        "red": "rgba(var(--red), 1)",
        "red-subtle": "rgba(var(--red-subtle), 1)",
        "red-subtle-hover": "rgba(var(--red-subtle-hover), 1)",
        "yellow": "rgba(var(--yellow), 1)",
        "yellow/16": "rgba(var(--yellow), 0.16)",
        "yellow-subtle": "rgba(var(--yellow-subtle), 1)",
        "yellow-subtle-hover": "rgba(var(--yellow-subtle-hover), 1)",
        "blue": "rgba(var(--blue), 1)",
        "blue-subtle": "rgba(var(--blue-subtle), 1)",
        "blue-subtle-hover": "rgba(var(--blue-subtle-hover), 1)",
        "line-select": "rgba(var(--line-select), 1)",
        "danger-300": "#FB7185",
        "warning-100": "#F0A892",
        "warning-300": "#ED6E47",
        "warning-300/12": "rgba(237,110,71, 0.12)",
        sky: '#0EA4E9',
        violet: '#8B5CF6',
        pink: '#EC4899',
        orange: '#F78166',
        'orange-600': '#E9694C',
        // yellow: "#EAB408",
        purple: "#652D90",
      },
      boxShadow: {
        float: "var(--shadow-float)",
        high: "var(--shadow-high)",
        medium: 'var(--shadow-medium)',
        low: 'var(--shadow-low)',
        "rings-gray": "var(--shadow-rings-gray",
        "rings-blue": "var(--shadow-rings-blue)",
      },
      dropShadow: {
        float: "0px 16px 34px rgba(0, 0, 0, 0.75)",
      },
      spacing: {
        "4.5": "1.125rem",
        "10.5": "2.625rem",
        "11.5": "2.875rem",
        '13': '3.25rem',
        '15': '3.75rem',
        "30": "7.5rem",
        "67": "17.7rem",
        "68": "17.75rem",
        "90": "20.25rem",
        "95": "23.75rem",
        "97": "25.75rem",
        "98": "26.5rem",
        '99': '29.625rem',
        '100': '32rem',
        85: '21.25rem',
      },
      borderRadius: {
        'px': '1px',
        1: "0.075rem",
        4: "0.25rem",
        6: "6px",
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
        '6.5xl': '77.5rem',
        96: '24rem'
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
      backgroundImage: {
        "studio": "linear-gradient(135deg, #C7363E 0%, #C7369E 100%)",
        skeleton: 'linear-gradient(90deg, rgba(var(--bg-base-hover), .1) 0%, rgba(var(--bg-base-hover), .1) 33%, rgb(var(--bg-base-hover)) 60%, rgba(var(--bg-base-hover), .1) 100%)',
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
        'pulse-slow': 'pulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'opacity-slow': 'opacity 5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-shadow-slow': 'shadow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 1.5s linear infinite',
        'spin-extra-slow': 'spin 2s linear infinite',
        'move-x': 'move-x 2.5s linear infinite',
        'move-x-fast': 'move-bg 1.5s linear infinite',
        'flash-highlight': 'flash-highlight 1.5s linear',
        'loader-state-zero': 'loader-state-zero 0.55s cubic-bezier(.2,.5,.5,.8)',
        'loader-state-one': 'loader-state-one 2s cubic-bezier(.5,.5,.5,1)',
        'loader-state-two': 'loader-state-two 0.55s cubic-bezier(.5,.2,.8,.5)',
        'loader-state-three': 'loader-state-three 0.55s cubic-bezier(.5,.0,1,.5)',
      },
      keyframes: {
        shadow: {
          '0%': {
            boxShadow: 'var(--shadow-float)',
          },
          '50%': {
            boxShadow: 'var(--shadow-low)',
          },
          '100%': {
            boxShadow: 'var(--shadow-float)',
          },
        },
        opacity: {
          '0%': {
            opacity: 0,
          },
          '50%': {
            opacity: 1,
          },
          '100%': {
            opacity: 0,
          },
        },
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
          '10%': { backgroundColor: 'rgba(var(--bg-highlight, 0.75))' },
          '25%': { backgroundColor: 'rgba(var(--bg-highlight), 0.25)' },
          '80%': { backgroundColor: 'rgba(var(--bg-highlight), 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'loader-state-zero': {
          '0%': {width: '0%'},
          '100%': {width: '50%'},
        },
        'loader-state-one': {
          '0%': {width: '50%'},
          '100%': {width: '90%'},
        },
        'loader-state-two': {
          '0%': {width: '50%'},
          '100%': {width: '100%'},
        },
        'loader-state-three': {
          '0%': {width: '90%'},
          '100%': {width: '100%'},
        }
      }
    },
    fontFamily: {
      default: ['Inter', 'sans-serif'],
      code: ['Menlo', 'sans-serif'],
    },
    namedGroups: ["tooltip","summary"],
  },
  plugins: [
    require('tailwindcss-labeled-groups')(['custom', 'summary' , 'code' ,'row'])
  ],
};
