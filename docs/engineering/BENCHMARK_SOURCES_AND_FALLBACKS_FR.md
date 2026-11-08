# SOURCES DE BENCHMARK ET FALLBACKS — inventaire v0.2.1 / RFC v0.3
Document interne de développement, 8 novembre 2026. Les sources sont distinctes de la sélection des modèles et de leur permission d'exécution.

## Résumé : combien de sources sont vraiment intégrées ?

**ACTUELLEMENT : une seule source indépendante de qualité, pour les LLM uniquement : ArtificialWatch.**

D'autres sources sont employées dans le routeur, mais ne sont PAS des benchmarks de qualité :
- Pollinations GET /v1/models : prix, catégories, endpoints, capacités, caractéristiques, santé.
- Pollinations GET /models/status?minutes=60 : métriques d'erreur, latence et volume (observations de disponibilité).
- EDITORIAL_PRIOR dans src/01-core.js : **heuristiques maison codées en dur**, pas un benchmark. Elles ne doivent pas être publiées comme des mesures.
- ArtificialWatch Bench Index : indice composite LLM sous CC BY 4.0, réellement récupéré (avec secours sans cet indice si indisponible). Code : openBenchmark() et BENCHMAP ; correspondance manuelle de quelques IDs de modèles seulement.
- Artificial Analysis : **NON intégré à la production**, pas de clé AA dans l'agent, pas de scores AA réellement reçus par le routeur.

Les décisions D3/JEV/Microsoft ne sont pas des benchmarks indépendants ; elles expriment une préférence sur les données fournies, potentiellement erronée.

## Sources à connecter, par rôle

| Source | Métiers couverts | Identifiant API | Statut | Accès, licence, fallback |
|---|---|---|---|---|
| Pollinations catalogue | Tous | https://gen.pollinations.ai/v1/models | **LIVE** | Public ; permissions effectives contrôlées par la clé utilisateur ; cache très court |
| Pollinations santé | Tous | https://gen.pollinations.ai/models/status?minutes=60 | **LIVE** | Disponibilité et latence, pas Elo ; ancienne valeur uniquement si affichée comme obsolète |
| ArtificialWatch Bench Index | LLM scénariste, réalisateur, raisonnement | https://artificialwatch.com/data/bench-index.json | **LIVE seulement pour IDs mappés** | Sans clé ; CC BY 4.0 avec attribution ; date et couverture ; composite de rangs de classements publics |
| ArtificialWatch Coding Index | Agent code / outils éventuellement | https://artificialwatch.com/data/coding-index.json | Non utilisé | Sans clé, CC BY 4.0 ; mesurer seulement si pertinent pour tool calling |
| Artificial Analysis — LLM | Intelligence, Agentic, Coding, Multilingual, prix et vitesse | https://artificialanalysis.ai/api/v2/language/models/free | **PROPOSÉ**, pas implémenté | Clé AA Free obligatoire, quotas et conditions d'attribution/redistribution ; absence → ArtificialWatch + essais internes |
| Artificial Analysis — T2I | Génération d'images | https://artificialanalysis.ai/api/v2/media/text-to-image/models/free | **PROPOSÉ** | Clé Free, Elo + intervalle confiance ; modèle absent = absence de donnée, non pas Elo zéro |
| Artificial Analysis — I2I | Édition d'image / style / fidélité générale | https://artificialanalysis.ai/api/v2/media/image-editing/models/free | **PROPOSÉ** | Clé Free, Elo + IC. Ne suffit pas à mesurer la continuité des mêmes personnages ; banc d'essai interne complémentaire |
| Artificial Analysis — TTS | Qualité de synthèse vocale | https://artificialanalysis.ai/api/v2/media/text-to-speech/models/free | **PROPOSÉ** | Clé Free, Elo ; valider séparément FR, émotion, stabilité, voix disponibles |
| Artificial Analysis — STT | Reconnaissance vocale | https://artificialanalysis.ai/api/v2/media/speech-to-text/models/free | **PROPOSÉ** | Clé Free, indice WER global ; tester FR et horodatages en interne |
| Story Animator benchmark pack | Chaque tâche + métriques factuelles de production | Fixtures/rapports anonymisés versionnés | **À CRÉER** | Plans tests et résultats comparatifs avec modèle/version/date/critères. Pas de secrets ou prompts privés |
| Logs des jobs | Fiabilité réelle, coût réel, repli, qualité QC | Export local de job redigé | **À CRÉER** | Consentement et anonymisation ; pas de données utilisateur brutes dans GitHub |

