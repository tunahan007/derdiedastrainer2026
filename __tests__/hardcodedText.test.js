// Findet sichtbare Texte in Bildschirmen, die nicht über t("…") übersetzt werden.
// Hintergrund: z. B. "No Failed Words" erschien auf Türkisch auf Englisch.
import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

const ROOT = path.join(__dirname, "..");
const SKIP = ["i18n.js", "words.js", "translations.js", "sentences_data.js", "verbs.js"];
// Bewusst unübersetzt: deutsche Grammatikbegriffe (Lerninhalt) und Level-Werte
const ALLOWED = new Set(["Nominativ", "Akkusativ", "Dativ", "Genitiv", "Alle", "OK"]);

const files = ["app", "lib"].flatMap((dir) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith(".js") && !SKIP.includes(f))
    .map((f) => path.join(dir, f)),
);

const findHardcoded = (file) => {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });
  const found = [];
  const isText = (s) => /[A-Za-zÄÖÜäöüß]{2,}/.test(s) && !ALLOWED.has(s.trim());
  (traverse.default || traverse)(ast, {
    // Text direkt zwischen JSX-Tags, z. B. <Text>Neu laden</Text>
    JSXText(p) {
      if (isText(p.node.value)) found.push(`${file}:${p.node.loc.start.line} ${p.node.value.trim()}`);
    },
    StringLiteral(p) {
      const { parent } = p;
      // Alert.alert("Titel", "Text")
      const isAlert =
        parent.type === "CallExpression" &&
        parent.callee.type === "MemberExpression" &&
        parent.callee.object.name === "Alert";
      // {"Text"} direkt im JSX
      const isJsxExpr = parent.type === "JSXExpressionContainer";
      if ((isAlert || isJsxExpr) && isText(p.node.value)) {
        found.push(`${file}:${p.node.loc.start.line} ${p.node.value}`);
      }
    },
  });
  return found;
};

test.each(files)("%s enthält keine unübersetzten Texte", (file) => {
  expect(findHardcoded(file)).toEqual([]);
});
