import {scenario, eachRow, floatCodec} from '../../src/index';

eachRow({
  name: 'floatCodec parses valid float strings',
  markdown: `
Input          | Expected
---------------|----------
0              | 0
1              | 1
-1             | -1
3.14           | 3.14
-2.5           | -2.5
0.001          | 0.001
100.0          | 100
1e3            | 1000
2.5e2          | 250
-1.5e-1        | -0.15
.5             | 0.5
`,
  codecs: {Expected: floatCodec()},
  result: floatCodec(),
  execute(input) {
    const result = floatCodec().parse(input.asString());
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.value;
  }
});

eachRow({
  name: 'floatCodec rejects invalid strings',
  markdown: `
Input          | Expected Error
---------------|--------------------------------------
abc            | Expected number but got 'abc'
               | Expected number but got ''
hello world    | Expected number but got 'hello world'
NaN            | Expected number but got 'NaN'
`,
  execute(input) {
    const result = floatCodec().parse(input.asString());
    if (result.ok) {
      throw new Error(
        `Expected parse failure for '${input.asString()}' but got ${result.value}`
      );
    }
    return result.message;
  }
});

eachRow({
  name: 'floatCodec formats without fractionDigits',
  markdown: `
Value    | Expected
---------|----------
0        | 0
1        | 1
-1       | -1
3.14     | 3.14
100      | 100
0.001    | 0.001
0.1      | 0.1
-2.5     | -2.5
`,
  codecs: {Value: floatCodec()},
  execute(value) {
    return floatCodec().format(value.as(floatCodec()));
  }
});

eachRow({
  name: 'floatCodec formats with fractionDigits',
  markdown: `
Value    | Digits | Expected
---------|--------|----------
3.14159  | 2      | 3.14
3.14159  | 0      | 3
3.14159  | 4      | 3.1416
1        | 3      | 1.000
0.1      | 5      | 0.10000
-2.5     | 1      | -2.5
-2.5     | 0      | -3
0        | 2      | 0.00
`,
  execute(value, digits) {
    const codec = floatCodec(digits.asInt());
    return codec.format(value.as(floatCodec()));
  }
});

scenario({
  name: 'floatCodec roundtrips: parse then format recovers original text',
  markdown: `
Values that survive a parse-then-format roundtrip without fractionDigits:

Input   | Expected
--------|----------
0       | 0
1.5     | 1.5
-3.25   | -3.25
100     | 100

Values that survive a parse-then-format roundtrip with fractionDigits 2:

Input   | Expected
--------|----------
0       | 0.00
1.5     | 1.50
-3.25   | -3.25
100     | 100.00
`,
  async execute({tables: [withoutDigits, withDigits]}) {
    await withoutDigits.eachRow({
      execute(input) {
        const codec = floatCodec();
        const parsed = codec.parse(input.asString());
        if (!parsed.ok) {
          throw new Error(parsed.message);
        }
        return codec.format(parsed.value);
      }
    });

    await withDigits.eachRow({
      execute(input) {
        const codec = floatCodec(2);
        const parsed = codec.parse(input.asString());
        if (!parsed.ok) {
          throw new Error(parsed.message);
        }
        return codec.format(parsed.value);
      }
    });
  }
});
