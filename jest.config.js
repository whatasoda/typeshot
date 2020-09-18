module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  collectCoverage: true,
  coveragePathIgnorePatterns: ['/node_modules/', '/test-utils/'],
};
