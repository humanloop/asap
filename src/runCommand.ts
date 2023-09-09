import { spawn } from "child_process";
import { ShellCommand, ShellCommandOutput } from "./llm";

export async function runCommand(
  cmd: ShellCommand
): Promise<ShellCommandOutput> {
  return new Promise((resolve, reject) => {
    const command = spawn(`${cmd.command} ${cmd.args.join(" ")}`, {
      shell: true,
    });

    const commandOutput: ShellCommandOutput = {
      stdout: "",
      stderr: "",
      exitCode: null,
    };

    command.stdout.on("data", (output) => {
      commandOutput.stdout += output.toString();
    });
    command.stderr.on("data", (output) => {
      commandOutput.stderr += output.toString();
    });
    command.on("close", (code) => {
      commandOutput.exitCode = code;
      resolve(commandOutput);
    });
  });
}
