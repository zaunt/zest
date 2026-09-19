import type {TestFrameworkAdapter} from './test-framework-adapter';
import type {
  ScenarioDefinition,
  EachRowDefinition
} from './scenario-definitions';
import {parseScenario} from '../core/internal/parse-scenario';
import {Fact} from '../core/fact';
import {stringCodec} from '../core/codecs';
import {EqualityError} from '../core/internal/equality-error';
import {renderHtml} from '../reporting/html-renderer';
import {writeReport} from '../reporting/file-writer';
import {getConfig} from '../config/zest-config';
import type {Codec} from '../core/codec';
import {collectResults} from '../reporting/scenario-result';
import {runEachRow} from '../core/internal/run-each-row';
import {Context} from '../core/context';

const defaultScenarioName = (markdown: string): string =>
  markdown.replace(/\s+/g, ' ').trim().slice(0, 120) || 'scenario';

const defaultEachRowName = (): string => 'each-row scenario';

const resolveFailFast = (perScenario?: boolean): boolean => {
  if (perScenario !== undefined) {
    return perScenario;
  }
  return getConfig().failFast;
};

const assertResult = (
  returnValue: unknown,
  facts: Fact[],
  resultCodec: Codec<unknown>
): void => {
  if (facts.length === 0) {
    throw new Error(
      'No facts found. Cannot assert a return value without at least one fact.'
    );
  }
  const lastFact = facts[facts.length - 1];
  lastFact.assertEquals(returnValue, resultCodec);
};

const assertResultNoThrow = (
  returnValue: unknown,
  facts: Fact[],
  resultCodec: Codec<unknown>
): void => {
  if (facts.length === 0) {
    throw new Error(
      'No facts found. Cannot assert a return value without at least one fact.'
    );
  }
  const lastFact = facts[facts.length - 1];
  lastFact.assertEqualsNoThrow(returnValue, resultCodec);
};

type ScenarioFn = (definition: ScenarioDefinition) => void;
type EachRowFn = (definition: EachRowDefinition) => void;

type ScenarioApi = {
  scenario: ScenarioFn;
  eachRow: EachRowFn;
};

const createScenarioApi = (adapter: TestFrameworkAdapter): ScenarioApi => {
  const scenario: ScenarioFn = (definition: ScenarioDefinition): void => {
    const name = definition.name ?? defaultScenarioName(definition.markdown);

    adapter.registerTest({
      name,
      async run() {
        const parsed = parseScenario(definition.markdown);

        if (parsed.exhibits.length === 0) {
          throw new Error('Scenario must contain at least one fact or table.');
        }

        const failFast = resolveFailFast(definition.failFast);
        const resultCodec = definition.result ?? stringCodec;

        const context = new Context(
          parsed.exhibits,
          parsed.headings,
          0,
          parsed.exhibits.length
        );

        if (definition.debug) {
          context.debug(true);
        }

        if (failFast) {
          try {
            const returnValue = await definition.execute(context);
            if (returnValue !== undefined) {
              assertResult(returnValue, parsed.facts, resultCodec);
            }
          } finally {
            const html = renderHtml(
              name,
              definition.markdown,
              parsed.tokens,
              parsed.parsedExhibits
            );
            writeReport(name, html, definition.markdown);
          }
        } else {
          let executionError: unknown;
          try {
            const returnValue = await definition.execute(context);
            if (returnValue !== undefined) {
              assertResultNoThrow(returnValue, parsed.facts, resultCodec);
            }
          } catch (error) {
            if (error instanceof EqualityError) {
              // Already recorded in the fact state
            } else {
              executionError = error;
            }
          }

          const result = collectResults(
            name,
            definition.markdown,
            parsed.parsedExhibits
          );
          const html = renderHtml(
            name,
            definition.markdown,
            parsed.tokens,
            parsed.parsedExhibits
          );
          writeReport(name, html, definition.markdown);

          if (executionError) {
            throw executionError as Error;
          }

          if (!result.passed) {
            const message =
              result.failureCount === 1 ?
                `Failure: ${result.firstFailureMessage}`
              : `Found ${result.failureCount} failures. First: ${result.firstFailureMessage}`;
            throw new Error(message);
          }
        }
      }
    });
  };

  const eachRow: EachRowFn = (definition: EachRowDefinition): void => {
    const baseName = definition.name ?? defaultEachRowName();

    let parsed;
    try {
      parsed = parseScenario(definition.markdown);
    } catch (error) {
      adapter.registerTest({
        name: baseName,
        run() {
          throw error;
        }
      });
      return;
    }

    const tableExhibit = parsed.parsedExhibits.find((e) => e.kind === 'table');

    if (!tableExhibit || tableExhibit.kind !== 'table') {
      adapter.registerTest({
        name: baseName,
        run() {
          throw new Error('Expected a table in the scenario.');
        }
      });
      return;
    }

    const table = tableExhibit.table;

    adapter.registerTest({
      name: baseName,
      async run() {
        try {
          await runEachRow(table, {
            expectedColumn: definition.expectedColumn,
            codecs: definition.codecs,
            result: definition.result,
            failFast: definition.failFast,
            execute: definition.execute
          });

          const result = collectResults(
            baseName,
            definition.markdown,
            parsed.parsedExhibits
          );

          if (!result.passed) {
            const message =
              result.failureCount === 1 ?
                `Failure: ${result.firstFailureMessage}`
              : `Found ${result.failureCount} failures. First: ${result.firstFailureMessage}`;
            throw new Error(message);
          }
        } finally {
          const html = renderHtml(
            baseName,
            definition.markdown,
            parsed.tokens,
            parsed.parsedExhibits
          );
          writeReport(baseName, html, definition.markdown);
        }
      }
    });
  };

  return {scenario, eachRow};
};

export {createScenarioApi};
export type {ScenarioApi, ScenarioFn, EachRowFn};
