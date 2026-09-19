import {
  scenario,
  eachRow,
  stringCodec,
  floatCodec,
  booleanCodec
} from '../src/integration/vitest/vitest-scenarios';

scenario({
  markdown: 'The input is `12`',
  execute({facts: [input]}) {
    if (input.asInt() !== 12) {
      throw new Error(`Expected 12 but got ${input.asInt()}`);
    }
  }
});

scenario({
  name: 'Boolean negation',
  markdown: 'The input is `Yes` the output is `No`.',
  execute({facts: [input, output]}) {
    const codec = booleanCodec('Yes', 'No');
    const result = !input.as(codec);
    output.assertEquals(result, codec);
  }
});

scenario({
  markdown: 'The result is `12.30`.',
  result: floatCodec(2),
  execute() {
    return 12.3;
  }
});

scenario({
  markdown: 'When made uppercase `fred` becomes `FRED`.',
  execute({facts: [input]}) {
    return input.asString().toUpperCase();
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

eachRow({
  name: 'uppercasing',
  markdown: `
Input      | Expected Output
-----------|----------------
a          | A
abc        | ABC
abC        | ABC
Abc        | ABC
An example | AN EXAMPLE
`,
  execute(input) {
    return input.asString().toUpperCase();
  }
});

eachRow({
  markdown: `
Input      | Expected Output
-----------|----------------
hello      | HELLO
world      | WORLD
`,
  execute(input) {
    return input.asString().toUpperCase();
  }
});

scenario({
  markdown: `
Input      | Expected Output | Something else
-----------|-----------------|---------------
a          | A               | Fred
abc        | ABC             | Bloggs
abC        | ABC             |
Abc        | ABC             |
An example | AN EXAMPLE      |

This is a \`penultimate idea\`.
This is a \`final idea\`.
`,
  async execute({facts: [penultimateFact, finalFact], tables: [table]}) {
    for (const row of table) {
      const actual = row.value('Input').toUpperCase();
      row.fact('Expected Output').assertEquals(actual, stringCodec);
    }

    penultimateFact.assertEquals('penultimate idea');
    finalFact.assertEquals('final idea');
  }
});
