// scrollWidth vs innerWidth à 0, 200 et 1000 ms après l'événement load, aux largeurs données,
// avec l'état calculé du panneau nav01__nav. Chaque instant = un chargement neuf (pas de cumul).
// Usage : node scripts/mesure-debordement-chargement.mjs <url> [320,375,768]
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:4173/";
const widths = (process.argv[3] ?? "320,375,768").split(",").map(Number);
const b = await chromium.launch();
let echecs = 0;
for (const w of widths) for (const t of [0, 200, 1000]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto(url, { waitUntil: "load" });
  if (t) await p.waitForTimeout(t);
  const r = await p.evaluate(() => {
    const n = document.querySelector(".nav01__nav"), cs = getComputedStyle(n);
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, pos: cs.display + " " + cs.position, tf: cs.transform, vis: cs.visibility, trans: cs.transitionProperty + " " + cs.transitionDuration, right: Math.round(n.getBoundingClientRect().right) };
  });
  const ok = r.sw === r.iw; if (!ok) echecs++;
  console.log(`${ok ? "OK  " : "ECHEC"} ${w}px t+${t}ms  scrollWidth=${r.sw} innerWidth=${r.iw} | nav: ${r.pos} ${r.tf} ${r.vis} right=${r.right} [${r.trans}]`);
  await p.close();
}
await b.close();
console.log(echecs ? `${echecs} échec(s)` : "0 échec");
process.exit(echecs ? 1 : 0);
