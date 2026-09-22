/**
 * fabrique-logo.mjs — découpe le logo choisi dans la planche fournie.
 *
 * La planche `logo-site-veterinaire.png` (racine du dépôt) porte QUATRE
 * propositions sur un aplat vert foncé. Ousseynou a retenu **celle d'en bas à
 * droite** : la patte contenant une croix, puis le filet vertical, puis
 * NORTHGATE / VETERINARY.
 *
 * Pourquoi un script et pas un simple recadrage : le logo est posé sur un vert
 * qui n'est PAS celui de l'en-tête du site. Servi tel quel, on verrait un
 * rectangle plus sombre dans la barre. On refabrique donc un PNG transparent :
 * le tracé est crème, le fond disparaît. L'alpha est construit à partir de la
 * LUMINANCE — le signe est clair, le fond est foncé, la séparation est franche.
 *
 *   node scripts/fabrique-logo.mjs
 */
import sharp from "sharp";
import { statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const PLANCHE = join(RACINE, "..", "logo-site-veterinaire.png");
const SORTIE = join(RACINE, "public", "img", "logo.png");

const m = await sharp(PLANCHE).metadata();
// Quadrant bas-droit, avec de la marge : le `trim` sur l'alpha recadrera au
// pixel une fois le fond rendu transparent.
const zone = {
  left: Math.round(m.width * 0.49),
  top: Math.round(m.height * 0.5),
  width: m.width - Math.round(m.width * 0.49),
  height: m.height - Math.round(m.height * 0.5),
};

// AUTO-CONTRÔLE : le quadrant doit être majoritairement SOMBRE (le fond vert)
// avec une minorité de pixels clairs (le tracé). Si la proportion de clair
// dépasse la moitié, on ne découpe pas ce qu'on croit.
const stats = await sharp(PLANCHE).extract(zone).greyscale().raw().toBuffer();
const clairs = stats.reduce((n, v) => n + (v > 140 ? 1 : 0), 0) / stats.length;
console.log("auto-contrôle quadrant : part de pixels clairs =", (clairs * 100).toFixed(1) + "%",
  clairs > 0.02 && clairs < 0.5 ? "OK" : "ÉCHEC");
if (!(clairs > 0.02 && clairs < 0.5)) process.exit(1);

// Masque alpha : luminance étirée pour que le vert tombe à 0 et le crème à 255.
const alpha = await sharp(PLANCHE).extract(zone).greyscale().linear(2.6, -150).toBuffer();

const W = 640;
await sharp({ create: { width: zone.width, height: zone.height, channels: 3, background: "#fffcfa" } })
  .joinChannel(alpha)
  .png()
  .toBuffer()
  .then((buf) => sharp(buf).trim({ threshold: 8 }).resize({ width: W }).png({ compressionLevel: 9 }).toFile(SORTIE));

const out = await sharp(SORTIE).metadata();
console.log("logo.png", out.width + "x" + out.height, (statSync(SORTIE).size / 1024).toFixed(1) + " ko");
