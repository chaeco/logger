module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  verbose: true,
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|@chaeco/indexed-db-storage)/)',
  ],
  moduleNameMapper: {
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.ts',
    '^@chaeco/indexed-db-storage$': '<rootDir>/tests/__mocks__/indexed-db-storage.ts',
  },
}
