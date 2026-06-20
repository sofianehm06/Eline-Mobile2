# Guide d'utilisation — Eline Mobile

Bienvenue ! Ce guide explique comment utiliser le logiciel au quotidien. Aucune connaissance
technique n'est nécessaire.

---

## 1. Premier démarrage

1. Ouvrez **Eline Mobile** (icône sur le bureau).
2. Allez dans **Paramètres → Boutique** et renseignez :
   - le **nom**, l'**adresse** et le **téléphone** de la boutique,
   - votre **logo** (bouton « Choisir un logo »),
   - vos informations fiscales : **RC**, **NIF**, **AI** (elles apparaîtront sur les tickets).
3. Cliquez sur **Enregistrer**.
4. Allez dans **Paramètres → Imprimante**, choisissez votre imprimante de tickets, puis cliquez sur
   **Imprimer un ticket de test** pour vérifier.

> Des produits de démonstration sont déjà présents pour vous familiariser. Vous pouvez les modifier
> ou les supprimer.

---

## 2. Ajouter vos produits

Menu **Produits → Nouveau produit**.

- **Accessoire** (coque, chargeur, écouteurs…) : choisissez le type « Accessoire », indiquez le prix
  d'achat, le prix de vente, le **stock initial** et le code-barres (scannez-le directement dans le champ).
- **Téléphone** : choisissez le type « Téléphone ». Le suivi par **IMEI** est activé automatiquement.
  Vous n'indiquez pas de stock ici : vous ajouterez les IMEI à l'étape suivante.

💡 Vous pouvez imprimer une **étiquette code-barres** pour chaque produit (icône code-barres dans la liste).

---

## 3. Gérer le stock

Menu **Stock & IMEI**.

- **Accessoires** : bouton **Réception** pour ajouter de la quantité (nouvel arrivage), ou **Ajuster**
  pour corriger l'inventaire.
- **Téléphones** : bouton **Gérer IMEI** (ou onglet « Unités IMEI » → **Ajouter des IMEI**). Saisissez ou
  **scannez** les numéros IMEI, un par ligne. Indiquez le prix d'achat, le prix de vente et la garantie.

L'onglet **Mouvements** affiche tout l'historique des entrées/sorties.

### Reprise d'occasion (rachat de téléphones)
Menu **Reprise → Nouvelle reprise**. Saisissez le **modèle**, l'**IMEI**, l'**état** (Neuf, Très bon, Bon…),
le **prix de rachat** (ce que vous payez au client) et le **prix de revente** prévu. Le téléphone **entre
automatiquement en stock** avec son IMEI : vous pouvez le revendre normalement depuis la Caisse.

---

## 4. Vendre (Caisse)

Menu **Caisse** — c'est l'écran que vous utiliserez le plus.

1. **Scannez** le code-barres d'un produit, ou recherchez-le et cliquez dessus.
   - Pour un téléphone, choisissez l'**IMEI** vendu dans la liste.
2. Ajustez les quantités, ajoutez une **remise** si besoin.
3. Cliquez sur **Encaisser**.
4. Choisissez le **mode de paiement**. En espèces, saisissez le **montant reçu** : la **monnaie à rendre**
   s'affiche automatiquement.
5. (Optionnel) associez un **client**.
6. Validez : la vente est enregistrée et le **ticket s'imprime tout seul**.

> Astuce : le bouton **Réimprimer** permet de réimprimer le dernier ticket.

**Vérifier un prix sans vendre** : en Caisse, bouton **« Vérifier prix »** → scannez l'article → son nom,
son prix et son stock s'affichent. Vous pouvez ensuite l'ajouter à la vente ou fermer.

**Vendre à crédit** : choisissez le paiement **Crédit**, sélectionnez le **client** (obligatoire),
saisissez l'**acompte** versé maintenant (peut être 0). Le reste est ajouté à l'ardoise du client.

> 🔎 **Scanner** : le pistolet laser lit les **codes-barres rayés** des accessoires et le **code-barres de
> l'IMEI** sur la boîte des téléphones. Gardez le curseur dans la barre de la Caisse et scannez.
> (Les QR codes nécessitent un lecteur 2D — le pistolet laser ne les lit pas.)

---

## 5. Historique & remboursements

Menu **Ventes** : retrouvez toutes les transactions, filtrez par date, ouvrez un ticket pour le
**réimprimer** ou le **rembourser**.

**Remboursement (total ou partiel)** : ouvrez le ticket → **« Rembourser… »**. Indiquez la **quantité à
rendre pour chaque article** (ou « Tout rembourser »), le montant à rendre s'affiche, puis confirmez.
- Le **stock est réintégré** automatiquement (et les téléphones IMEI remis en stock).
- Si vous ne remboursez qu'une partie, le ticket passe en statut **« Partiel »** et les chiffres (CA,
  bénéfice) sont mis à jour avec les **montants nets**. Une vente entièrement remboursée passe en **« Remboursé »**.

---

## 6. Crédit & ardoise (dettes clients)

Menu **Crédit**. Vous y voyez tous les clients qui vous doivent de l'argent, le **total des créances** et,
pour chacun, le **solde dû**.
- **Encaisser** : enregistrez un paiement (total ou partiel) ; le solde se met à jour automatiquement.
- **Relevé** : l'historique complet du client (ventes à crédit et versements) avec le solde courant.
- **WhatsApp** (icône verte) : envoie au client un rappel pré-rempli de son solde.

---

## 7. Migration des données (Import / Export Excel)

Menu **Paramètres → Import / Export**.
- **Exporter** : un fichier Excel avec toutes vos données (produits, IMEI, ventes, clients…). Pratique pour
  vos analyses ou pour partir vers un autre logiciel.
- **Importer** : vous venez d'un ancien logiciel ? Téléchargez le **modèle** (Produits / Clients / IMEI),
  remplissez-le avec vos données, puis importez-le. Les produits existants (même SKU/code-barres) sont mis à jour.

---

## 8. Clients & fournisseurs

- **Clients** : enregistrez vos clients pour suivre leurs achats et garanties.
- **Fournisseurs** : gardez la trace de l'origine de vos produits.

---

## 9. Suivre votre activité

- **Tableau de bord** : ventes du jour, bénéfice, CA du mois, alertes de stock faible.
- **Rapports** : choisissez une période pour voir le chiffre d'affaires, le bénéfice et les produits les
  plus rentables. Bouton **Exporter CSV** pour ouvrir les chiffres dans Excel.

---

## 10. Sauvegarder vos données ⚠️ Important

Menu **Paramètres → Sauvegarde**.

- Vos données sont enregistrées **automatiquement** sur l'ordinateur après chaque opération.
- Faites régulièrement une **sauvegarde manuelle** sur une **clé USB** (bouton « Sauvegarder maintenant »).
  En cas de problème d'ordinateur, vous pourrez tout **restaurer**.

---

## Questions fréquentes

**Le ticket ne s'imprime pas ?**
Vérifiez dans **Paramètres → Imprimante** que la bonne imprimante est sélectionnée, puis « Imprimer un
ticket de test ». Assurez-vous que l'imprimante est allumée et a du papier.

**Le scanner ne fonctionne pas ?**
Placez le curseur dans la barre de recherche de la **Caisse** et scannez. La plupart des lecteurs USB
fonctionnent sans installation.

**Comment changer un prix ?**
Menu **Produits**, cliquez sur le crayon ✏️ du produit.

---

Bon travail avec **Eline Mobile** ! 📱
