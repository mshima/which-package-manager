/* eslint-disable @typescript-eslint/naming-convention */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: false,
    coverage: {
      '100': true,
    },
  },
});
