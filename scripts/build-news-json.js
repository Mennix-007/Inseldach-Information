const fs = require("fs/promises");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "news-source.json");
const OUTPUT_FILE = path.join(ROOT, "news.json");

function normalizeList(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(x => String(x ?? "").trim())
    .filter(Boolean);
}

async function translateTexts(texts, targetLang = "PL") {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPL_API_KEY fehlt als Umgebungsvariable.");
  }

  const payload = {
    text: texts,
    target_lang: targetLang
  };

  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`DeepL Fehler: ${response.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data.translations)
    ? data.translations.map(t => String(t.text || "").trim())
    : [];
}

async function buildBilingualLines(germanList) {
  const de = normalizeList(germanList).slice(0, 2);

  if (!de.length) return [];

  const pl = await translateTexts(de, "PL");

  const out = [];
  for (let i = 0; i < de.length; i += 1) {
    out.push(de[i]);
    out.push(pl[i] || de[i]);
  }

  return out.slice(0, 4);
}

async function main() {
  const raw = await fs.readFile(SOURCE_FILE, "utf8");
  const source = JSON.parse(raw);

  const out = {
    heuteWichtig: await buildBilingualLines(source.heuteWichtig),
    daueranzeige: await buildBilingualLines(source.daueranzeige),
    langzeitInfo: normalizeList(source.langzeitInfo),
    ticker: normalizeList(source.ticker),
    daueranzeigeBild: source.daueranzeigeBild || ""
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("news.json wurde erfolgreich erzeugt.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
