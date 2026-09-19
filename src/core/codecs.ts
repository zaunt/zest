import type {Codec} from './codec';

const stringCodec: Codec<string> = {
  parse(text) {
    return {ok: true, value: text};
  },
  format(value) {
    return value;
  }
};

const intCodec: Codec<number> = {
  parse(text) {
    const trimmed = text.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return {ok: false, message: `Expected integer but got '${text}'`};
    }

    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) {
      return {ok: false, message: `Expected safe integer but got '${text}'`};
    }

    return {ok: true, value};
  },
  format(value) {
    return String(value);
  }
};

const floatCodec = (fractionDigits?: number): Codec<number> => ({
  parse(text) {
    const trimmed = text.trim();
    if (trimmed === '') {
      return {ok: false, message: `Expected number but got '${text}'`};
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return {ok: false, message: `Expected number but got '${text}'`};
    }

    return {ok: true, value};
  },
  format(value) {
    return fractionDigits === undefined ?
        String(value)
      : value.toFixed(fractionDigits);
  }
});

const booleanCodec = (
  truthy = 'yes',
  falsy = 'no',
  ignoreCase = true
): Codec<boolean> => ({
  parse(text) {
    const actual = ignoreCase ? text.toLowerCase() : text;
    const expectedTruthy = ignoreCase ? truthy.toLowerCase() : truthy;
    const expectedFalsy = ignoreCase ? falsy.toLowerCase() : falsy;

    if (actual === expectedTruthy) {
      return {ok: true, value: true};
    }
    if (actual === expectedFalsy) {
      return {ok: true, value: false};
    }
    return {
      ok: false,
      message: `Expected '${truthy}' or '${falsy}' but got '${text}'`
    };
  },
  format(value) {
    return value ? truthy : falsy;
  }
});

const enumCodec = <T extends string>(
  values: readonly T[],
  ignoreCase = true
): Codec<T> => ({
  parse(text) {
    const match = values.find((value) =>
      ignoreCase ? value.toLowerCase() === text.toLowerCase() : value === text
    );
    if (!match) {
      return {
        ok: false,
        message: `Expected one of [${values.join(', ')}] but got '${text}'`
      };
    }
    return {ok: true, value: match};
  },
  format(value) {
    return value;
  }
});

const mappedCodec = <T>(
  parseMap: Record<string, T>,
  formatMap: Map<T, string>,
  ignoreCase = true
): Codec<T> => ({
  parse(text) {
    const key = ignoreCase ? text.toLowerCase() : text;
    const normalizedEntries = Object.entries(parseMap).map(
      ([entryKey, value]) =>
        [ignoreCase ? entryKey.toLowerCase() : entryKey, value] as const
    );
    const match = normalizedEntries.find(([entryKey]) => entryKey === key);
    if (!match) {
      return {
        ok: false,
        message: `Expected one of [${Object.keys(parseMap).join(', ')}] but got '${text}'`
      };
    }
    return {ok: true, value: match[1]};
  },
  format(value) {
    const formatted = formatMap.get(value);
    if (formatted === undefined) {
      throw new Error(`No format mapping found for value '${String(value)}'`);
    }
    return formatted;
  }
});

export {
  stringCodec,
  intCodec,
  floatCodec,
  booleanCodec,
  enumCodec,
  mappedCodec
};
