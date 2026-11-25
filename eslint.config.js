// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "ios/*", "android/*", "_backup_*/*", "plugins/*", "App.js", "**/*.txt"],
  },
  {
    files: ["__tests__/**/*.js"],
    languageOptions: { globals: { jest: "readonly", describe: "readonly", test: "readonly", expect: "readonly", beforeEach: "readonly", afterEach: "readonly", __dirname: "readonly", require: "readonly" } },
  },
]);
