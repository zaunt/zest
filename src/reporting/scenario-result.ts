import {FactState} from '../core/fact-state';
import type {ParsedExhibit} from '../core/internal/parse-scenario';

type ScenarioResult = {
  name: string;
  markdown: string;
  passed: boolean;
  failureCount: number;
  firstFailureMessage?: string | undefined;
};

const collectResults = (
  name: string,
  markdown: string,
  exhibits: ParsedExhibit[]
): ScenarioResult => {
  let failureCount = 0;
  let firstFailureMessage: string | undefined;

  const recordFailure = (
    raw: string | undefined,
    actualText: string | undefined
  ): void => {
    failureCount += 1;
    if (!firstFailureMessage && raw !== undefined) {
      firstFailureMessage = `Expected '${raw}' but got '${actualText}'`;
    }
  };

  for (const exhibit of exhibits) {
    if (exhibit.kind === 'fact') {
      if (exhibit.fact.state === FactState.FAILURE) {
        recordFailure(exhibit.fact.raw, exhibit.fact.actualText);
      }
    } else {
      for (const headerFact of exhibit.table.headerFacts) {
        if (headerFact.state === FactState.FAILURE) {
          recordFailure(headerFact.raw, headerFact.actualText);
        }
      }
      for (const cellRow of exhibit.table.cellFacts) {
        for (const cellFact of cellRow) {
          if (cellFact.state === FactState.FAILURE) {
            recordFailure(cellFact.raw, cellFact.actualText);
          }
        }
      }
    }
  }

  return {
    name,
    markdown,
    passed: failureCount === 0,
    failureCount,
    firstFailureMessage
  };
};

export {collectResults};
export type {ScenarioResult};