Sources de référence :
- https://gen.pollinations.ai/docs
- https://github.com/pollinations/pollinations/blob/main/gen.pollinations.ai/src/docs/models.md
- https://artificialwatch.com/data
- https://artificialanalysis.ai/data-api/docs
- https://artificialanalysis.ai/data-api/docs/reference

**Attention droit des données :** Artificial Analysis publie une API Free avec clé et attribution, mais indique qu'un accès Commercial est nécessaire pour certaines formes de redistribution intégrées à des services B2B. Ne pas redistribuer les scores publiquement dans notre SaaS/agent sans revue du contrat ; ne jamais publier une clé AA sur GitHub. Le plan d'intégration doit être validé contractuellement avant déploiement.

## Stratégie multi-sources / fallback de benchmark (proposée, non codée)

1. Lire toutes les **capacités, droits, tarifs** chez Pollinations. Cette source est obligatoire, non substituable par un benchmark externe.
2. Pour un LLM, associer l'ID exact (version, fournisseur, variante) à un indice indépendant : Artificial Analysis si autorisé ; sinon ArtificialWatch. Si les deux existent, **conserver les deux séparément**, pas fusionner naïvement deux échelles incompatibles.
3. Pour T2I/I2I/TTS/STT, rechercher l'endpoint spécifique Artificial Analysis si une source licenciée et disponible existe ; compléter par nos tests reproductibles sur le style et la langue du projet.
4. Si un benchmark indépendant est inaccessible : conserver marqueur « benchmark manquant », utiliser les capacités et les tests internes ; afficher l'incertitude dans le rapport. **Ne jamais inventer de score universel**.
5. Si deux benchmarks divergent, afficher leur date/échantillon/couverture et demander au modèle de décision un arbitrage sur les critères d'usage ; conserver le score déterministe comme contrôle de cohérence.
6. Si le modèle n'a pas d'ID exact ou est une version différente, **ne pas transférer automatiquement un score d'une autre variante**.
7. Contrôler le temps de fraîcheur (suggestion de politique) : catalogue modèle ~5 minutes, santé ~1 minute, classements indépendants ~24 h, résultats internes versionnés à chaque modification de modèle/provider. Dépasser ce délai = dégrader confiance, pas cacher l'âge de la donnée.

## Mesure de couverture / provenance à afficher par catégorie

Exemple de structure souhaitée pour chaque candidat :

- role : i2i ;
- model_id et version exacts ;
- allowed_by_key : oui/non/inconnu ;
- capabilities_verified : multimodal + références + format ;
- cost_unit_and_value : par image / seconde / token ;
- source_external : Artificial Analysis / aucun ;
- external_metric : Elo + IC + timestamp (ou null) ;
- internal_metric : stabilité d'identité sur trois plans + méthode (ou null) ;
- reliability : période, n, taux 5xx, latence p50/p95 ;
- uncertainties : liste explicite ;
- score_by_role + justification ;
- primary / fallback technique / fallback qualité.

## Les limites à ne pas masquer

- Elo image-editing est une préférence visuelle générale, pas le taux de conservation d'un visage entre deux scènes.
- Un indice de performance LLM n'est pas un benchmark d'imagination, de direction photo ou de qualité du dialogue en français.
- TTS Elo ne garantit pas disponibilité d'une voix « homme/femme/neutre » et d'une langue spécifique.
- WER STT ne donne pas une mesure de précision des sous-titres au mot ni une véritable diarisation.
- Disponibilité actuelle « healthy » n'est pas une réservation de capacité.
- Score « confiance 99 % » d'un décideur n'est pas une probabilité vérifiée en production.

## État GitHub

À conserver dans docs/engineering comme **work in progress**. Après tri, fabriquer une documentation multilingue et une annexe de benchmarks sous licences compatibles.
