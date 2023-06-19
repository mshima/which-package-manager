/* eslint-disable @typescript-eslint/naming-convention, n/file-extension-in-import */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: false,
    coverage: {
      '100': true,
    },
  },
});
