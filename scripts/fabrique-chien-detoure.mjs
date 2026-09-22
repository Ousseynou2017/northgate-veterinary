/**
 * fabrique-chien-detoure.mjs — le chien posé sur la carte verte.
 *
 * La référence pose un chien DÉTOURÉ sur son encart orange : pas de cadre,
 * pas de rectangle, l'animal est debout sur le bord bas. Il faut donc un PNG
 * à fond transparent, et aucune photo ne vient comme ça.
 *
 * Le détourage est un seuillage, et un seuillage ne marche que si le sujet
 * tranche sur le fond. D'où le choix de la photo : un chien BRUN sur fond
 * blanc de studio (Pexels 3487734). Un chien blanc sur fond blanc est
 * impossible à seuiller — essayé, rejeté.
 *
 * Trois étapes, et la troisième est celle qui compte :
 *   1. rampe douce sur la luminance : blanc -> transparent, sujet -> opaque ;
 *   2. ÉROSION du masque : un flou suivi d'un seuil décalé vers le haut
 *      ronge un ou deux pixels sur le bord. Sans ça il reste un LISERÉ BLANC
 *      autour de l'animal, parfaitement visible sur un aplat vert — c'est le
 *      défaut n°1 d'un détourage par seuil, et le seul qu'on voie à l'œil ;
 *   3. recadrage sur l'alpha, pour que l'ombre portée du studio (grise, donc
 *      partiellement opaque) ne laisse pas une flaque sous les pattes.
 *
 *   node scripts/fabrique-chien-detoure.mjs
 */
import sharp from "sharp";
import { statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
// PHOTO FOURNIE PAR OUSSEYNOU le 22/09 (`img-for-book-your-visite.jpg`,
// racine du dépôt, recopiée en cache). Il l'a choisie exprès sur fond blanc
// pour qu'elle se détoure proprement — c'est la bonne façon de s'y prendre.
const SRC = join(RACINE, ".cache-images", "client-3.jpg");
const OUT = join(RACINE, "public", "img", "cta-chien.png");

// Seuils, en niveaux de gris de l'ORIGINAL :
//   au-dessus de HAUT  -> fond, totalement transparent
//   en dessous de BAS  -> sujet, totalement opaque
// Mesuré sur la photo : les quatre coins sont à 255. La rampe se cale JUSTE
// sous le fond — plus bas, on rend translucide tout le poil clair du poitrail
// et ça fait un voile blanc sur les contours.
// Le fond : assez clair ET assez peu saturé. 244 laisse passer le blanc
// légèrement grisé des bords de studio sans attraper le poil blanc du chien,
// qui plafonne plus bas.
const SEUIL_FOND = 244, SAT_FOND = 14;
// Seuil de la deuxième passe, appliqué UNIQUEMENT dans la bande de bord :
// plus bas que celui du fond, pour attraper l'ombre portée.
const SEUIL_BORD = 228;
// Érosion, en PIXELS de rayon. 2 suffit sur une photo de studio ; au-delà on
// mange les moustaches et le bout des pattes.
const EROSION = 2;

/**
 * Le masque est calculé À LA MAIN, pixel par pixel, et pas avec une chaîne
 * `linear()` de sharp : la première version passait par `linear(-7, 1586)`,
 * et l'auto-contrôle ci-dessous a montré que les deux moitiés de l'image test
 * ressortaient à alpha 0 — le coefficient débordait en silence. Une boucle sur
 * 1,3 million de pixels coûte quelques dizaines de millisecondes et se relit.
 *
 * @param {Buffer} rgb  pixels bruts, 3 canaux
 * @returns {Buffer}    un canal alpha, même largeur/hauteur
 */
function masqueDe(rgb, W, H) {
  const n = W * H;
  // ON PART DU FOND, PAS DU SUJET. Un seuil global sur la luminance marche
  // tant que le chien est foncé ; celui-ci a un poitrail et un chanfrein
  // BLANCS, et le seuil les mangeait — mesuré, il en restait un chien troué.
  // Le fond, lui, a une propriété que le poil blanc n'a pas : il TOUCHE LE
  // BORD de l'image. On propage donc depuis les bords à travers le blanc,
  // et tout ce qu'on n'atteint pas est du sujet, blanc compris.
  const estFond = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    estFond[i] = l >= SEUIL_FOND && sat <= SAT_FOND ? 1 : 0;
  }
  const dehors = new Uint8Array(n);
  const pile = [];
  for (let x = 0; x < W; x++) pile.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) pile.push(y * W, y * W + W - 1);
  while (pile.length) {
    const i = pile.pop();
    if (dehors[i] || !estFond[i]) continue;
    dehors[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) pile.push(i - 1);
    if (x < W - 1) pile.push(i + 1);
    if (y > 0) pile.push(i - W);
    if (y < H - 1) pile.push(i + W);
  }
  // DEUXIÈME PASSE, PRÈS DU BORD SEULEMENT. Il reste deux choses que la
  // propagation ne prend pas : l'ombre portée du studio, qui est grise et un
  // peu trop sombre pour le seuil du fond, et la frange de pixels mi-blancs
  // laissée par l'anti-aliasing. Les deux touchent le contour ; le poil blanc
  // du poitrail, lui, en est loin. On ne nettoie donc que dans une bande de
  // quelques pixels autour du fond déjà trouvé.
  const BANDE = 7;
  const proche = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!dehors[y * W + x]) continue;
      for (let dy = -BANDE; dy <= BANDE; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -BANDE; dx <= BANDE; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          proche[yy * W + xx] = 1;
        }
      }
    }
  }
  let nettoyes = 0;
  for (let i = 0; i < n; i++) {
    if (dehors[i] || !proche[i]) continue;
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (l >= SEUIL_BORD && sat <= SAT_FOND) { dehors[i] = 1; nettoyes++; }
  }
  if (W > 200) console.log("bande de bord nettoyée :", nettoyes, "pixels");

  const a = Buffer.alloc(n);
  for (let i = 0; i < n; i++) a[i] = dehors[i] ? 0 : 255;

  // ÉROSION : alpha = minimum du voisinage. C'est ce qui mange le liseré
  // blanc laissé par l'anti-aliasing du bord, le seul défaut d'un détourage
  // qu'on voie vraiment sur un aplat vert. Deux passes séparables.
  const min1d = (src, r, vertical) => {
    const out = Buffer.alloc(src.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let m = 255;
        for (let d = -r; d <= r; d++) {
          const xx = vertical ? x : Math.min(W - 1, Math.max(0, x + d));
          const yy = vertical ? Math.min(H - 1, Math.max(0, y + d)) : y;
          const v = src[yy * W + xx];
          if (v < m) m = v;
        }
        out[y * W + x] = m;
      }
    }
    return out;
  };
  let e = min1d(a, EROSION, false);
  e = min1d(e, EROSION, true);

  // Adoucissement : une moyenne 3×3, sinon le contour est en escalier.
  const f = Buffer.alloc(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sm = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          sm += e[yy * W + xx]; c++;
        }
      }
      f[y * W + x] = Math.round(sm / c);
    }
  }
  return f;
}

