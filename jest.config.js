module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/test/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@controllers$': '<rootDir>/src/controllers',
    '^@middleware/(.*)$': '<rootDir>/src/core/middleware/$1',
    '^@middleware$': '<rootDir>/src/core/middleware',
    '^@utilities/(.*)$': '<rootDir>/src/core/utilities/$1',
    '^@utilities$': '<rootDir>/src/core/utilities',
    '^@models/(.*)$': '<rootDir>/src/core/models/$1',
    '^@models$': '<rootDir>/src/core/models',
    '^@db$': '<rootDir>/src/core/utilities/database',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/types$': '<rootDir>/src/types'
  },
};