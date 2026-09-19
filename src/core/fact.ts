import type {Codec} from './codec';
import {stringCodec, intCodec} from './codecs';
import {FactState} from './fact-state';
import {EqualityError} from './internal/equality-error';

const trimBlankLines = (text: string): string => {
  const lines = text.split('\n');
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') {
    start++;
  }
  let end = lines.length - 1;
  while (end > start && lines[end].trim() === '') {
    end--;
  }
  return lines.slice(start, end + 1).join('\n');
};

type FactMetadata = {language?: string} & Record<string, string>;

class Fact {
  readonly kind = 'fact';

  private _state: FactState = FactState.NOT_USED;
  private _actualText: string | undefined;

  constructor(
    private readonly _raw: string,
    private readonly _metadata: FactMetadata = {}
  ) {
    this._raw = trimBlankLines(_raw);
  }

  get raw(): string {
    return this._raw;
  }

  get metadata(): FactMetadata {
    return this._metadata;
  }

  get state(): FactState {
    return this._state;
  }

  get actualText(): string | undefined {
    return this._actualText;
  }

  private markChecked(): void {
    if (this._state === FactState.NOT_USED) {
      this._state = FactState.NOT_CHECKED;
    }
  }

  private assertNotYetChecked(): void {
    if (
      this._state === FactState.SUCCESS ||
      this._state === FactState.FAILURE
    ) {
      throw new Error('The fact has already been checked.');
    }
  }

  asString(): string {
    this.markChecked();
    return this._raw;
  }

  asInt(): number {
    return this.as(intCodec);
  }

  as<T>(codec: Codec<T>): T {
    this.markChecked();
    const result = codec.parse(this._raw);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.value;
  }

  assertEquals(actual: string): void;
  assertEquals<T>(actual: T, codec: Codec<T>): void;
  assertEquals<T>(actual: T, codec?: Codec<T>): void {
    this.assertNotYetChecked();

    const effectiveCodec = (codec ?? stringCodec) as Codec<T>;
    const expected = this.as(effectiveCodec);
    const expectedText = effectiveCodec.format(expected);
    const actualText = effectiveCodec.format(actual);
    this._actualText = actualText;

    if (actualText === expectedText) {
      this._state = FactState.SUCCESS;
    } else {
      this._state = FactState.FAILURE;
      throw new EqualityError(expectedText, actualText);
    }
  }

  assertEqualsNoThrow(actual: string): void;
  assertEqualsNoThrow<T>(actual: T, codec: Codec<T>): void;
  assertEqualsNoThrow<T>(actual: T, codec?: Codec<T>): void {
    this.assertNotYetChecked();

    const effectiveCodec = (codec ?? stringCodec) as Codec<T>;
    const expected = this.as(effectiveCodec);
    const expectedText = effectiveCodec.format(expected);
    const actualText = effectiveCodec.format(actual);
    this._actualText = actualText;

    if (actualText === expectedText) {
      this._state = FactState.SUCCESS;
    } else {
      this._state = FactState.FAILURE;
    }
  }
}

export {Fact, trimBlankLines};
export type {FactMetadata};
