import { homedir } from "os";
import { join } from "path";

export const expandHomeDir = (pathWithTilde: string): string => {
  const homeDir = homedir();
  if (!pathWithTilde) return pathWithTilde;
  if (pathWithTilde === "~") return homeDir;
  if (pathWithTilde.slice(0, 2) !== "~/") return pathWithTilde;
  return join(homeDir, pathWithTilde.slice(2));
};
