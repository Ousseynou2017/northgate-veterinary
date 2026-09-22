/**
 * verifie-images-temporaires.mjs — le build refuse de produire une version
 * publiable tant que le remplissage temporaire est encore là.
 *
 * Pourquoi un script et pas un commentaire : un commentaire se lit, s'oublie,
 * et part en ligne avec le reste. Ici le build ÉCHOUE, code de sortie 1, et
 * aucun lien ne peut partir avec ces fichiers dedans.
 *
 *   npm run build                 -> contrôle informatif, n'échoue jamais
 *   PROD_READY=1 npm run build    -> ÉCHOUE si le dossier est encore référencé
 *
 * Ce qui est contrôlé, dans dist/ uniquement, c'est-à-dire sur ce qui serait
 * réellement servi :
 *   1. toute référence textuelle au dossier, dans n'importe quel fichier servi
 *      (HTML, CSS, JS, JSON, SVG, map) — un chemin en dur, une URL construite,
 *      un import ;
 *   2. la présence physique des fichiers copiés dans dist/.
 *
 * Le contrôle ne regarde PAS les sources : un chemin écrit dans src/ mais
 * jamais rendu ne bloque pas la livraison. C'est le rendu qui décide.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(RACINE, "dist");
const MARQUEUR = "_TEMPORAIRE-A-REMPLACER";
const LISIBLES = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".xml", ".txt", ".map"]);

const prodReady = !!process.env.PROD_READY && process.env.PROD_READY !== "0" && process.env.PROD_READY !== "false";

if (!existsSync(DIST)) {
	console.error("[images temporaires] dist/ est absent — lance le build avant ce contrôle.");
	process.exit(1);
}

/** Parcourt dist/ et rend tous les fichiers, en chemins absolus. */
function fichiers(dossier) {
	const out = [];
	for (const entree of readdirSync(dossier)) {
		const chemin = join(dossier, entree);
		if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
		else out.push(chemin);
	}
	return out;
}

const tous = fichiers(DIST);

// 1. références textuelles dans ce qui est servi
const references = [];
for (const f of tous) {
	if (!LISIBLES.has(extname(f).toLowerCase())) continue;
	if (relative(DIST, f).includes(MARQUEUR)) continue; // les fichiers eux-mêmes, comptés au 2
	const contenu = readFileSync(f, "utf8");
	if (!contenu.includes(MARQUEUR)) continue;
	const lignes = contenu.split(/\r?\n/);
	const occurrences = [];
	lignes.forEach((ligne, i) => {
		if (!ligne.includes(MARQUEUR)) return;
		// on rend le chemin, pas la ligne entière : un HTML minifié tient sur une ligne
		for (const m of ligne.matchAll(new RegExp(`[^"'()\\s]*${MARQUEUR}[^"'()\\s]*`, "g"))) {
			occurrences.push({ ligne: i + 1, chemin: m[0] });
		}
	});
	references.push({ fichier: relative(DIST, f), occurrences });
}

// 2. fichiers physiquement copiés dans dist/
const copies = tous.map((f) => relative(DIST, f)).filter((f) => f.includes(MARQUEUR));

const total = references.reduce((n, r) => n + r.occurrences.length, 0);

if (total === 0 && copies.length === 0) {
	console.log("[images temporaires] aucune trace dans dist/ — la sortie est publiable de ce point de vue.");
	process.exit(0);
}

const entete = prodReady ? "ÉCHEC" : "AVERTISSEMENT";
console.log("");
console.log(`[images temporaires] ${entete} — le remplissage temporaire est encore dans le build.`);
console.log(`  ${total} référence(s) dans ${references.length} fichier(s) servi(s)`);
console.log(`  ${copies.length} fichier(s) copié(s) dans dist/${MARQUEUR}/`);

for (const r of references) {
	const apercu = [...new Set(r.occurrences.map((o) => o.chemin))].slice(0, 6);
	console.log(`\n  ${r.fichier} — ${r.occurrences.length} occurrence(s)`);
	for (const chemin of apercu) console.log(`      ${chemin}`);
	if (r.occurrences.length > apercu.length) console.log(`      … et ${r.occurrences.length - apercu.length} de plus`);
}

if (!prodReady) {
	console.log("");
	console.log("  Build laissé vert : PROD_READY n'est pas posée, c'est une maquette de travail.");
	console.log("  Pose PROD_READY=1 pour vérifier qu'une version publiable passerait.");
	process.exit(0);
}

console.log("");
console.log("  PROD_READY est posée : cette sortie NE DOIT PAS partir.");
console.log("  Remplace les images, une ligne par emplacement dans reference/IMAGES.md,");
console.log(`  puis supprime public/img/${MARQUEUR}/ en entier.`);
console.log("");
process.exit(1);
