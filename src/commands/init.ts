import { Command } from "@commander-js/extra-typings";
import { input, confirm, select } from "@inquirer/prompts";
import { ENV_PATH } from "../env";
import { Humanloop, ProjectResponse } from "humanloop";
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
  const humanloop = new Humanloop({
    basePath: humanloopBaseUrl,
    apiKey: humanloopApiKey,
  });

  // Iterate the paginated list of projects until a project called `asap` is found.
  let page = 0;
  let totalProjects;
  let searchedProjects = 0;
  let asapProject: ProjectResponse | undefined = undefined;
  let asapPathExecutablesProject: ProjectResponse | undefined = undefined;

  console.log("Searching for asap and asap-path-executables projects...");

  while (true) {
    const projectsResponse = await humanloop.projects.list({
      page,
      filter: "asap",
    });

    totalProjects = projectsResponse.data.total;
    searchedProjects += projectsResponse.data.records.length;

    if (totalProjects === undefined) {
      // Just in case something has gone wrong.
      throw new Error(
        "total number of projects unknown; exiting to avoid infinite loop"
      );
    }

    const maybeAsapProject = projectsResponse.data.records.find(
      (project) => project.name === "asap"
    );

    const maybeAsapPathExecutablesProject = projectsResponse.data.records.find(
      (project) => project.name === "asap-path-executables"
    );

    if (maybeAsapProject !== undefined) {
      console.log("Found asap project");

      asapProject = maybeAsapProject;
    }

    if (maybeAsapPathExecutablesProject !== undefined) {
      console.log("Found asap-path-executables project");
      asapPathExecutablesProject = maybeAsapPathExecutablesProject;
    }

    if (
      searchedProjects >= totalProjects ||
      (asapProject !== undefined && asapPathExecutablesProject !== undefined)
    ) {
      break;
    }

    page += 1;
  }

  // Create the `asap` project if it does not exist.
  if (asapProject === undefined) {
    console.log("No asap project found. Creating...");
    const asapProjectCreationResponse = await humanloop.projects.create({
      name: "asap",
    });
    asapProject = asapProjectCreationResponse.data;
    console.log("Created asap project");

    // Register the `asap` model config.
    await registerAsapModelConfig(humanloop, asapProject);
  } else {
    console.log("Found asap project");

    // Check that the `asap` project has a model config.
    // If there is any active_config, we assume it is the correct one.
    if (asapProject.active_config === undefined) {
      // Register the `asap` model config.
      await registerAsapModelConfig(humanloop, asapProject);
    }
  }

  // Create the `asap-path-executables` project if it does not exist.
  if (asapPathExecutablesProject === undefined) {
    console.log("No asap-path-executables project found. Creating...");
    const asapPathExecutablesProjectCreationResponse =
      await humanloop.projects.create({
        name: "asap-path-executables",
      });
    asapPathExecutablesProject =
      asapPathExecutablesProjectCreationResponse.data;
    console.log("Created asap-path-executables project");

    // Register the `asap-path-executables` model config.
    await registerAsapPathExecutablesModelConfig(
      humanloop,
      asapPathExecutablesProject
    );
  } else {
    console.log(
      JSON.stringify(asapPathExecutablesProject.active_config, null, 2)
    );

    console.log("Found asap-path-executables project");

    // Check that the `asap-path-executables` project has a model config.
    // If there is any active_config, we assume it is the correct one.
    if (asapPathExecutablesProject.active_config === undefined) {
      // Register the `asap-path-executables` model config.
      await registerAsapPathExecutablesModelConfig(
        humanloop,
        asapPathExecutablesProject
      );
    }
  }

  return "1";
};

const registerAsapModelConfig = async (
  humanloop: Humanloop,
  asapProject: ProjectResponse
) => {
  // Read the model config from file `asap-model-config.json`.
  const modelConfig = JSON.parse(
    fs.readFileSync("model-configs/asap-model-config.json").toString()
  );

  // Register the model config for the `asap` project.
  console.log("Registering model config to asap project...");
  const registeredModelConfig = await humanloop.modelConfigs.register({
    project_id: asapProject.id,
    ...modelConfig,
  });

  if (registeredModelConfig.status !== 200) {
    throw new Error(`failed to register model config for asap project.`);
  }
};

const registerAsapPathExecutablesModelConfig = async (
  humanloop: Humanloop,
  asapPathExecutablesProject: ProjectResponse
) => {
  // Read the model config from file `asap-path-exec-model-config.json`.
  const modelConfig = JSON.parse(
    fs.readFileSync("model-configs/asap-path-exec-model-config.json").toString()
  );

  // Register the model config for the `asap` project.
  console.log("Registering model config to asap-path-executables project...");
  const registeredModelConfig = await humanloop.modelConfigs.register({
    project_id: asapPathExecutablesProject.id,
    ...modelConfig,
  });

  if (registeredModelConfig.status !== 200) {
    throw new Error(
      `failed to register model config for asap-path-executables project.`
    );
  }
};
