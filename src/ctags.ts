import { ShellCommandOutput } from "./llm";
import { runCommand } from "./runCommand";

const runCtagCommand = (): Promise<ShellCommandOutput> => {
  return runCommand({
    command: "ctags --fields=+S --output-format=json -R .",
    args: [],
    explanation: "Generate ctags for the current project",
  });
};

interface Tag {
  _type: "tag";
  name: string;
  path: string;
  pattern: string;
  kind: string; // May have enum?
  scope: string;
  scopeKind: string;
}

export const getProjectRepresentation = async (): Promise<string> => {
  const ctagCommandOutput = await runCtagCommand();
  const ctagOutput = ctagCommandOutput.stdout;
  const tags: Tag[] = ctagOutput
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));

  return tags
    .map((tag) =>
      JSON.stringify({
        // Remove repeated "_type": "tag" from the output
        name: tag.name,
        path: tag.path,
        pattern: tag.pattern,
        kind: tag.kind,
        scope: tag.scope,
        scopeKind: tag.scopeKind,
      })
    )
    .join(" ");
};
