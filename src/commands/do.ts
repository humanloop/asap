import { Command } from "@commander-js/extra-typings";
import {
  chat,
  chatMessageFromShellCommandOutput,
  getRelevantExecutables,
  shellCommandFromToolCall,
} from "../llm";
import { PersistentShell } from "../runCommand";
import {
  logAssistant,
  logCommand,
  logCommandOutput,
  logExplanation,
  logLineSeparator,
  logPatch,
  logPatchCommand,
} from "../utils/cli";
import ora from "ora";
import { applyPatch, parseRawPatchString } from "../utils/patch";
import { input } from "@inquirer/prompts";
import { getProjectRepresentation } from "../ctags";
import { ChatMessage } from "humanloop/api";

const tools = ["cli_call", "patch", "done"];

export const doCommand = new Command("do")
  .description("ask asap to do something")
  .argument("<instruction>", "Instruction for asap")
  .option(
    "--ctags",
    "Use ctags to generate a project representation to help guide asap"
  )
  .option("--path", "Get a list of executables available on PATH")
  .action(async (instruction, opts) => {
    const shell = new PersistentShell();
    const messages: ChatMessage[] = [];

    if (!instruction) {
      console.error("Please provide an instruction.");
      process.exit(1);
    }

    // Get project ctags representation
    if (opts.ctags) {
      const projectRepresentation = await getProjectRepresentation();
      messages.push({
        role: "system",
        content: `Here is a representation of the project directory generated with ctags. Use this to inform your exploration of the project.\n\n${projectRepresentation}`,
      });
      console.log(
        `Found project ctags representation: ${projectRepresentation.slice(
          0,
          50
        )}`
      );
    }

    if (opts.path) {
      // Get short list of relevant PATH executables and append as system message
      console.log("Getting environment information...");
      const GET_PATH_EXECUTABLES_COMMAND =
        "echo $PATH | tr ':' '\n' | xargs -I {} ls {} 2>/dev/null | sort -u | tr '\n' ','";
      const pathExecutables = await shell.executeCommand({
        command: GET_PATH_EXECUTABLES_COMMAND,
        args: [],
        explanation: "Retrieving all executables in your PATH",
      });
      const relevantPathExecutables = await getRelevantExecutables({
        inputs: { query: instruction, executables: pathExecutables.stdout },
      });
      const content =
        `Here are a list of potentially-useful executables available in the PATH directories that were retrieved with ` +
        "`" +
        GET_PATH_EXECUTABLES_COMMAND +
        "`" +
        `\n\n\n${relevantPathExecutables.join(",")}`;
      console.log(
        `Relevant PATH executables: ${relevantPathExecutables.join(",")}}`
      );
      messages.push({
        role: "system",
        content,
      });
    }

    // Add user instruction message
    messages.push({ role: "user", content: instruction });

    while (true) {
      logLineSeparator();
      const spinner = ora({
        text: "asaping your code...",
        spinner: "balloon",
        // balloon, balloon2, circle, arc,
      }).start();

      const assistantResponse = await chat(messages);
      messages.push(assistantResponse);

      spinner.stop();

      if (!assistantResponse.toolCalls) {
        // It's proving difficult to get the model to always end with a tool call.
        // Instead, it seems to just return an assistant message, so if that happens,
        // we'll just print the message and ask the user what to do.
        assistantResponse.content &&
          logAssistant(assistantResponse?.content as string);

        // Ask for confirmation
        const confirmation = await input({
          message: "End this conversation? [Y/type a response to continue]",
        });
        if (
          confirmation.toLowerCase() === "y" ||
          confirmation.toLowerCase() === "yes"
        ) {
          break;
        } else {
          messages.push({
            role: "user",
            content: confirmation,
          });
          continue;
        }
      }

      const toolCall = assistantResponse.toolCalls[0];
      const toolCallId = toolCall.id;
      if (!tools.includes(toolCall.function.name)) {
        const resolvedToolName = tools.find((tool) =>
          toolCall.function.name.includes(tool)
        );
        if (resolvedToolName) {
          console.error(
            `received unexpected tool call: ${toolCall.function.name}; resolved to ${resolvedToolName} and proceeding`
          );
          toolCall.function.name = resolvedToolName;
        } else {
          throw new Error(
            `unable to resolve unexpected tool call with name: ${toolCall.function.name}`
          );
        }
      }

      if (toolCall.function.name === "cli_call") {
        const shellCommand = shellCommandFromToolCall(toolCall);
        logCommand(`${shellCommand.command} ${shellCommand.args.join(" ")}`);
        logExplanation(shellCommand.explanation);
        const shellCommandOutput = await shell.executeCommand(shellCommand);
        logCommandOutput(shellCommandOutput);
        const toolResponse = chatMessageFromShellCommandOutput(
          shellCommandOutput,
          toolCallId
        );
        messages.push(toolResponse);
      } else if (toolCall.function.name === "patch") {
        let patchCommand: { patch: string; explanation: string };
        try {
          patchCommand = toolCall.function.arguments
            ? JSON.parse(toolCall.function.arguments)
            : { patch: "", explanation: "" };
        } catch (e) {
          console.error(`failed to parse patch command arguments: ${e}`);
          messages.push({
            role: "system",
            content: `Failed to parse patch command arguments: ${e}`,
          });
          continue;
        }

        const rawPatch = patchCommand.patch;
        const patch = parseRawPatchString(rawPatch);
        logPatchCommand();
        logExplanation(patchCommand.explanation);
        logPatch(patch);

        // Ask for confirmation
        const confirmation = await input({
          message: "Do you want to apply this patch? [Y/type a response]",
        });
        if (
          confirmation.toLowerCase() === "y" ||
          confirmation.toLowerCase() === "yes"
        ) {
          try {
            applyPatch(patch);
            messages.push({
              role: "tool",
              name: "patch",
              content: JSON.stringify(
                {
                  stdout: "",
                  stderr: "",
                  exitCode: 0,
                },
                null,
                2
              ),
            });
          } catch (e: any) {
            console.error(e.message);
            messages.push({
              role: "tool",
              name: "patch",
              content: JSON.stringify(
                {
                  stdout: "",
                  stderr: e.message,
                  exitCode: 1,
                },
                null,
                2
              ),
            });
          }
        } else {
          messages.push({
            role: "system",
            content:
              "The patch was not applied. The user intervened with the following message.",
          });
          messages.push({
            role: "user",
            content: confirmation,
          });
        }
      } else if (toolCall.function.name === "done") {
        const doneMessage = toolCall.function.arguments
          ? JSON.parse(toolCall.function.arguments).done_message
          : "Done!";
        break;
      } else {
        throw new Error(
          `unknown tool call '${toolCall.function.name}' (with arguments: ${toolCall.function.arguments})`
        );
      }
    }
  });
