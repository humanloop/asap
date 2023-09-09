import chalk from "chalk";
import { ShellCommandOutput } from "../llm";
import { Patch } from "./patch";

export const logAssistant = (message: string) => {
  console.log(chalk.hex("#20DEDE")(`${chalk.bold("assistant")}:   ${message}`));
};

export const logCommand = (command: string) => {
  console.log(chalk.hex("#D06E0B")(`${chalk.bold("command")}:     ${command}`));
};

export const logPatchCommand = () => {
  console.log(
    chalk.hex("#D06E0B")(`${chalk.bold("patching")}:    suggesting changes`)
  );
};

export const logPatch = (patch: Patch) => {
  console.log(chalk.hex("#e6e54d")(`\n${patch.filePath}`));
  console.log(chalk.hex("#e6e54d")(`<<<<<<< ORIGINAL`));
  console.log(chalk.hex("#e6e54d")(`\n${patch.original}`));
  console.log(chalk.hex("#e6e54d")(`=======`));
  console.log(chalk.hex("#e6e54d")(`\n${patch.updated}`));
  console.log(chalk.hex("#e6e54d")(`>>>>>>> UPDATED`));
};

export const logExplanation = (message: string) => {
  console.log(chalk.hex("#D22DD2")(`             ${message}`));
};

export const logCommandOutput = (output: ShellCommandOutput) => {
  if (output.stdout) {
    console.log(
      chalk.hex("##1BA7E6")(`${chalk.bold("stdout")}:\n${output.stdout}`)
    );
  }
  if (output.stderr) {
    console.log(
      chalk.hex("##1BA7E6")(`${chalk.bold("stderr")}:\n${output.stderr}`)
    );
  }
  if (output.exitCode !== null) {
    console.log(
      chalk.hex("##1BA7E6")(`${chalk.bold("exit code")}: ${output.exitCode}`)
    );
  }
};

export const logLineSeparator = () => {
  console.log(chalk.hex("#B9B9C0")("-".repeat(process.stdout.columns)));
};
