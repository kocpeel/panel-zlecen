import { demoApi } from './demo.js';
import { httpApi } from './http.js';

/* global __DEMO__ */
export const isDemo = __DEMO__;

export const api = isDemo ? demoApi : httpApi;
