// jest.setup.afterenv.js -- Runs after test framework is initialized

beforeEach(() => {
  jest.clearAllMocks();
  global.__mockStore.clear();
  global.__mockSecureStore.clear();
});
