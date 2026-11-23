import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'*.spec.ts',timeout:90000,fullyParallel:false,workers:1,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
 projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:360,height:800}}}],
});
