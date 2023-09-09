#! /usr/bin/env node
import { Command } from "@commander-js/extra-typings";
import { initCommand } from "./commands/init";
import { doCommand } from "./commands/do";

async function main() {
  const asap = new Command()
    .name("asap")
    .description("Autonomous Shell Assistant Program")
    .version("0.1.0");

  asap.addCommand(initCommand);
  asap.addCommand(doCommand);

  asap.parse(process.argv);
}

main();
