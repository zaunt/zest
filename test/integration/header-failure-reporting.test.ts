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

describe('table header failure reporting', () => {
  const testOutputDir = join(
    tmpdir(),
    `zest-header-tests-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  beforeEach(() => {
    setConfig({outputDir: testOutputDir, outputEnabled: true});
  });

  afterEach(() => {
    rmSync(testOutputDir, {recursive: true, force: true});
  });

  it('fails a scenario when a table header assertion fails with failFast false', async () => {
    const adapter = new RecordingAdapter();
    const {scenario} = createScenarioApi(adapter);

    scenario({
      name: 'header failure scenario',
      markdown: `
Expected Header | Value
----------------|------
row-data        | 123
`,
      failFast: false,
      execute({tables: [table]}) {
        const headerCell = table.cell(0, 0);
        headerCell.assertEquals('Actual Header');
      }
    });

    const registeredTest = adapter.registered[0];
    await expect(registeredTest.run()).rejects.toThrow(
      "Failure: Expected 'Expected Header' but got 'Actual Header'"
    );

    const reportPath = join(testOutputDir, 'header_failure_scenario.html');
    expect(existsSync(reportPath)).toBe(true);

    const html = readFileSync(reportPath, 'utf-8');
    expect(html).toContain(
      '<th class="FAILURE"><del>Expected Header</del><ins>Actual Header</ins></th>'
    );
  });

  it('aggregates failures across both headers and body cells', async () => {
    const adapter = new RecordingAdapter();
    const {scenario} = createScenarioApi(adapter);

    scenario({
      name: 'header and cell failures scenario',
      markdown: `
ColA | ColB
-----|-----
val1 | val2
`,
      failFast: false,
      execute({tables: [table]}) {
        table.cell(0, 0).assertEquals('WrongHeader');
        table.cell(0, 1).assertEquals('WrongCell');
      }
    });

    const registeredTest = adapter.registered[0];
    await expect(registeredTest.run()).rejects.toThrow(
      "Failure: Expected 'ColA' but got 'WrongHeader'"
    );
  });
});
