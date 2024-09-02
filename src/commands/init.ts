import { Command } from "@commander-js/extra-typings";
import { input, confirm, select } from "@inquirer/prompts";
import { ENV_PATH } from "../env";
import fs from "node:fs";
import path from "node:path";
import { HumanloopClient } from "humanloop";
import { PromptResponse } from "humanloop/api";

type HumanloopEnvironmentName = "staging" | "production";

type HumanloopEnvironment = {
  name: HumanloopEnvironmentName;
  baseUrl: string;
  appUrl: string;
};

const HUMANLOOP_ENVIRONMENTS: HumanloopEnvironment[] = [
  {
    name: "production",
    baseUrl: "https://api.humanloop.com/v5",
    appUrl: "https://app.humanloop.com",
  },
  {
    name: "staging",
    baseUrl: "https://neostaging.humanloop.ml/v5",
    appUrl: "https://stg.humanloop.com",
  },
];
const OPENAI_API_KEY_URL = "https://platform.openai.com/account/api-keys";

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
      message: `Enter your Humanloop API key. This can be retrieved from ${environment.appUrl}/account/api-keys.`,
    });

    // Ask for OpenAI API key
    const openaiApiKey = await input({
      message: `Enter your OpenAI API key. This can be retrieved from ${OPENAI_API_KEY_URL}. Your key will only be stored locally on this machine.`,
    });

    // Write to ENV_PATH
    fs.writeFileSync(
      ENV_PATH,
      `HUMANLOOP_BASE_URL=${environment.baseUrl}\nHUMANLOOP_API_KEY=${humanloopApiKey}\nOPENAI_API_KEY=${openaiApiKey}\n`
    );

    console.log(`Wrote to ${ENV_PATH}. 🎉`);

    // Ensure the Humanloop account contains the relevant projects and model configs.
    await ensureHumanloopAsapProjects(environment.baseUrl, humanloopApiKey);
  });

const ensureHumanloopAsapProjects = async (
  humanloopBaseUrl: string,
  humanloopApiKey: string
): Promise<string> => {
  // Create the Humanloop client.
  const humanloop = new HumanloopClient({
    environment: humanloopBaseUrl,
    apiKey: humanloopApiKey,
  });

  let page = 1;
  let asapPrompt: PromptResponse | undefined = undefined;
  let asapPathExecutablesPrompt: PromptResponse | undefined = undefined;

  console.log("Searching for asap and asap-path-executables prompt...");

  const promptsResponse = await humanloop.prompts.list({
    page,
    name: "asap",
  });

  const maybeAsapPrompt = promptsResponse.data.find(
    (prompt) => prompt.name === "asap"
  );

  const maybeAsapPathExecutablesPrompt = promptsResponse.data.find(
    (prompt) => prompt.name === "asap-path-executables"
  );

  if (maybeAsapPrompt !== undefined) {
    console.log("Found asap prompt");

    asapPrompt = maybeAsapPrompt;
  }

  if (maybeAsapPathExecutablesPrompt !== undefined) {
    console.log("Found asap-path-executables project");
    asapPathExecutablesPrompt = maybeAsapPathExecutablesPrompt;
  }

  // Create the `asap` project if it does not exist.
  if (asapPrompt === undefined) {
    console.log("No asap prompt found. Creating...");
    const asapPromptCreationParameters = JSON.parse(
      fs.readFileSync("prompts/asap-prompt.json").toString()
    );
    const asapProjectCreationResponse = await humanloop.prompts.upsert({
      path: "asap",
      ...asapPromptCreationParameters,
    });
    asapPrompt = asapProjectCreationResponse;
    console.log("Created asap prompt");
  }

  // Create the `asap-path-executables` project if it does not exist.
  if (asapPathExecutablesPrompt === undefined) {
    console.log("No asap-path-executables prompt found. Creating...");
    const asapPathExecutablesPromptCreationParameters = JSON.parse(
      fs.readFileSync("prompts/asap-path-exec-prompt.json").toString()
    );
    const asapPathExecutablesPromptCreationResponse =
      await humanloop.prompts.upsert({
        path: "asap-path-executables",
        ...asapPathExecutablesPromptCreationParameters,
      });
    asapPathExecutablesPrompt = asapPathExecutablesPromptCreationResponse;
    console.log("Created asap-path-executables prompt");
  }

  return "1";
};