async function masque(chemin) {
  const { data, info } = await sharp(chemin).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { alpha: masqueDe(data, info.width, info.height), W: info.width, H: info.height };
}

// AUTO-CONTRÔLE, sur un cas dont on connaît la réponse : une image moitié
// blanche moitié noire. Le blanc doit ressortir transparent, le noir opaque.
// Sans ce contrôle, une erreur de signe ou un débordement produit le négatif
// du masque et on ne s'en aperçoit qu'à la fin, sur le rendu.
{
  const W = 80, H = 40;
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      px.fill(x < W / 2 ? 255 : 0, (y * W + x) * 3, (y * W + x) * 3 + 3);
  const m = masqueDe(px, W, H);
  const gauche = m[20 * W + 10], droite = m[20 * W + W - 10];
  const ok = gauche < 10 && droite > 245;
  console.log(`auto-contrôle masque : blanc -> alpha ${gauche}, noir -> alpha ${droite} :`, ok ? "OK" : "ÉCHEC");
  if (!ok) process.exit(1);
}

if (!existsSync(SRC)) {
  throw new Error(`Original absent : ${SRC}. Recopier img-for-book-your-visite.jpg depuis la racine du dépôt.`);
}

const { alpha, W, H } = await masque(SRC);

// On assemble le RGBA À LA MAIN plutôt que d'utiliser `joinChannel` : mesuré,
// le PNG qui en sortait avait `hasAlpha: false` — les quatre canaux étaient
// repartis en CMJN quelque part dans la chaîne, et le fond blanc revenait
// opaque. Un Buffer entrelacé ne laisse aucune place à l'interprétation.
const rgb = await sharp(SRC).removeAlpha().raw().toBuffer();
const rgba = Buffer.alloc(W * H * 4);

// DÉPRÉMULTIPLICATION SUR BLANC — c'est ce qui enlève le liseré clair.
// Un pixel de bord n'est pas « du chien » : c'est du chien MÉLANGÉ au fond
// blanc, dans la proportion de sa couverture. Le rendre simplement
// semi-transparent garde ce blanc dedans, et sur un aplat vert ça se voit
// comme un contour laiteux. Le mélange s'inverse exactement quand on connaît
// le fond, et ici on le connaît : il est blanc.
//     observé = vrai × a + 255 × (1 − a)   ->   vrai = (observé − 255 × (1 − a)) / a
let corriges = 0;
for (let i = 0; i < W * H; i++) {
  const a = alpha[i] / 255;
  let r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
  // En dessous de 0,15 de couverture le calcul divise par presque rien et
  // explose en couleurs fausses : ces pixels-là ne portent rien, on les coupe.
  if (a > 0 && a < 0.15) { alpha[i] = 0; }
  else if (a > 0 && a < 0.996) {
    const d = (v) => { const x = (v - 255 * (1 - a)) / a; return x < 0 ? 0 : x > 255 ? 255 : x; };
    r = d(r); g = d(g); b = d(b);
    corriges++;
  }
  rgba[i * 4] = r;
  rgba[i * 4 + 1] = g;
  rgba[i * 4 + 2] = b;
  rgba[i * 4 + 3] = alpha[i];
}
console.log("pixels de bord dépremultipliés :", corriges);
const avecAlpha = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

// CONTRÔLE : le coin haut-gauche est du fond, il DOIT être transparent.
{
  const { data, info } = await sharp(avecAlpha).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const coin = data[(2 * info.width + 2) * info.channels + 3];
  console.log("contrôle alpha du coin :", coin, coin < 10 ? "OK (fond transparent)" : "ÉCHEC (fond opaque)");
  if (coin >= 10) process.exit(1);
}

await sharp(avecAlpha)
  .trim({ threshold: 20 })
  .resize({ width: 400 })
  .png({ compressionLevel: 9, palette: true, quality: 88 })
  .toFile(OUT);

const m = await sharp(OUT).metadata();
console.log("cta-chien.png", `${m.width}x${m.height}`, (statSync(OUT).size / 1024).toFixed(1) + " ko");
