// Marks screen-orientation hardware features as optional so Google Play
// does not exclude tablets, Chromebooks and XR devices.
// The app itself stays locked to portrait via "orientation" in app.json.
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURES = [
  "android.hardware.screen.portrait",
  "android.hardware.screen.landscape",
];

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] =
      manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";
    manifest["uses-feature"] = manifest["uses-feature"] || [];
    for (const name of FEATURES) {
      const existing = manifest["uses-feature"].find(
        (f) => f.$ && f.$["android:name"] === name
      );
      if (existing) {
        existing.$["android:required"] = "false";
        existing.$["tools:replace"] = "android:required";
      } else {
        manifest["uses-feature"].push({
          $: {
            "android:name": name,
            "android:required": "false",
            "tools:replace": "android:required",
          },
        });
      }
    }
    return cfg;
  });
};
