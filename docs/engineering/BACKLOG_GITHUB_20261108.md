# BACKLOG INTERNE — Story Animator, 2026-11-08

Les six tickets ci-dessous ont été matérialisés dans Git pour suivi avant publication. La tentative de création d'Issues GitHub via le connecteur a renvoyé **403 Resource not accessible by integration** : ces tickets sont donc des **fichiers versionnés**, pas des Issues GitHub.

| Ticket | Priorité | Statut | Sujet | Documents |
|---|---|---|---|---|
| SA-001 | P0 | TODO | Score unique par métier et qualité | MODEL_SELECTION_POLICY_RFC_FR |
| SA-002 | P0 | TODO | Benchmarks par modalité, sources, licences | BENCHMARK_SOURCES_AND_FALLBACKS_FR |
| SA-003 | P0 | TODO | Boucle vision → vrai I2I → contrôle identité | WORKFLOW_AUDIT_FR_20261108 |
| SA-004 | P0 | TODO | E2E 60 s ECO/MEDIUM/PRO, coûts, FFmpeg, audio/SRT et validation MP4 | PREPUBLICATION_GATES |
| SA-005 | P1 | TODO | Journal par job, confidentialité D3, idempotence, coûts | WORKFLOW_AUDIT_FR_20261108 |
| SA-006 | P1 | TODO | Tri de documentation et guides FR/EN/ES avant publication | PREPUBLICATION_GATES |

## SA-001 — Score unifié par métier et qualité

- [ ] Définir une politique versionnée unique avec pondérations par rôle (scénariste, réalisateur, T2I, I2I, vision, TTS, STT et orchestration) et mode (Eco, Medium, Pro).
- [ ] Filtrer les modèles interdits, indisponibles ou incompatibles **avant** tout score. Refuser tout dépassement des autorisations Quest/Paid et du budget.
- [ ] Supprimer le faux prior universel : chaque score qualité nécessite source et protocole d'évaluation spécifiques.
- [ ] Ne pas limiter le modèle de décision au top 3 d'un score JS général : conserver des candidats Pareto selon coût, qualité, latence et capacités.
- [ ] Inclure tool calling réel, contexte, vision, plusieurs références, formats, voix/langues et tarifs unitaires vérifiables.
- [ ] Émettre principal, fallback technique, fallback qualité et justification déterministe.

## SA-002 — Sources des benchmarks

- [ ] Cataloguer les sources actives (Pollinations catalogue/santé, ArtificialWatch LLM) avec fraîcheur, licence et couverture par ID exact.
- [ ] Étudier les endpoints Artificial Analysis T2I, I2I, TTS, STT et LLM, en vérifiant les droits de redistribution et les coûts de l'API avant toute intégration.
- [ ] Fallback par source et catégorie, pas de benchmark inventé si indisponible.
- [ ] Banc d'essai interne sur vrais outputs, dont créativité narrative FR, cohérence de plusieurs personnages, TTS français et timing STT.

## SA-003 — Boucle d'optimisation visuelle

- [ ] Première image réellement vue par un modèle vision, vérification de personnages, vêtements, cadrage, style et artefacts.
- [ ] Si rejet : vrai appel I2I avec références ou T2I alternatif, pas une simple alerte.
- [ ] Vérifier au moins trois plans et adapter le classement selon échecs et résultats du projet.
- [ ] Gardes sur retries/coûts et consentement utilisateur à la dépense corrective.

## SA-004 — Pipeline complet et preuves

- [ ] Trois films réels de 60 secondes : ECO, MEDIUM et PRO, tous générés exclusivement par le Code Agent privé.
- [ ] Variété de plans, durée libre, transitions vérifiées, micro-montage au climax ; relecture de l'effet avant de l'annoncer disponible.
- [ ] Narration intelligible et voix adaptées aux personnages, sous-titres visibles et SRT horodaté.
- [ ] FFmpeg : rendu final pouvant dépasser 25 clips via sous-montage, vérification ffprobe, images décodables et audio.
- [ ] Devis avant accord, coûts réellement consommés, repli testé, absence d'achat en double.

## SA-005 — Robustesse et confidentialité

- [ ] Journal anonymisé par job : model requested/served, rôle, décideur, fallback, coût estimé/réel, latence, source benchmark, erreur, QC, date/heure, autorisation.
- [ ] Reprise idempotente malgré fermeture du chat, interruption de génération, échec réseau et plusieurs agents concurrents.
- [ ] Mode confidentiel évitant D3 lorsque le traitement ou l'entraînement des prompts chez ce fournisseur n'est pas acceptable.
- [ ] Séparation journaux privés / GitHub public ; jamais de clé ou de conversation privée dans Git.

## SA-006 — Publication/documentation

- [ ] Faire le tri des RFC, fonctionnalités vérifiées et limites acceptées.
- [ ] Revoir licences, API, conditions d'utilisation et attributions.
- [ ] Produire trois guides cohérents en FR/EN/ES, un README de navigation, un manuel de déploiement et des exemples avec coûts/outputs vérifiés.
- [ ] Tester rollback, réinstaller depuis Git et faire un audit technique indépendant.
- [ ] Garder Pollinations **Private** tant que les gates P0 ne sont pas franchis.

Voir : docs/engineering/WORKFLOW_AUDIT_FR_20261108.md, MODEL_SELECTION_POLICY_RFC_FR.md,
BENCHMARK_SOURCES_AND_FALLBACKS_FR.md et PREPUBLICATION_GATES.md.
