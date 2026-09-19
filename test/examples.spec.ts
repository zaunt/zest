import {expect} from 'vitest';
import {
  booleanCodec,
  eachRow,
  intCodec,
  scenario
} from '../src/integration/vitest/vitest-scenarios';

// scenario

scenario({
  name: 'Boolean negation',
  markdown: 'The input is `Yes` the output is `No`.',
  execute({facts: [input, output]}) {
    const codec = booleanCodec('Yes', 'No');
    output.assertEquals(!input.as(codec), codec);
  }
});

scenario({
  markdown: `
Input   | Result
--------|--------
bar     | BAR
foo     | FOO
`,
  execute({tables: [table]}) {
    for (const row of table) {
      row.fact('Result').assertEquals(row.value('Input').toUpperCase());
    }
  }
});

scenario({
  markdown: `
Name   | Age
-------|------
Fred   | 35
Wilma  | 33

Input   | Expected
--------|----------
fred    | FRED
wilma   | WILMA

The author is *Betty*.
`,
  execute({facts: [author], tables: [people, testCases]}) {
    const map = people.toMap({Age: intCodec});
    expect(map).toEqual({Fred: 35, Wilma: 33});

    for (const row of testCases) {
      row.fact('Expected').assertEquals(row.value('Input').toUpperCase());
    }

    author.assertEquals('Betty');
  }
});

// eachRow

eachRow({
  name: 'uppercasing',
  markdown: `
Input      | Expected Output
-----------|----------------
a          | A
abc        | ABC
An example | AN EXAMPLE
`,
  execute(input) {
    return input.asString().toUpperCase();
  }
});

eachRow({
  markdown: `
A   | B   | Sum | Notes
----|-----|-----|------
1   | 2   | 3   | simple
10  | 20  | 30  | tens
`,
  expectedColumn: 'Sum',
  codecs: {A: intCodec, B: intCodec, Sum: intCodec},
  result: intCodec,
  execute(a, b) {
    return a.asInt() + b.asInt();
  }
});
