# RFC 0.3 — Politique de sélection des modèles PAR MÉTIER ET PAR QUALITÉ
Statut : **PROPOSITION À ARBITRER**, non déployée, non garantie par les tests actuels.
Date : 2026-11-08. Priorité : le workflow et les modèles, PAS le scénario lui-même.

## 1. But du routeur

Un utilisateur arrive avec une idée, une clé Pollinations déléguée, un mode ECO/MEDIUM/PRO, une ambition artistique, une durée personnalisable et éventuellement un budget. L'agent doit sélectionner à chaque étape un modèle principal, un ou plusieurs fallbacks compatibles et un coût prévisionnel. Il ne doit jamais déclarer une compétence qu'il n'a pas vérifiée.

La bonne architecture comporte **deux échelles orthogonales** :
- **Qualité par métier** : intelligence narrative, contrôle des personnages, réalisme image, fidélité édition, voix et précision des sous-titres. Ces critères sont indépendants du prix.
- **Politique économique et opérationnelle** : mode, permissions de clé, budget, tarifs, santé, latence et coût de retry.

Les poids ci-dessous sont un **point de départ technique à calibrer** avec des sorties réelles ; ils ne sont pas des benchmarks établis.

## 2. Pipeline de décision proposé

1. **Préflight clé déléguée** : modèle autorisé/interdit, clé valide, budget/plafond, accessibilité Quest/Paid, capacités MCP. Réessayer/revalider à chaque job et avant chaque achat. En cas d'ambiguïté, ne pas initier une dépense non explicitement permise.
2. **Catalogue vivant** : modèles officiels accessibles avec ID exact, modalités, endpoints, outils, contexte, prix par unité, résolution, langues et voix si publiés. Pas de modèle « fantôme » ajouté par la connaissance du LLM.
3. **Profil de tâches**, calculé avec un petit modèle de classification + code : type de projet, langue, réalisme, nombre de personnages, fréquence des dialogues, références, intensité du montage, exigences TTS, besoins de vision/STT. Chaque rôle a un vecteur de critères et des contraintes bloquantes.
4. **Source(s) de benchmark spécialisées** : ArtificialWatch pour les LLM (actuel), Artificial Analysis par média lorsqu'une clé/licence autorisée est disponible (proposé), évaluations internes Story Animator sur prompts tests (à créer). Toute valeur doit porter source, date, méthodologie, couverture, unité et autorisation de réutilisation.
5. **Filtrage de conformité sans scoring** : les candidats non autorisés, hors catégorie/endpoint, modèles à santé down, format non supporté et contraires aux règles Paid/Quest sont EXCLUS. Jamais de promotion par le décideur IA.
6. **Score qualité par tâche** : sur 0–100, à partir de critères observables et normalisés. L'absence de benchmark n'est ni zéro ni un 100 arbitraire : l'incertitude reste visible et appelle un test rapide.
7. **Score opérationnel** : coût estimé du job complet (incluant retry, taille/résolution, durée, cache, frais FFmpeg), santé basée sur 5xx et tests du fournisseur, latence. Comparer des unités identiques pour les mêmes contraintes de sortie.
8. **Front de Pareto** : conserver les meilleurs sur au moins un axe (qualité, coût, latence, continuité, fiabilité), même s'ils ne sont pas dans le top 3 du score historique. Le modèle de décision ne doit pas être victime du préfiltrage initial.
9. **Décideur IA** : D3 Free premier pour briefs non sensibles, JEV Paid deuxième seulement si clé+mode Pro, sinon Microsoft Quest ; puis Microsoft ou JS ; le modèle peut influencer les pondérations artistiques dans des bornes auditables mais n'a pas le droit de modifier la facturation ou les permissions.
10. **Arbitre déterministe** : calcule le score exact et vérifie l'éligibilité du choix du décideur. Si désaccord au-delà du seuil, expliquer les deux classements, ou appeler l'arbitre secondaire autorisé.
11. **Deux niveaux de fallback** : un fallback technique (429/timeout/5xx) et un fallback qualitatif (image rejetée, incohérence visuelle, voix décevante). Ils peuvent choisir des modèles différents.
12. **Boucle feedback** : première image → contrôle vision avec image réellement jointe → correction I2I ou changement de modèle → évaluation des 2–3 plans suivants → mise à jour du score spécifique au projet.
13. **Production et preuve** : journal par génération et par plan, sortie, prix exact si disponible, effets testés, validation MP4 par ffprobe et lecture réelle. Ne livrer comme « terminé » que les sorties vérifiées.

## 3. Pondérations principales par mode (PROPOSITION v0.3)

Chaque ligne totalise 100 %. Elles donnent les poids des **axes de décision globaux**, puis la qualité se décompose par rôle ci-dessous :

| Mode | Qualité métier | Coût complet | Fiabilité | Latence | Règle Paid |
|---|---:|---:|---:|---:|---|
| ECO | 35 % | 40 % | 18 % | 7 % | Interdite par la politique du projet |
| MEDIUM | 55 % | 20 % | 18 % | 7 % | Interdite par la politique du projet |
| PRO | 70 % | 8 % | 17 % | 5 % | Possible UNIQUEMENT si autorisée par la clé et l'utilisateur |

**Ne pas coder simultanément des poids différents dans src/01-core.js et src/02-decision.js.** Source unique (configuration validée), publiée dans le rapport du job. Le classificateur peut proposer un delta borné, mais la somme doit rester 100 %, les contraintes du projet étant prioritaires.

