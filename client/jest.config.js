/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  collectCoverageFrom: [
    'src/utils/{!(services),}.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 21,
      lines: 18,
    },
  },
};
