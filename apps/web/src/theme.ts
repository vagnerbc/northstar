import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        navy: { value: '#14213d' },
        sand: { value: '#f7f4ed' },
        coral: { value: '#e76f51' },
      },
      fonts: {
        heading: { value: "'DM Sans', system-ui, sans-serif" },
        body: { value: 'Inter, system-ui, sans-serif' },
      },
    },
    semanticTokens: {
      colors: {
        accent: { value: { _light: '{colors.coral}', _dark: '{colors.coral}' } },
        canvas: { value: { _light: '{colors.sand}', _dark: '#111827' } },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
