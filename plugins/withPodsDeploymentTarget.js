// Hebt das iOS-Deployment-Target aller Pods auf mindestens 15.1 an.
// Hintergrund: Xcode 27 unterstützt nur noch 15.0+, einige Pods (Lottie,
// AsyncStorage, RNSVG, Google Mobile Ads/UMP) setzen 12.0–13.4 → Warnungen.
// Als Config-Plugin, damit `expo prebuild --clean` die Änderung nicht löscht.
const { withPodfile } = require("@expo/config-plugins");

const MIN_TARGET = "15.1";
const MARKER = "# withPodsDeploymentTarget";

const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN_TARGET}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
        end
      end
    end
`;

module.exports = function withPodsDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;
    const anchor = /(react_native_post_install\([\s\S]*?\n\s*\))/;
    if (!anchor.test(src)) {
      throw new Error("withPodsDeploymentTarget: react_native_post_install nicht im Podfile gefunden");
    }
    cfg.modResults.contents = src.replace(anchor, `$1\n${SNIPPET}`);
    return cfg;
  });
};
