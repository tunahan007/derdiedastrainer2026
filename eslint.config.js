// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "ios/*", "android/*", "_backup_*/*", "plugins/*", "App.js", "**/*.txt"],
  },
  {
    // eslint-config-expo 58 (eslint-plugin-react-hooks 7) bringt neue
    // React-Compiler-Regeln als Fehler mit. Der bestehende Code verletzt sie
    // (v. a. refs in trainer.js/practicefailedwords.js), funktioniert aber.
    // Waehrend des SDK-58-Upgrades nur als Warnung - Aufraeumen ist eine
    // eigene Aufgabe danach.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    files: ["__tests__/**/*.js"],
    languageOptions: { globals: { jest: "readonly", describe: "readonly", test: "readonly", expect: "readonly", beforeEach: "readonly", afterEach: "readonly", __dirname: "readonly", require: "readonly" } },
  },
]);
