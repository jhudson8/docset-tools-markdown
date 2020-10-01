import {
  Plugin,
  normalizePath,
  getKnownType,
  DocsetEntries,
  DocsetEntryType,
} from "docset-tools-types";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  ensureDirSync,
} from "fs-extra";
import { join, basename, dirname } from "path";
import showdown from "showdown";
import template from "./template";
import { copyFileSync } from "fs";
import copy from "recursive-copy";
const highlight = require("showdown-highlight");

const plugin: Plugin = {
  execute: async function ({ createTmpFolder, include, pluginOptions }) {
    pluginOptions = pluginOptions || {};
    pluginOptions.docsPath = pluginOptions.docsPath || "docs";
    const docsPath = normalizePath(pluginOptions.docsPath);
    const docsType = getKnownType(pluginOptions.docsType || "Guide");
    if (!docsType) {
      throw new Error('Invalid type "' + pluginOptions.docsType + '"');
    }
    const docsPathExists = existsSync(docsPath);
    if (!docsPathExists) {
      console.error("markdown docs path does not exist: " + docsPath);
    }

    const rtn: DocsetEntries = {};
    const tempDir = await createTmpFolder();
    const converter = new showdown.Converter({
      tables: true,
      strikethrough: true,
      simpleLineBreaks: true,
      metadata: true,
      emoji: true,
      extensions: [highlight],
      ...pluginOptions.showdownConverterOptions,
    });

    const indexNames = [
      join(pluginOptions.docsPath, "index.md"),
      join(pluginOptions.docsPath, "index.markdown"),
    ];
    const indexNamesWithBase = indexNames.map(normalizePath);

    const render = ({
      type,
      name,
      srcPath,
    }: {
      type: DocsetEntryType | "index";
      name?: string | null; // null for `index` type, undefined for simple render and no outline entry
      srcPath: string;
    }) => {
      if (existsSync(srcPath)) {
        if (
          srcPath.endsWith(".md") ||
          srcPath.endsWith(".MD") ||
          srcPath.endsWith(".Markdown") ||
          srcPath.endsWith(".markdown")
        ) {
          const data = readFileSync(srcPath, { encoding: "utf8" });
          const htmlContent = converter.makeHtml(data);
          let filePath = srcPath
            .substring(process.cwd().length)
            .replace(/\\/g, "/")
            .replace(/\.[^\.]*$/, ".html");
          const outputPath = join(tempDir, filePath);
          ensureDirSync(dirname(outputPath));
          const filePathParts = filePath
            .replace(/\/[^/]+$/, "")
            .replace(/^\//, "")
            .split("/")
            .filter((o) => o);
          writeFileSync(
            outputPath,
            template({
              prefix:
                filePathParts.length === 0
                  ? "./"
                  : filePathParts.map(() => "../").join(""),
              content: htmlContent,
            }),
            { encoding: "utf8" }
          );
          if (name === null) {
            rtn.index = "markdown" + filePath;
            // remove entry if exists
            Object.entries(rtn).forEach(([key, value]) => {
              if (typeof value === "object") {
                Object.entries(value).forEach(([_key, path]) => {
                  if (path === rtn.index) {
                    delete value[_key];
                  }
                });
              }
            });
          } else {
            if (type !== undefined) {
              if (!rtn[type]) {
                (rtn as any)[type] = {};
              }
              const entryName = name.replace(/\.[^\.]+$/, "");
              (rtn as any)[type][entryName] = `markdown${filePath}`;
            }
          }
        } else {
          // just copy the file
          const dirPath = name ? join(tempDir, type) : tempDir;
          ensureDirSync(dirPath);
          const outputPath = join(dirPath, basename(srcPath));
          copyFileSync(srcPath, outputPath);
        }
      }
    };

    const recurse = async (typeFromFilesystem: string, children: string[]) => {
      const type = getKnownType(typeFromFilesystem || docsType);

      if (typeFromFilesystem === "assets") {
        const path = join(docsPath, typeFromFilesystem);
        if (lstatSync(path).isDirectory()) {
          // associated assets, copy the directory without modification
          const assetsOutputPath = join(tempDir, "assets");
          ensureDirSync(assetsOutputPath);
          await copy(path, assetsOutputPath);
          return;
        }
      }

      for (let i = 0; i < children.length; i++) {
        const name = children[i];
        const srcPath = typeFromFilesystem
          ? join(docsPath, typeFromFilesystem, name)
          : join(docsPath, name);

        if (!type) {
          if (typeFromFilesystem) {
            // copy the file but don't include in the outline
            if (lstatSync(srcPath).isDirectory()) {
              const items = readdirSync(srcPath);
              await recurse(typeFromFilesystem + "/" + name, items);
            } else {
              render({
                type: undefined,
                name: undefined,
                srcPath,
              });
            }
          } else {
            console.log(
              "skipping ",
              srcPath,
              " due to invalid type: ",
              typeFromFilesystem || docsType
            );
          }
        } else {
          if (lstatSync(srcPath).isDirectory()) {
            const items = readdirSync(srcPath);
            if (typeFromFilesystem) {
              await recurse(typeFromFilesystem + "/" + name, items);
            } else {
              await recurse(name, items);
            }
          } else {
            const entryName = decodeURIComponent(name);
            render({
              type: type,
              name: entryName,
              srcPath,
            });
          }
        }
      }
    };

    if (docsPathExists) {
      const items = readdirSync(docsPath);
      await recurse(undefined, items);
    }

    // check the READMEs
    [
      "README.md",
      "README.markdown",
      "Readme.md",
      "Readme.markdown",
      "readme.md",
      "readme.markdown",
      ...indexNames,
    ].forEach((name) => {
      const srcPath = join(process.cwd(), name);
      render({
        type: "index",
        name: null,
        srcPath,
      });
    });

    await include({
      path: join(__dirname, "../assets"),
      rootDirName: "markdown",
    });
    await include({
      path: tempDir,
      rootDirName: "markdown",
    });

    return {
      entries: rtn,
    };
  },
};
export default plugin;
