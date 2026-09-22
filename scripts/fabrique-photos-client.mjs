/**
 * fabrique-photos-client.mjs — les photos FOURNIES PAR OUSSEYNOU.
 *
 * Elles ne viennent pas de Pexels : elles sont arrivées dans le chat, donc
 * elles ne passent pas par `fabrique-images.mjs` (qui télécharge par id).
 * Le calcul de fenêtre est le même : on recadre nous-mêmes, `foyer` dit quel
 * point de l'original doit tomber au centre. Aucun `cover` aveugle.
 *
 * Originaux : site/.cache-images/client-1.jpg et client-2.jpg.
 *   client-1 : golden retriever de face, fond végétal flou, 1600 x 1053.
 *   client-2 : golden retriever debout sur un trottoir, 499 x 750.
 *
 *   node scripts/fabrique-photos-client.mjs
 */
import sharp from "sharp";
import { statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const ORIG = join(RACINE, ".cache-images");
const OUT = join(RACINE, "public", "img");

const PLAN = [
  // Photo du contact — 530 x 625, la citation se pose dessus en bas.
  // Photo du contact CHANGÉE le 22/09 : Ousseynou a fourni le golden retriever
  // de face (client-4). Elle vient du même tirage que client-2, mais recadrée
  // au carré — d'où le changement de fenêtre.
  { nom: "contact", src: "client-4.webp", w: 530, h: 625, echelle: 1.5, foyer: { x: 0.58, y: 0.44 }, q: 78 },
  // « Pourquoi nous » — 496 x 450, juste après la bande de chiffres.
  // « Pourquoi nous » : le PORTRAIT (client-1). Ousseynou a hésité entre les
  // deux le 22/09 et a tranché celui-ci. L'autre chien, en pied, vient du même
  // tirage que la photo du contact — les deux sections se ressemblaient trop.
  { nom: "pourquoi-nous", src: "client-1.jpg", w: 496, h: 450, echelle: 1.5, foyer: { x: 0.62, y: 0.42 }, q: 78 },
  // Le chien de la carte verte n'est PLUS produit ici : il lui faut un fond
  // transparent, et ce script ne fait que recadrer. Voir fabrique-chien-detoure.mjs.
];

// AUTO-CONTRÔLE du calcul de fenêtre, sur un cas dont on connaît la réponse :
// source 1000 x 500, cible carrée -> fenêtre 500 x 500, et un foyer à x=0 doit
// être ramené dans l'image (left = 0), pas produire un left négatif.
{
  const t = fenetre(1000, 500, 1, { x: 0, y: 0.5 });
  const ok = t.width === 500 && t.height === 500 && t.left === 0 && t.top === 0;
  console.log("auto-contrôle fenêtre :", ok ? "OK" : "ÉCHEC", JSON.stringify(t));
  if (!ok) process.exit(1);
}

function fenetre(mw, mh, cible, foyer) {
  let width, height;
  if (mw / mh > cible) { height = mh; width = Math.round(mh * cible); }
  else { width = mw; height = Math.round(mw / cible); }
  let left = Math.round(foyer.x * mw - width / 2);
  let top = Math.round(foyer.y * mh - height / 2);
  left = Math.max(0, Math.min(left, mw - width));
  top = Math.max(0, Math.min(top, mh - height));
  return { left, top, width, height };
}

const res = [];
for (const p of PLAN) {
  const src = join(ORIG, p.src);
  const m = await sharp(src).metadata();
  const W = Math.round(p.w * p.echelle), H = Math.round(p.h * p.echelle);
  const f = fenetre(m.width, m.height, W / H, p.foyer);
  const dest = join(OUT, `${p.nom}.webp`);
  await sharp(src).extract(f).resize(W, H, { fit: "fill" }).webp({ quality: p.q }).toFile(dest);
  res.push({ nom: p.nom, rendu: `${W}x${H}`, fenetre: `${f.width}x${f.height}@${f.left},${f.top}`, ko: +(statSync(dest).size / 1024).toFixed(1) });
}
console.table(res);
