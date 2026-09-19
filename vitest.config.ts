import {defineConfig} from 'vitest/config';
import fs from 'fs';

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  plugins: [
    {
      name: 'raw-md',
      transform(_, id) {
        if (id.endsWith('.md')) {
          const content = fs.readFileSync(id, 'utf-8');
          return {code: `export default ${JSON.stringify(content)};`};
        } else {
          return undefined;
        }
      }
    }
  ],
  test: {}
});
