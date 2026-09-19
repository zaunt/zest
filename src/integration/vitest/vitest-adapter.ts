import {test} from 'vitest';
import type {
  TestFrameworkAdapter,
  RegisteredTest
} from '../test-framework-adapter';

const createVitestAdapter = (): TestFrameworkAdapter => ({
  registerTest(definition: RegisteredTest) {
    test(definition.name, definition.run);
  }
});

export {createVitestAdapter};
