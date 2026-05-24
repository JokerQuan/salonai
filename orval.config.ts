import { defineConfig } from 'orval';

export default defineConfig({
  salonai: {
    input: 'http://localhost:3000/openapi.json',
    output: {
      mode: 'split',
      target: 'packages/api-client/src/generated/salonai.ts',
      schemas: 'packages/api-client/src/generated/model',
      client: 'react-query',
      clean: true,
      override: {
        mutator: {
          path: './packages/api-client/src/fetcher.ts',
          name: 'salonaiFetch',
        },
      },
    },
  },
});
