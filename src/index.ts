import { Plugin, normalizePath } from "docset-tools-types";

const plugin: Plugin = {
  execute: async function ({
    createTmpFolder,
    include,
    mainOptions,
    pluginOptions,
  }) {
    pluginOptions = pluginOptions || {};
    pluginOptions.docsPath = pluginOptions.docsPath || "docs";
    const docsPath = normalizePath(pluginOptions.docsPath);
    const docsType = pluginOptions.docsType || "Guide";

    return {};
  },
};
export default plugin;
