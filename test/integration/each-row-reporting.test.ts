import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {existsSync, readFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createScenarioApi} from '../../src/integration/scenario-api';
import type {
  RegisteredTest,
  TestFrameworkAdapter
} from '../../src/integration/test-framework-adapter';
import {setConfig} from '../../src/config/zest-config';

class RecordingAdapter implements TestFrameworkAdapter {
  readonly registered: RegisteredTest[] = [];

  registerTest(definition: RegisteredTest): void {
    this.registered.push(definition);
  }
}

describe('eachRow report generation on failure', () => {
  const testOutputDir = join(
    tmpdir(),
    `zest-test-output-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  beforeEach(() => {
    setConfig({outputDir: testOutputDir, outputEnabled: true});
  });

  afterEach(() => {
    rmSync(testOutputDir, {recursive: true, force: true});
  });

  it('generates the report when multiple rows fail with failFast false', async () => {
    const adapter = new RecordingAdapter();
    const {eachRow} = createScenarioApi(adapter);

    eachRow({
      name: 'multiple row failures report test',
      markdown: `
Input | Expected
------|---------
alpha | ALPHA
beta  | BETA
gamma | GAMMA
`,
      failFast: false,
      execute(input) {
        return input.asString();
      }
    });

    const registeredTest = adapter.registered[0];
    await expect(registeredTest.run()).rejects.toThrow(
      "Found 3 failures. First: Expected 'ALPHA' but got 'alpha'"
    );

    const reportPath = join(
      testOutputDir,
      'multiple_row_failures_report_test.html'
    );
    expect(existsSync(reportPath)).toBe(true);

    const html = readFileSync(reportPath, 'utf-8');
    expect(html).toContain('class="FAILURE"');
    expect(html).toContain('<del>ALPHA</del><ins>alpha</ins>');
    expect(html).toContain('<del>BETA</del><ins>beta</ins>');
    expect(html).toContain('<del>GAMMA</del><ins>gamma</ins>');
  });

  it('generates the report when a row fails with failFast true', async () => {
    const adapter = new RecordingAdapter();
    const {eachRow} = createScenarioApi(adapter);

    eachRow({
      name: 'fail fast row report test',
      markdown: `
Input | Expected
------|---------
alpha | WRONG
beta  | BETA
`,
      failFast: true,
      execute(input) {
        return input.asString().toUpperCase();
      }
    });

    const registeredTest = adapter.registered[0];
    await expect(registeredTest.run()).rejects.toThrow(
      "Expected 'WRONG' but got 'ALPHA'"
    );

    const reportPath = join(testOutputDir, 'fail_fast_row_report_test.html');
    expect(existsSync(reportPath)).toBe(true);

    const html = readFileSync(reportPath, 'utf-8');
    expect(html).toContain('class="FAILURE"');
    expect(html).toContain('<del>WRONG</del><ins>ALPHA</ins>');
  });
});
