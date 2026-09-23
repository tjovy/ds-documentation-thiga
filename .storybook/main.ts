import type { StorybookConfig } from '@storybook/react-vite';
import { githubTokenDocsPlugin } from './githubTokenDocsPlugin.ts';

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],

  addons: ["@storybook/addon-links", "@storybook/addon-docs"],

  framework: {
    name: "@storybook/react-vite",
    options: {}
  },

  async viteFinal(config) {
    config.plugins = [...(config.plugins || []), githubTokenDocsPlugin()];
    return config;
  },
};
export default config;
