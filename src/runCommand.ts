import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { ShellCommand, ShellCommandOutput } from "./llm";
import { randomString } from "./utils/rand";

export class PersistentShell {
  process: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  listeners: Map<string, () => void>;

  constructor(shell?: string) {
    this.process = this.createShellProcess(shell);
    this.stdout = "";
    this.stderr = "";
    this.listeners = new Map();

    this.process.stdout.on("data", (data) => {
      data = data.toString();
      this.stdout += data;
      this.listeners.forEach((listener) => listener());
    });
    this.process.stderr.on("data", (data) => {
      data = data.toString();
      this.stderr += data;
      this.listeners.forEach((listener) => listener());
    });

    this.process.on("exit", (exitCode) => {
      console.log(`shell exit code ${exitCode}`);
    });

    this.process.on("error", (err) => {
      console.error(`shell error: ${err}`);
    });
    this.process.on("message", (msg) => {
      console.error(`shell message: ${msg}`);
    });
    this.process.on("disconnect", () => {
      console.log("shell disconnected");
    });
  }

  createShellProcess(shell?: string) {
    let shellFile = "/bin/sh";
    if (process.platform === "win32") {
      shellFile = process.env.comspec || "cmd.exe";
    } else if (process.platform === "android") {
      shellFile = "/system/bin/sh";
    }

    shellFile = shell || shellFile;

    return spawn(shellFile, {
      shell: false,
    });
  }

  executeCommand(cmd: ShellCommand): Promise<ShellCommandOutput> {
    const uniqueCommandId = `end_command_${randomString(16)}`;

    return new Promise((resolve, reject) => {
      // This listener runs on every chunk received to either stdout or stderr
      const onChunk = () => {
        // Check the entire stdout for the unique end command id
        if (this.stdout.includes(uniqueCommandId)) {
          const splitStdout = this.stdout.split("\n");
          while (splitStdout.pop() !== uniqueCommandId) {}
          const exitCode = parseInt(splitStdout.pop() || "0");
          const commandStdout = splitStdout.join("\n");

          // Remove the end command id from the stdout
          this.stdout = this.stdout.replace(uniqueCommandId, "");

          // Remove the listener for this command
          if (!this.listeners.delete(uniqueCommandId)) {
            throw new Error(
              `removing listener for command ${uniqueCommandId} failed`
            );
          }

          resolve({
            stdout: commandStdout,
            stderr: this.stderr,
            exitCode,
          });
        }
      };
      this.listeners.set(uniqueCommandId, onChunk);

      // Write the main command, and the exit code retrieval, and the unique end command id
      // to stdin on the shell.
      this.process.stdin.write(`${cmd.command} ${cmd.args.join(" ")}\n`);
      this.process.stdin.write(`echo $?\n`);
      this.process.stdin.write(`echo ${uniqueCommandId}\n`);
    });
  }
}
