/** @type {import('tailwindcss').Config} */
const basicConfig = require("../../client/tailwind.config");

module.exports = {
  ...basicConfig,
  content: ['../../client/src/**/*.{ts,tsx,js,jsx}', './src/**/*.tsx']
}
