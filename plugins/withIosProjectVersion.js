// Schreibt Version (app.json "version") und Build-Nummer (ios.buildNumber)
// auch als MARKETING_VERSION / CURRENT_PROJECT_VERSION ins Xcode-Projekt.
// Info.plist bekommt die Werte ohnehin von Expo; so muss nach
// `expo prebuild --clean` nichts mehr von Hand in project.pbxproj geändert werden.
const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withIosProjectVersion(config) {
  return withXcodeProject(config, (cfg) => {
    const version = cfg.version;
    const build = cfg.ios && cfg.ios.buildNumber;
    const configs = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const s = configs[key] && configs[key].buildSettings;
      if (!s || !s.PRODUCT_BUNDLE_IDENTIFIER) continue; // nur App-Target
      if (version) s.MARKETING_VERSION = version;
      if (build) s.CURRENT_PROJECT_VERSION = build;
    }
    return cfg;
  });
};
