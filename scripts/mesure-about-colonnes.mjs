// Mesure .abt01__inner à 320/375/768/1440, débordement horizontal, captures 375,
// et scan des grilles/flex à ≥2 colonnes contenant >80 caractères de texte.
// Usage : node scripts/mesure-about-colonnes.mjs <url> <dossier-captures>
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:4321/";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch();
for (const w of [320, 375, 768, 1440]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000); // nav01__nav déborde ~1 s au chargement (transitoire, préexistant)
  const r = await page.evaluate(() => {
    const inners = [...document.querySelectorAll(".abt01__inner")].map((el) => {
      const cols = getComputedStyle(el).gridTemplateColumns;
      const m = el.querySelector(".abt01__media").getBoundingClientRect();
      const t = el.querySelector(".abt01__text").getBoundingClientRect();
      return { variant: el.parentElement.className.match(/abt01--img-\w+/)[0], cols, nCols: cols.split(" ").length, imageAuDessus: m.bottom <= t.top + 1 };
    });
    const de = document.documentElement;
    return { inners, scrollW: de.scrollWidth, clientW: de.clientWidth };
  });
  console.log(`\n== ${w}px  débordement: ${r.scrollW > r.clientW ? "OUI " + r.scrollW : "non"} (${r.scrollW}/${r.clientW})`);
  for (const i of r.inners) console.log(`  ${i.variant}: ${i.nCols} col [${i.cols}] image au-dessus=${i.imageAuDessus}`);
  if (w === 375) {
    const secs = await page.$$(".abt01");
    for (let k = 0; k < secs.length; k++) {
      await secs[k].scrollIntoViewIfNeeded();
      await page.evaluate(() => Promise.race([Promise.all([...document.images].map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 4000))]));
      await secs[k].screenshot({ timeout: 15000, animations: "disabled", path: `${out}/about-${k + 1}-375.png` });
    }
    const scan = await page.evaluate(() => {
      const res = [];
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (!/grid|flex/.test(cs.display)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue;
        const kids = [...el.children].filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(c).position !== "absolute"; });
        // colonnes réelles = enfants côte à côte sur une même rangée
        const lefts = new Set(kids.map((c) => Math.round(c.getBoundingClientRect().left)));
        if (lefts.size < 2) continue;
        const txt = kids.map((c) => (c.innerText || "").trim().replace(/\s+/g, " ")).filter((t) => t.length > 80);
        if (!txt.length) continue;
        const cls = typeof el.className === "string" ? el.className.split(" ").filter((c) => !c.startsWith("astro-")).join(".") : "";
        res.push(`${el.tagName.toLowerCase()}.${cls} — ${cs.display}, ${lefts.size} col, ${txt.length} enfant(s) >80 car. : « ${txt[0].slice(0, 60)}… »`);
      }
      return res;
    });
    console.log(`  SCAN 375 (≥2 colonnes réelles + texte >80 car.) : ${scan.length}`);
    scan.forEach((s) => console.log("   - " + s));
  }
  await page.close();
}
await browser.close();
