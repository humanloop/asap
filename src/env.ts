import { config } from "dotenv";
import { expandHomeDir } from "./utils/path";

const _ENV_PATH = "~/.config/asap.env";

export const ENV_PATH = expandHomeDir(_ENV_PATH);

// Load environment from .env
config({
  path: ENV_PATH,
});

export const HUMANLOOP_BASE_URL = process.env.HUMANLOOP_BASE_URL;
export const HUMANLOOP_API_KEY = process.env.HUMANLOOP_API_KEY;

// console.log("Loaded environment variables:");
// console.log(`HUMANLOOP_BASE_URL: ${HUMANLOOP_BASE_URL}`);
// console.log(`HUMANLOOP_API_KEY: ${HUMANLOOP_API_KEY}`);
