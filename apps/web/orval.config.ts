import { defineConfig } from 'orval';

export default defineConfig({
  ecommerce: {
    input: '../../docs/api/openapi.json',
    output: {
      target: './src/generated/api.ts',
      client: 'react-query',
      mode: 'single',
    },
  },
});
