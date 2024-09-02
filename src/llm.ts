import { ChatMessage, PromptCallResponse, ToolCall } from "humanloop/api";
import { HUMANLOOP_API_KEY, HUMANLOOP_BASE_URL } from "./env";
import { HumanloopClient } from "humanloop";

const client = new HumanloopClient({
  environment: HUMANLOOP_BASE_URL,
  apiKey: HUMANLOOP_API_KEY || "",
});

export const chat = async (messages: ChatMessage[]): Promise<ChatMessage> => {
  let MAX_ATTEMPTS = 9;
  let attempts = 0;
  let waitTime = 64; // ms
  while (true) {
    if (attempts > MAX_ATTEMPTS) {
      throw new Error(
        `attempted rate-limit backoff; too many attempts (${attempts})`
      );
    }

    try {
      let response: PromptCallResponse;

      response = await client.prompts.call({
        path: "asap",
        inputs: {},
        messages,
        providerApiKeys: {
          openai: process.env.OPENAI_API_KEY,
        },
      });

      return handleSuccessfulGeneration(response);
    } catch (e: any) {
      if (e.status === 429) {
        // We hit a rate limit error.
        console.error(
          `rate limit error; waiting ${waitTime}ms; attempt ${
            attempts + 1
          }/${MAX_ATTEMPTS}`
        );
        await sleep(waitTime);
        waitTime *= 2;
        attempts += 1;
      } else {
        console.log(e);
        throw new Error(`unexpected error in generating ${e}`);
      }
    }
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const handleSuccessfulGeneration = (
  response: PromptCallResponse
): ChatMessage => {
  const data = response.logs[0];

  if (data.finishReason !== "tool_call") {
    return { role: "assistant", content: data.output };
  } else {
    return {
      role: "assistant",
      content: data.output,
      toolCalls: data.outputMessage?.toolCalls,
    };
  }
};

export interface ShellCommand {
  command: string;
  args: string[];
  explanation: string;
}

export interface ShellCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export const shellCommandFromToolCall = (toolCall: ToolCall): ShellCommand => {
  if (toolCall.function.name === "cli_call") {
    const args = toolCall.function.arguments
      ? JSON.parse(toolCall.function.arguments)
      : { command: "", arguments: "", explanation: "" };
    return {
      command: args.command,
      args: args.arguments.split(" "),
      explanation: args.explanation,
    };
  } else {
    throw new Error(`unknown tool call name '${toolCall.function.name}'`);
  }
};

export const chatMessageFromShellCommandOutput = (
  shellCommandOutput: ShellCommandOutput,
  toolCallId: string
): ChatMessage => {
  if (
    shellCommandOutput.stdout.length > 500 ||
    shellCommandOutput.stderr.length > 500
  ) {
    // The output was very long. Tell the LLM the first 50 chars, and ask it to do something else,
    // perhaps narrowing scope of its last command.
    console.error("the output was very large; truncating to 500 chars");
    return {
      role: "tool",
      name: "cli_call",
      toolCallId: toolCallId,
      content: JSON.stringify(
        {
          warning:
            "The output of the command was longer than 500 characters. Truncating. Try narrowing the scope.",
          output: {
            exitCode: shellCommandOutput.exitCode,
            stdout: shellCommandOutput.stdout.slice(0, 500),
            stderr: shellCommandOutput.stderr.slice(0, 500),
          },
        },
        null,
        2
      ),
    };
  }

  return {
    role: "tool",
    name: "cli_call",
    toolCallId: toolCallId,
    content: JSON.stringify(shellCommandOutput, null, 2),
  };
};

export const getRelevantExecutables = async ({
  inputs,
}: {
  inputs: { query: string; executables: string };
}): Promise<string[]> => {
  let response: PromptCallResponse;

  response = await client.prompts.call({
    path: "asap-path-executables",
    inputs,
    messages: [],
  });

  const output = response.logs[0].outputMessage;
  // Return a list of string from `output`'s comma-separated list
  return output && output.content
    ? (output.content as string).split(",").map((s: string) => s.trim())
    : [];
};
