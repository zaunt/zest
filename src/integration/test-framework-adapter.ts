type RegisteredTest = {
  name: string;
  run: () => void | Promise<void>;
};

interface TestFrameworkAdapter {
  registerTest(definition: RegisteredTest): void;
}

export type {RegisteredTest, TestFrameworkAdapter};
