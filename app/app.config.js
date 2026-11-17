// GitHub Pages serves the web app under /<repo-name>; the workflow sets EXPO_BASE_URL for that build only.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || "" },
});
