import type {Codec} from './codec';
import {Fact} from './fact';
import {FactState} from './fact-state';
import {Row} from './row';
import type {RunEachRowOptions} from './internal/run-each-row';
import {runEachRow} from './internal/run-each-row';

type TableEachRowOptions = {
  expectedColumn?: string;
  codecs?: Record<string, Codec<unknown>>;
  result?: Codec<unknown>;
  failFast?: boolean;
  execute: (...facts: Fact[]) => unknown;
};

class Table implements Iterable<Row> {
  readonly kind = 'table';

  private readonly _headerFacts: Fact[];
  private readonly _cellFacts: Fact[][];

  constructor(
    private readonly _headers: string[],
    private readonly _rows: string[][]
  ) {
    this._headerFacts = _headers.map((h) => new Fact(h));
    this._cellFacts = _rows.map((row) => row.map((cell) => new Fact(cell)));
  }

  get headers(): readonly string[] {
    return this._headers;
  }

  get columnCount(): number {
    return this._headers.length;
  }

  get rowCount(): number {
    return this._rows.length;
  }

  [Symbol.iterator](): Iterator<Row> {
    let index = 0;
    return {
      next: (): IteratorResult<Row> => {
        if (index >= this._rows.length) {
          return {done: true, value: undefined as never};
        }
        const row = this._createRow(index);
        index += 1;
        return {done: false, value: row};
      }
    };
  }

  row(index: number): Row {
    if (index < 0 || index >= this._rows.length) {
      throw new Error(`Row ${index} does not exist.`);
    }
    return this._createRow(index);
  }

  cell(col: number, row: number): Fact {
    if (col < 0 || col >= this._headers.length) {
      throw new Error(`Column ${col} does not exist.`);
    }
    if (row === 0) {
      return this._headerFacts[col];
    }
    const bodyRow = row - 1;
    if (bodyRow < 0 || bodyRow >= this._rows.length) {
      throw new Error(`Row ${row} does not exist.`);
    }
    return this._cellFacts[bodyRow][col];
  }

  eachRow(
    executeOrOptions: ((...facts: Fact[]) => unknown) | TableEachRowOptions
  ): Promise<void> {
    const options: RunEachRowOptions =
      typeof executeOrOptions === 'function' ?
        {execute: executeOrOptions}
      : executeOrOptions;
    return runEachRow(this, options);
  }

  toMap(): Record<string, string>;
  toMap(codecs: Record<string, Codec<unknown>>): Record<string, unknown>;
  toMap(
    codecs?: Record<string, Codec<unknown>>
  ): Record<string, string> | Record<string, unknown> {
    const seen = new Set<string>();

    if (this._headers.length === 2 && !codecs) {
      const result: Record<string, string> = {};
      for (const row of this._rows) {
        const key = row[0];
        if (seen.has(key)) {
          throw new Error(`Duplicate key '${key}'.`);
        }
        seen.add(key);
        result[key] = row[1];
      }
      return result;
    }

    if (this._headers.length === 2 && codecs) {
      const valueColumn = this._headers[1];
      const codec = codecs[valueColumn];
      const result: Record<string, unknown> = {};
      for (const row of this._rows) {
        const key = row[0];
        if (seen.has(key)) {
          throw new Error(`Duplicate key '${key}'.`);
        }
        seen.add(key);
        const raw = row[1];
        if (codec) {
          const parsed = codec.parse(raw);
          if (!parsed.ok) {
            throw new Error(parsed.message);
          }
          result[key] = parsed.value;
        } else {
          result[key] = raw;
        }
      }
      return result;
    }

    const result: Record<string, Record<string, unknown>> = {};
    for (let rowIndex = 0; rowIndex < this._rows.length; rowIndex++) {
      const row = this._rows[rowIndex];
      const key = row[0];
      if (seen.has(key)) {
        throw new Error(`Duplicate key '${key}'.`);
      }
      seen.add(key);

      const obj: Record<string, unknown> = {};
      for (let colIndex = 1; colIndex < this._headers.length; colIndex++) {
        const header = this._headers[colIndex];
        const raw = row[colIndex] ?? '';
        const codec = codecs?.[header];
        if (codec) {
          const parsed = codec.parse(raw);
          if (!parsed.ok) {
            throw new Error(parsed.message);
          }
          obj[header] = parsed.value;
        } else {
          obj[header] = raw;
        }
      }
      result[key] = obj;
    }
    return result;
  }

  toRecords(): Record<string, string>[];
  toRecords(codecs: Record<string, Codec<unknown>>): Record<string, unknown>[];
  toRecords(
    codecs?: Record<string, Codec<unknown>>
  ): Record<string, string>[] | Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    for (const row of this._rows) {
      const obj: Record<string, unknown> = {};
      for (let colIndex = 0; colIndex < this._headers.length; colIndex++) {
        const header = this._headers[colIndex];
        const raw = row[colIndex] ?? '';
        const codec = codecs?.[header];
        if (codec) {
          const parsed = codec.parse(raw);
          if (!parsed.ok) {
            throw new Error(parsed.message);
          }
          obj[header] = parsed.value;
        } else {
          obj[header] = raw;
        }
      }
      results.push(obj);
    }
    return results;
  }

  get state(): FactState {
    let hasFailure = false;
    let hasNotChecked = false;
    let hasSuccess = false;

    for (const headerFact of this._headerFacts) {
      const s = headerFact.state;
      if (s === FactState.FAILURE) {
        hasFailure = true;
      }
      if (s === FactState.NOT_CHECKED) {
        hasNotChecked = true;
      }
      if (s === FactState.SUCCESS) {
        hasSuccess = true;
      }
    }

    for (const rowFacts of this._cellFacts) {
      for (const cellFact of rowFacts) {
        const s = cellFact.state;
        if (s === FactState.FAILURE) {
          hasFailure = true;
        }
        if (s === FactState.NOT_CHECKED) {
          hasNotChecked = true;
        }
        if (s === FactState.SUCCESS) {
          hasSuccess = true;
        }
      }
    }

    if (hasFailure) {
      return FactState.FAILURE;
    }
    if (hasSuccess) {
      return FactState.SUCCESS;
    }
    if (hasNotChecked) {
      return FactState.NOT_CHECKED;
    }
    return FactState.NOT_USED;
  }

  /** @internal */
  get headerFacts(): readonly Fact[] {
    return this._headerFacts;
  }

  /** @internal */
  get cellFacts(): readonly (readonly Fact[])[] {
    return this._cellFacts;
  }

  private _createRow(index: number): Row {
    return new Row(this._headers, this._cellFacts[index]);
  }
}

export {Table};
export type {TableEachRowOptions};
