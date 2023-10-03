import { ChatMessage, ChatResponse, Humanloop, ToolCall } from "humanloop";
import { HUMANLOOP_API_KEY, HUMANLOOP_BASE_URL, OPENAI_API_KEY } from "./env";

const humanloop = new Humanloop({
  basePath: HUMANLOOP_BASE_URL,
  apiKey: HUMANLOOP_API_KEY,
  openaiApiKey: OPENAI_API_KEY,
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
      let response: ChatResponse;

      response = (
        await humanloop.chatDeployed({
          project: "asap",
          inputs: {},
          messages,
        })
      ).data;

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

const handleSuccessfulGeneration = (response: ChatResponse): ChatMessage => {
  const data = response.data[0];

  if (data.finish_reason !== "tool_call") {
    return { role: "assistant", content: data.output };
  } else {
    // TODO: hackily retrieve this from the raw provider response because
    // the Humanloop API is dropping it.
    const toolCall = response.provider_responses[0].choices[0].message
      .function_call as ToolCall;
    // const toolCall = JSON.parse(toolCallRaw) as ToolCall;
    return {
      role: "assistant",
      tool_call: toolCall,
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
  if (toolCall.name === "cli_call") {
    const args = JSON.parse(toolCall.arguments);
    return {
      command: args.command,
      args: args.arguments.split(" "),
      explanation: args.explanation,
    };
  } else {
    throw new Error(`unknown tool call name '${toolCall.name}'`);
  }
};

export const chatMessageFromShellCommandOutput = (
  shellCommandOutput: ShellCommandOutput
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
    content: JSON.stringify(shellCommandOutput, null, 2),
  };
};

export const getRelevantExecutables = async ({
  inputs,
}: {
  inputs: { query: string; executables: string };
}): Promise<string[]> => {
  let response: ChatResponse;

  response = (
    await humanloop.chatDeployed({
      project: "asap-path-executables",
      inputs,
      messages: [],
    })
  ).data;

  const output = response.data[0].output;
  // Return a list of string from `output`'s comma-separated list
  return output.split(",").map((s: string) => s.trim());
};
