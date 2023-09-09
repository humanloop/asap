import fs from "node:fs";
import path from "node:path";
import escapeStringRegexp from "escape-string-regexp";

export interface Patch {
  filePath: string;
  original: string;
  updated: string;
}

export const parseRawPatchString = (rawPatchString: string): Patch => {
  const lines = rawPatchString.split("\n");
  let original: string[] = [];
  let updated: string[] = [];

  let filePath = lines.shift();
  if (!filePath) {
    throw new Error("invalid patch format; expected file path");
  }

  let secondLine = lines.shift();
  if (!secondLine?.startsWith("<<<<<<< ORIGINAL")) {
    throw new Error("invalid patch format; expected '<<<<<<< ORIGINAL'");
  }

  let originalPhase = true;
  for (let line of lines) {
    if (line.startsWith("<<<<<<< ORIGINAL")) {
      throw new Error("invalid patch format; unexpected '<<<<<<< ORIGINAL'");
    } else if (line.startsWith("=======")) {
      if (!originalPhase) {
        throw new Error("invalid patch format; unexpected '======='");
      }
      originalPhase = false;
    } else if (line.startsWith(">>>>>>> UPDATED")) {
      if (originalPhase) {
        throw new Error("invalid patch format; unexpected '>>>>>>> UPDATED'");
      }
    } else {
      if (originalPhase) {
        original.push(line);
      } else {
        updated.push(line);
      }
    }
  }

  return {
    filePath,
    original: original.join("\n"),
    updated: updated.join("\n"),
  };
};

export const applyPatch = (patch: Patch) => {
  let updatedFileContent: string;
  if (fs.existsSync(patch.filePath)) {
    const originalFileContent = fs.readFileSync(patch.filePath, "utf8");

    // Verify that there is exactly one match for patch.original in the original
    // file content.
    const escapedRegexp = escapeStringRegexp(patch.original);
    const originalMatches = originalFileContent.match(
      new RegExp(escapedRegexp, "g")
    );
    if (!originalMatches || originalMatches.length == 0) {
      throw new Error(
        `could not find match for patch.original in ${patch.filePath}`
      );
    } else if (originalMatches.length > 1) {
      throw new Error(
        `found multiple matches for patch.original in ${patch.filePath}`
      );
    }

    // Perform the replacement for patch.original in the original file content and replace it
    // with patch.updated.
    updatedFileContent = originalFileContent.replace(
      patch.original,
      patch.updated
    );
  } else {
    if (patch.original !== "") {
      throw new Error(`the file ${patch.filePath} does not exists`);
    } else {
      updatedFileContent = patch.updated;
    }
  }

  // Ensure that the directory exists.
  if (!fs.existsSync(patch.filePath)) {
    // Create parent path if it does not exist
    const parentDirName = path.dirname(patch.filePath);
    if (!fs.existsSync(parentDirName)) {
      fs.mkdirSync(parentDirName, { recursive: true });
    }
  }

  // Write the updated file to disk.
  fs.writeFile(patch.filePath, updatedFileContent, (err) => {
    if (err) throw Error(`error writing file ${patch.filePath}: ${err}`);
  });
};
