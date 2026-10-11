// Funcția Vercel pentru panoul de control — logica e în server/admin-api.js
import { adminApiFromEnv } from "../server/admin-api.js";

const api = adminApiFromEnv();
export const GET = (request) => api(request);
export const POST = (request) => api(request);
