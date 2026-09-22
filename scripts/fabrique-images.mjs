/**
 * fabrique-images.mjs — produit les fichiers servis de site/public/img/ à partir
 * des originaux Pexels.
 *
 *   node scripts/fabrique-images.mjs
 *
 * Pourquoi un script et pas un recadrage à la main : le rapport de forme de
 * chaque cadre est relevé dans LAYOUT.md §2, et les cadres sont en
 * `object-fit: cover`. Un recadrage approximatif décale le sujet sous le cadre
 * et on ne le voit qu'au rendu. Ici la fenêtre est CALCULÉE : `zoom` resserre,
 * `foyer` dit quel point de l'original doit tomber au centre.
 *
 * Source, auteur, licence et date de vérification de chaque photo :
 * reference/IMAGES.md — une ligne par fichier. Ne jamais ajouter une entrée ici
 * sans avoir ouvert la page source et lu sa mention de licence.
 *
 * LA VIDEO n'est pas produite par ce script (ffmpeg, pas sharp). La recette,
 * pour ne pas avoir a la retrouver :
 *
 *   curl -sL -o .cache-images/video-34689720.mp4  *     https://videos.pexels.com/video-files/34689720/14703251_1080_1920_30fps.mp4
 *
 *   ffmpeg -ss 25 -t 8 -i .cache-images/video-34689720.mp4  *     -vf "crop=1080:1376:0:272,scale=548:698" -an -c:v libx264 -profile:v high  *     -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart -r 24  *     -y public/img/a-propos-video.mp4
 *
 *   ffmpeg -ss 25 -i .cache-images/video-34689720.mp4 -frames:v 1  *     -vf "crop=1080:1376:0:272,scale=548:698" -y .cache-images/poster.png
 *   # puis sharp(poster.png).webp({quality:72}) -> public/img/a-propos-video-poster.webp
 *
 * Le segment 25 s -> 33 s a ete choisi sur une planche de 10 images extraites
 * toutes les 8 secondes : c'est la partie ou le chien est immobile, donc celle
 * qui boucle sans saut visible.
 *
 * Les originaux sont mis en cache dans site/.cache-images/ — hors de public/,
 * donc jamais copié dans dist/. Le dossier se supprime sans rien casser : le
 * script retéléchargera. Il n'est pas laissé en place après une passe.
 */
import sharp from "sharp";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const ORIG = join(RACINE, ".cache-images");
const OUT = join(RACINE, "public", "img");
mkdirSync(ORIG, { recursive: true });
mkdirSync(OUT, { recursive: true });

/** pos : gravité sharp, ou {left,top} en fraction (0..1) du centre du cadrage. */
export const PLAN = [
  { nom: "hero",              id: 39495645, w: 1920, h: 1200, echelle: 1,   foyer: { x: 0.42, y: 0.5 }, q: 72, dl: 3000 },
  { nom: "intro",             id: 6816836,  w: 496,  h: 450,  echelle: 1.5, pos: "centre", q: 78, dl: 1600 },
  // "pourquoi-nous" et "contact" SONT SORTIS DE CE PLAN le 21/09 : ce sont
  // maintenant deux photos fournies par Ousseynou, produites par
  // scripts/fabrique-photos-client.mjs. Les laisser ici les écrasait à chaque
  // passe — c'est arrivé une fois, la photo du contact est revenue à l'ancienne.
  { nom: "a-propos-gauche",   id: 6957569,  w: 365,  h: 355,  echelle: 1.5, zoom: 0.62, foyer: { x: 0.5, y: 0.56 }, q: 78, dl: 1400 },
  { nom: "a-propos-droite",   id: 6589016,  w: 365,  h: 355,  echelle: 1.5, zoom: 0.9,  foyer: { x: 0.5,  y: 0.45 }, q: 78, dl: 1400 },
  { nom: "comment-ca-marche", id: 4680239,  w: 570,  h: 398,  echelle: 1.5, zoom: 0.5, foyer: { x: 0.5, y: 0.58 }, q: 78, dl: 1800 },
  { nom: "galerie-1",         id: 28644464, w: 325,  h: 350,  echelle: 1.5, foyer: { x: 0.5, y: 0.42 }, q: 78, dl: 1200 },
  { nom: "galerie-2",         id: 21767483, w: 325,  h: 350,  echelle: 1.5, pos: "centre", q: 78, dl: 1200 },
  { nom: "galerie-3",         id: 1436139,  w: 325,  h: 350,  echelle: 1.5, pos: "centre", q: 78, dl: 1200 },
  { nom: "galerie-4",         id: 6627671,  w: 325,  h: 350,  echelle: 1.5, pos: "centre", q: 78, dl: 1200 },
  { nom: "galerie-5",         id: 39550277, w: 325,  h: 350,  echelle: 1.5, pos: "centre", q: 78, dl: 1200 },
  { nom: "galerie-6",         id: 20163150, w: 325,  h: 350,  echelle: 1.5, pos: "centre", q: 78, dl: 1200 },
  { nom: "galerie-7",         id: 7344085,  w: 325,  h: 350,  echelle: 1.5, pos: "centre", q: 78, dl: 1200 },
  // Les trois cadres carres "illu-*" ont ETE RETIRES le 21/09 : la section
  // "services detailles" et l'encart d'appel a l'action ont fusionne en une
  // grille (services-grid-cta-01) qui n'a pas de cadre image, et la FAQ n'a
  // plus d'illustration. Les fichiers ne sont plus servis.
  { nom: "galerie-8",         id: 6235049,  w: 325,  h: 350,  echelle: 1.5, zoom: 0.62, foyer: { x: 0.34, y: 0.55 }, q: 78, dl: 1200 },
];