## 4. Qualité : sous-critères propres à chaque métier (PROPOSITION)

Les colonnes décrivent une évaluation **à l'intérieur** du score qualité du métier, pas la pondération globale du mode.

| Métier | Sous-critères de qualité à évaluer — total 100 % |
|---|---|
| Classificateur/routeur | Exactitude des contraintes 35 %, respect des pondérations 30 %, robustesse 20 %, stabilité décisionnelle 15 % |
| Scénariste | Créativité 25 %, causalité/cohérence narrative 25 %, suivi du brief 20 %, qualité des dialogues dans la langue 20 %, fenêtre de contexte 10 % |
| Réalisateur/storyboard | Dramaturgie et rythme 25 %, continuité visuelle 25 %, cadrage/composition 20 %, raisonnement multimodal 20 %, outils/planning 10 % |
| Orchestrateur | Tool calling fiable 35 %, planification 25 %, gestion des contextes 20 %, reprise/erreurs 20 % |
| T2I | Fidélité au prompt 25 %, réalisme/style 25 %, identité et vêtements constants 20 %, cadrage 15 %, référence/format/résolution 15 % |
| I2I | Préservation identité 35 %, précision d'édition 25 %, qualité des références 20 %, stabilité texture/style 10 %, absence d'artefacts 10 % |
| Vision de contrôle | Détection de défauts 30 %, fidélité au brief 25 %, identification des personnages 25 %, estimation du raccord 20 % |
| TTS | Naturel FR/langue demandée 30 %, expressivité 25 %, prononciation 20 %, voix/personnages 15 %, contrôle de débit/timing 10 % |
| STT/alignement | WER dans la langue 40 %, précision horodatage 30 %, diarisation 15 %, bruit et ponctuation 15 % |
| Effets/montage | Temporalité exacte 30 %, diversité d'effets vérifiés 25 %, adéquation au beat 25 %, fluidité raccords 20 % |

**Exemple concret :** une histoire avec deux personnages récurrents et quatre plans rapprochés fait monter *identité/continuité I2I et vision*, pas la qualité générique de tous les modèles ; un podcast narré donne plus de poids au TTS, à la langue et à l'alignement.

## 5. Une formule vérifiable, et non une croyance dans les probabilités

Soient Q(role, projet, modèle), C(coût complet ramené à 0–100), R(fiabilité), L(latence normalisée) et W(mode). Calcul de base :

Score = Wq × Q + Wc × C + Wr × R + Wl × L.

On ajoute **hors score** les gardes d'éligibilité et les risques de couverture de benchmark. Une probabilité D3/JEV/Microsoft = jugement probabiliste, PAS une preuve d'exactitude de cette formule. L'arbitre JS doit recalculer et éventuellement déclencher une seconde opinion. Conserver les deux avis dans les logs.

Pas de mélange direct de Elo T2I, indice LLM 0–100 et WER STT. Les normaliser séparément, par modalité, avec des groupes de référence stables et documentés. Si absence de mesure, exposer « non évalué », fournir intervalle d'incertitude et proposer un test pilote.

## 6. Politique des modèles / sélection réelle

- **ECO** : exclusivement Free ou Quest autorisés, jamais de Paid implicite ; 1 image/5 s max est un budget de densité, pas une garantie de créativité. Priorité à la narration et à la cohérence.
- **MEDIUM** : uniquement Free/Quest, jusqu'à 3 images/5 s, meilleur choix admissible pour créativité, T2I et I2I. Un excellent modèle Quest peut dépasser un Paid faible.
- **PRO** : Free/Quest/Paid autorisés par clé et choix explicite, jusqu'à 5 images/5 s. Davantage de contrôles visuels et de retouches, pas une obligation de dépenser Paid à toutes les étapes.

Par métier : principal, fallback technique, fallback qualité, règles de retour à l'original et coûts de chaque option ; revalidation de la clé avant appel. Ne pas changer de prix ou de fournisseur sans l'afficher si le consentement donné risque de ne plus couvrir le nouvel achat.

## 7. Qualité : protocole de calibration à construire

- 20 à 50 briefs par famille de tâches (FR et EN, divers styles, 2+ personnages, mouvement, dialogue, sous-titres).
- T2I/I2I : A/B en aveugle sur fidélité, identité, visage, style, composition ; au moins trois plans cohérents par candidat.
- Texte : jugement humain/LLM indépendant avec grille fixe sur causalité, créativité, compréhension du brief et narration.
- TTS : écoute et conformité FR, prononciation, émotions, synchronisation avec vidéo ; ne pas déduire de la simple existence d'un endpoint audio.
- STT : WER et précision des timestamps sur audios de test.
- Décision : pourcentage de respect des contraintes, comparaison exacte des pondérations et coût total du choix.
- Traces par job anonymisées et coût réel par plan pour mettre à jour les poids ; pas d'entraînement sur données utilisateurs sans permission.

## 8. Conditions de passage de RFC à code

- Fichier de politique unique validé, versionné, chiffré par contexte et testé.
- Couverture benchmark par métier mesurée et provenance affichée.
- Tests de refus d'accès Paid/Quest pour chaque tentative et chaque fallback.
- Preuve d'une boucle réelle image 1 → vision → I2I/retry → comparaison image 2–3.
- Preuve de trois films 60 s complets avec MP4 lisible, son, sous-titres, coûts et modèle réellement utilisé.
- Compte rendu honnête de qualité et des problèmes ; pas de badge « production ready » sur la seule base de tests mock.
