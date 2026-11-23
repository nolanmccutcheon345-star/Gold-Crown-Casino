import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/step5b-resource/timer-lifecycle.test.ts'],testTimeout:20000,pool:'forks',poolOptions:{forks:{singleFork:true,execArgv:['--cpu-prof','--cpu-prof-dir=tests/step5e-independent/evidence/timer-cpu-before']}}}});
