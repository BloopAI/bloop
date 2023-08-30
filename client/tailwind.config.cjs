/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        "bg-base": "rgb(var(--bg-base))",
        "bg-base/75": "rgba(var(--bg-base), 0.75)",
        "bg-base-hover": "rgb(var(--bg-base-hover))",
        "bg-shade": "rgb(var(--bg-shade))",
        "bg-shade/50": "rgba(var(--bg-shade), 0.5)",
        "bg-sub": "rgb(var(--bg-sub))",
        "bg-sub/80": "rgba(var(--bg-sub), 0.8)",
        "bg-sub/90": "rgba(var(--bg-sub), 0.9)",
        "bg-border": "rgb(var(--bg-border))",
        "bg-border-hover": "rgb(var(--bg-border-hover))",
        "bg-main": "rgb(var(--bg-main))",
        "bg-main/15": "rgba(var(--bg-main), 0.15)",
        "bg-main/30": "rgba(var(--bg-main), 0.3)",
        "bg-main-hover": "rgb(var(--bg-main-hover))",
        "bg-danger": "rgb(var(--bg-danger))",
        "bg-danger/30": "rgba(var(--bg-danger), 0.3)",
        "bg-danger-hover": "rgb(var(--bg-danger-hover))",
        "bg-success": "rgb(var(--bg-success))",
        "bg-success/30": "rgba(var(--bg-success), 0.3)",
        "bg-success-hover": "rgb(var(--bg-success-hover))",
        "label-control": "rgb(var(--label-control))",
        "label-faint": "rgb(var(--label-faint))",
        "label-muted": "rgb(var(--label-muted))",
        "label-base": "rgb(var(--label-base))",
        "label-title": "rgb(var(--label-title))",
        "label-title/15": "rgba(var(--label-title), 0.15)",
        "label-link": "rgb(var(--label-link))",
        "chat-bg-base": "rgb(var(--chat-bg-base))",
        "chat-bg-base/35": "rgba(var(--chat-bg-base), 0.35)",
        "chat-bg-base/50": "rgba(var(--chat-bg-base), 0.5)",
        "chat-bg-base/75": "rgba(var(--chat-bg-base), 0.75)",
        "chat-bg-base-hover": "rgb(var(--chat-bg-base-hover))",
        "chat-bg-shade": "rgb(var(--chat-bg-shade))",
        "chat-bg-sub": "rgb(var(--chat-bg-sub))",
        "chat-bg-border": "rgb(var(--chat-bg-border))",
        "chat-bg-border/50": "rgba(var(--chat-bg-border), 0.5)",
        "chat-bg-border-hover": "rgb(var(--chat-bg-border-hover))",
        "chat-bg-divider": "rgb(var(--chat-bg-divider))",
        "bg-highlight": "rgb(var(--bg-highlight))",
        "bg-highlight/25": "rgba(var(--bg-highlight), 0.25)",
        "danger-300": "#FB7185",
        sky: '#0EA4E9',
        violet: '#8B5CF6',
        pink: '#EC4899',
        orange: '#F78166',
        'orange-600': '#E9694C',
        yellow: "#EAB408",
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
      spacing: {
        "4.5": "1.125rem",
        "11.5": "2.875rem",
        '13': '3.25rem',
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
