import {defineConfig} from 'vitest/config';
// Resource-heavy archive/range fixtures share the same constrained runner.
// Serialize files rather than relaxing their existing correctness time limits.
export default defineConfig({test:{include:['tests/**/*.test.ts'],exclude:['tests/browser/**'],testTimeout:20000,maxWorkers:1,fileParallelism:false}});
