import { Command } from "@commander-js/extra-typings";
import { input, confirm, select } from "@inquirer/prompts";
import { ENV_PATH } from "../env";
import fs from "node:fs";
import path from "node:path";

type HumanloopEnvironmentName = "staging" | "production";

type HumanloopEnvironment = {
  name: HumanloopEnvironmentName;
  baseUrl: string;
  appUrl: string;
};

const HUMANLOOP_ENVIRONMENTS: HumanloopEnvironment[] = [
  {
    name: "production",
    baseUrl: "https://api.humanloop.com/v4",
    appUrl: "https://app.humanloop.com",
  },
  {
    name: "staging",
    baseUrl: "https://neostaging.humanloop.ml/v4",
    appUrl: "https://stg.humanloop.com",
  },
];

export const initCommand = new Command("init")
  .description("set up your `asap` installation")
  .option("-d, --dev", "Ask for more options to support `asap` development.")
  .action(async (opts) => {
    // Create ENV_PATH if it does not exist
    if (!fs.existsSync(ENV_PATH)) {
      const continue_ = await confirm({
        message: `This will create a file at ${ENV_PATH}. Continue?`,
      });
      if (continue_) {
        // Create parent path if it does not exist
        const parentDirName = path.dirname(ENV_PATH);
        if (!fs.existsSync(parentDirName)) {
          fs.mkdirSync(parentDirName, { recursive: true });
        }
        fs.writeFileSync(ENV_PATH, "");
      } else {
        console.log("Aborting.");
        process.exit(1);
      }
    } else {
      const continue_ = await confirm({
        message: `This will overwrite the file at ${ENV_PATH}. Continue?`,
      });
      if (!continue_) {
        console.log("Aborting.");
        process.exit(1);
      }
    }

    // Ask for environment name
    const environmentName = opts.dev
      ? await select({
          message: "Which Humanloop environment are you using?",
          choices: [{ value: "production" }, { value: "staging" }] as const,
        })
      : "production";
    const environment = HUMANLOOP_ENVIRONMENTS.find(
      (e) => e.name === environmentName
    );
    if (environment === undefined) {
      throw new Error(`unknown environment '${environmentName}'`);
    }

    // Ask for Humanloop API key
    const humanloopApiKey = await input({
      message: `Enter your Humanloop API key? This can be retrieved from ${environment.appUrl}/account/api-keys.`,
    });

    // Write to ENV_PATH
    fs.writeFileSync(
      ENV_PATH,
      `HUMANLOOP_BASE_URL=${environment.baseUrl}\nHUMANLOOP_API_KEY=${humanloopApiKey}\n`
    );

    console.log(`Wrote to ${ENV_PATH}. 🎉`);
  });
