import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Stub out ESM-only packages that tests don't actually exercise
    '^nanoid$': '<rootDir>/src/__tests__/__mocks__/nanoid.ts',
  },
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { strict: false } }],
  },
}

export default config