function original(p) {
  const f = join(ORIG, `${p.id}.jpg`);
  if (!existsSync(f)) {
    execFileSync("curl", ["-sL", "--fail", "-o", f,
      `https://images.pexels.com/photos/${p.id}/pexels-photo-${p.id}.jpeg?auto=compress&cs=tinysrgb&w=${p.dl}`]);
  }
  return f;
}

/** Cadrage maîtrisé : on calcule la fenêtre nous-mêmes, pas de magie. */
async function fabrique(p) {
  const src = original(p);
  const m = await sharp(src).metadata();
  const W = Math.round(p.w * p.echelle), H = Math.round(p.h * p.echelle);
  const cible = W / H;
  const source = m.width / m.height;

  let cw, ch;
  if (source > cible) { ch = m.height; cw = Math.round(m.height * cible); }
  else { cw = m.width; ch = Math.round(m.width / cible); }

  // zoom : on resserre la fenêtre autour du foyer. 1 = la plus grande possible.
  const zoom = p.zoom ?? 1;
  cw = Math.round(cw * zoom); ch = Math.round(ch * zoom);

  // pos : "centre" | "haut" | "bas" | "gauche" | "droite" | nombre 0..1 (fraction du décalage libre)
  const libreX = m.width - cw, libreY = m.height - ch;
  let fx = 0.5, fy = 0.5;
  if (p.pos === "haut") fy = 0;
  else if (p.pos === "bas") fy = 1;
  else if (p.pos === "gauche") fx = 0;
  else if (p.pos === "droite") fx = 1;
  else if (typeof p.pos === "object") { fx = p.pos.x ?? 0.5; fy = p.pos.y ?? 0.5; }

  let left, top;
  if (p.foyer) {
    const bornes = (v, max) => Math.max(0, Math.min(max, Math.round(v)));
    left = bornes(p.foyer.x * m.width - cw / 2, m.width - cw);
    top = bornes(p.foyer.y * m.height - ch / 2, m.height - ch);
  } else {
    left = Math.round(libreX * fx); top = Math.round(libreY * fy);
  }

  await sharp(src)
    .extract({ left, top, width: cw, height: ch })
    .resize(W, H, { fit: "fill" })
    .webp({ quality: p.q, effort: 6 })
    .toFile(join(OUT, `${p.nom}.webp`));

  const ko = statSync(join(OUT, `${p.nom}.webp`)).size / 1024;
  return { nom: p.nom, id: p.id, src: `${m.width}x${m.height}`, sortie: `${W}x${H}`, ko: +ko.toFixed(1) };
}

const res = [];
for (const p of PLAN) res.push(await fabrique(p));
console.table(res);
console.log("total ko", res.reduce((s, r) => s + r.ko, 0).toFixed(1));
