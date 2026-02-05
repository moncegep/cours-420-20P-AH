---
title: Example Guide
description: A guide in my new Starlight docs site.
---

## Points d'attention importants

### ⚠️ Avant de commencer : Bonnes pratiques

**1. Planifier la structure avant de saisir les données**
- Dessiner sur papier comment les feuilles seront liées
- Identifier quelles cellules auront des formules vs des valeurs saisies
- Décider des noms de feuilles (sans espaces si possible)

**2. Saisir les données dans l'ordre logique**
1. Créer toutes les feuilles d'abord
2. Saisir les données brutes (notes, matricules)
3. Définir les noms de cellules
4. Créer les formules locales (MOYENNE dans chaque feuille)
5. Créer le tableau de bord avec références
6. Tester avec quelques étudiants avant de tout remplir

**3. Tester fréquemment**
- Après chaque formule, vérifier le résultat avec un calcul manuel
- Exemple : Si Labo1=84, Labo2=80.8, Intra=77.2, Final=75
  - Score = 84×0,2 + 80,8×0,2 + 77,2×0,3 + 75×0,3 = 78,62 ✅

### 💡 Astuces de productivité

**Utiliser F2 pour éditer une formule**
- Cliquer sur la cellule
- Appuyer sur F2
- Les références sont colorées et vous pouvez voir où elles pointent

**Utiliser Ctrl+` pour voir toutes les formules**
- Affiche les formules au lieu des résultats
- Pratique pour vérifier rapidement toutes les formules d'une feuille
- Appuyer à nouveau sur Ctrl+` pour revenir à l'affichage normal

**Utiliser Ctrl+Flèche pour naviguer rapidement**
- Ctrl+Flèche droite : aller à la dernière cellule remplie de la ligne
- Ctrl+Flèche bas : aller à la dernière cellule remplie de la colonne

### 🛡️ Protection contre les erreurs

**Créer une copie de sauvegarde**
- Avant de faire des changements majeurs, sauvegarder une copie
- Fichier → Enregistrer sous → ajouter "_backup" au nom

**Utiliser la vérification des erreurs d'Excel**
- Formules → Vérification des erreurs
- Excel signalera les formules suspectes

**Documenter les formules complexes**
- Ajouter des commentaires dans les cellules (Révision → Nouveau commentaire)
- Ou utiliser la colonne "Commentaires" pour expliquer

### ⚙️ Paramètres Excel utiles

**Activer le calcul automatique**
- Formules → Options de calcul → Automatique
- Si désactivé, vos formules ne se mettront pas à jour!

**Afficher les formules**
- Onglet Formules → Afficher les formules
- Ou raccourci : Ctrl+`

**Masquer le quadrillage (optionnel)**
- Affichage → décocher "Quadrillage"
- Rend le document plus professionnel