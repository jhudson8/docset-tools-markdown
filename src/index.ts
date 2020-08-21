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
import { join, basename } from "path";
import showdown from "showdown";
import template from "./template";
import { copyFileSync } from "fs";
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
      return {};
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
      name: string | null; // null for `index` type
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
          const fileName = name
            ? basename(srcPath).replace(/\.[^\.]*$/, ".html")
            : "index.html";
          const dirPath = name ? join(tempDir, type) : tempDir;
          const outputPath = join(dirPath, fileName);
          ensureDirSync(dirPath);
          writeFileSync(
            name ? outputPath : join(tempDir, "index.html"),
            template({
              prefix: name ? "../" : "./",
              content: htmlContent,
            }),
            { encoding: "utf8" }
          );
          if (!name) {
            rtn.index = "markdown/index.html";
          } else {
            if (indexNamesWithBase.indexOf(srcPath) >= 0) {
              // forget it
              return;
            }
            if (!rtn[type]) {
              (rtn as any)[type] = {};
            }
            const entryName = name.replace(/\.[^\.]+$/, "");
            (rtn as any)[type][entryName] = `markdown/${type}/${fileName}`;
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

    const recurse = (typeFromFilesystem: string, children: string[]) => {
      const type = getKnownType(typeFromFilesystem || docsType);
      children.forEach((name) => {
        if (!type && ["index.markdown", "index.md"].indexOf(name) >= 0) {
          // skip this file because it's the index
        }

        const srcPath = typeFromFilesystem
          ? join(docsPath, typeFromFilesystem, name)
          : join(docsPath, name);
        if (!type) {
          console.log(
            "skipping ",
            srcPath,
            " due to invalid type: ",
            typeFromFilesystem || docsType
          );
        } else {
          if (lstatSync(srcPath).isDirectory()) {
            if (typeFromFilesystem) {
              // we don't support deep nesting
              return;
            } else {
              const items = readdirSync(srcPath);
              recurse(name, items);
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
      });
    };

    if (docsPathExists) {
      const items = readdirSync(docsPath);
      recurse(undefined, items);
    }

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
