import type {Codec} from '../codec';
import {stringCodec} from '../codecs';
import {Fact} from '../fact';
import {Table} from '../table';
import {EqualityError} from './equality-error';
import {getConfig} from '../../config/zest-config';

type RunEachRowOptions = {
  expectedColumn?: string | undefined;
  codecs?: Record<string, Codec<unknown>> | undefined;
  result?: Codec<unknown> | undefined;
  failFast?: boolean | undefined;
  execute: (...facts: Fact[]) => unknown;
};

const resolveFailFast = (perCall?: boolean): boolean => {
  if (perCall !== undefined) {
    return perCall;
  }
  return getConfig().failFast;
};

const runEachRow = async (
  table: Table,
  options: RunEachRowOptions
): Promise<void> => {
  const failFast = resolveFailFast(options.failFast);
  const resultCodec = options.result ?? stringCodec;
  const expectedColumn =
    options.expectedColumn ?? table.headers[table.headers.length - 1];
  const codecs = options.codecs ?? {};

  let stopped = false;
  const errors: Error[] = [];

  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex++) {
    if (stopped) {
      break;
    }

    const row = table.row(rowIndex);
    const columnFacts: Fact[] = [];
    for (const header of table.headers) {
      columnFacts.push(row.fact(header));
    }

    try {
      const returnValue = await options.execute(...columnFacts);

      if (returnValue !== undefined) {
        const expectedFact = row.fact(expectedColumn);
        const codec = codecs[expectedColumn] ?? resultCodec;
        if (failFast) {
          expectedFact.assertEquals(returnValue, codec);
        } else {
          expectedFact.assertEqualsNoThrow(returnValue, codec);
        }
      }
    } catch (error) {
      if (error instanceof EqualityError) {
        errors.push(error);
        if (failFast) {
          stopped = true;
        }
      } else if (error instanceof Error) {
        errors.push(error);
        if (failFast) {
          stopped = true;
        }
      }
    }
  }

  if (errors.length === 1) {
    throw errors[0];
  } else if (errors.length > 1) {
    const first = errors[0];
    const message = `Found ${errors.length} failures. First: ${first.message}`;
    const summary = new Error(message);
    if (first instanceof EqualityError) {
      Object.assign(summary, {expected: first.expected, actual: first.actual});
    }
    throw summary;
  }
};

export {runEachRow};
export type {RunEachRowOptions};
