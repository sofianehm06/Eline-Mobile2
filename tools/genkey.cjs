#!/usr/bin/env node
/*
 * Générateur de clés d'activation Eline Mobile.
 *
 *  ⚠️  USAGE STRICTEMENT INTERNE (développeur).
 *  Ce fichier contient la CLÉ PRIVÉE : ne le donnez JAMAIS au client,
 *  ne l'incluez pas dans l'installateur. Gardez-le pour vous.
 *
 *  Le client vous communique l'« ID de cet ordinateur » affiché sur
 *  l'écran d'activation. Vous générez la clé correspondante :
 *
 *      node tools/genkey.cjs A1B2-C3D4-E5F6-7890
 *
 *  Cela affiche la clé d'activation ET écrit un fichier licence-XXXX.lic.
 *  Vous envoyez la clé (ou le fichier) au client : il la colle dans
 *  l'écran d'activation. Elle ne fonctionne QUE sur ce PC.
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

// Clé privée Ed25519 (DER base64) — correspond à la clé publique embarquée dans l'app.
const PRIVATE_KEY_DER_B64 = 'MC4CAQAwBQYDK2VwBCIEINZusH76gkN6yTRV/p8L2H3kSVP+hgAbiK10a1Khn6P4'
const privateKey = crypto.createPrivateKey({
  key: Buffer.from(PRIVATE_KEY_DER_B64, 'base64'),
  format: 'der',
  type: 'pkcs8'
})

const canonical = (id) => String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const arg = process.argv[2]
if (!arg) {
  console.log('\nUsage : node tools/genkey.cjs <ID-DE-LA-MACHINE>')
  console.log("Exemple : node tools/genkey.cjs A1B2-C3D4-E5F6-7890\n")
  process.exit(1)
}

const id = canonical(arg)
if (id.length < 8) {
  console.log('ID machine invalide :', arg)
  process.exit(1)
}

const sig = crypto.sign(null, Buffer.from(id), privateKey).toString('base64')
const file = path.join(process.cwd(), `licence-${id}.lic`)
fs.writeFileSync(file, sig)

console.log('\n==================  CLÉ D\'ACTIVATION  ==================')
console.log('PC (ID) :', arg)
console.log('--------------------------------------------------------')
console.log(sig)
console.log('--------------------------------------------------------')
console.log('Fichier de licence écrit :', file)
console.log('Envoyez cette clé (ou le fichier .lic) au client.\n')
