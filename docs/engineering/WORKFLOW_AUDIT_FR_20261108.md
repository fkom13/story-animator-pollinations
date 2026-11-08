# WORK IN PROGRESS — Audit du workflow Story Animator v0.2.1
Date : 8 novembre 2026. Agent Pollinations : **PRIVATE**. Source GitHub : publique. **NO-GO publication**.

Ce dossier concerne le **workflow, les critères de routage, la qualité des modèles et la production** — pas la rédaction de la fable ni le contenu d'un scénario particulier.

## Sources du code vérifiées
- src/01-core.js : catalogue, droits, santé et scoring initial.
- src/02-decision.js : arbitrage D3 Free → JEV Paid si autorisé → Microsoft Quest → JavaScript.
- src/02-story.js : classification générale, écriture, direction, découpage.
- src/03-media.js : images T2I, contrôle vision, montage FFmpeg, TTS et sous-titres approximatifs.
- src/04-agent.js : conversation, approbations, reprise, choix manuels.
- agent.ts : concaténation déployée.
- tests/director-v02.test.mjs, tests/decision-fallback.test.mjs : 24 tests de logique réussis.
- tests/media-v02-validate.mjs : vrai test FFmpeg local. Le pilote BEEP-7 de 15 s précédent concerne v0.1.3.

## Matrice d'avancement et limites (preuves séparées des suppositions)

| Étape | État du code et preuve | Limitation avant publication |
|---|---|---|
| Préflight clé du client | En place ; testé sur l'agent privé en réel | Schéma de permission non vérifiable => suspendre achats ; pas de fuite de clé |
| Catalogue + métriques | GET /v1/models et /models/status?minutes=60, réellement interrogés | La santé n'est pas une promesse de disponibilité. Ajouter horodatage/cache |
| MCP/tool discovery | En place, réellement diagnostiqué | Vérifier contraintes de chaque outil, limites et paramètres avec le fournisseur |
| Filtrage Quest/Paid/modèles | En place, tests unitaires | Distinguer prix Free, Quest-compatible, autorisation Paid et budget restant |
| Premier scoring JS | En place, chiffres et heuristiques | Critères génériques, pas de mesure qualité par modalité ; top 3 biaisé |
| Décideur IA multi-tâches | En place, 3 modèles testés sur huit catégories en un appel réel | Ne voit que top 3 JS, pas tous les modèles éligibles |
| Cascade D3/JEV/Microsoft/JS | En place, 12 tests de fallback, D3 live | Politique confidentialité, échecs transitoires, observabilité détaillée |
| Modèle classificateur généraliste | Réel pendant onboarding | Pas de profil de compétences normalisé par tâche, scène et direction artistique |
| Écriture/plan | Scénario 60 s réel, validation plan | Qualité écriture non évaluée en A/B et avec juges indépendants |
| Découpage 5 secondes | En place, 1/3/5 images max selon mode | Variation de rythme limitée ; pas de plan dramaturgique à granularité variable validé |
| Prix prévisionnels | Affichés dans l'onboarding | Estimations fragiles (image, voix, durée de calcul FFmpeg, retry, facturation Paid) |
| Approbation utilisateur | VALIDER SCRIPT puis VALIDER PRODUCTION ; tests | Ré-approbation si modèles/budget changent substantiellement |
| Production T2I | Code générant par lots de quatre ; mocks | Pas de film complet de 60 s v0.2.1 contrôlé de bout en bout |
| Vision première image | Code multimodal + tests mock | Contrôle réel et correction automatico-adaptative non validés ; score null passe |
| I2I / identité personnages | Modèles I2I classés | PAS D'APPEL I2I dans la production actuellement |
| Fallback par métier | T2I, écrivain, TTS : 2 candidats en code | Réalisateur et vision : 1 seul ; STT et I2I non invoqués |
| Animation / effets | Zoom/pan et concat FFmpeg local testés | Effets avancés, vrais fondus/micro-montages, variation dynamique insuffisants |
| TTS / personnages | Une voix TTS prévue ; audio local 15 s | Dialogues multi-intervenants, prosodie, synchro non résolus |
| STT / sous-titres | Modèle STT classé ; drawtext approximatif | STT jamais appelé ; pas de SRT/alignement robuste, sous-titres peuvent être omis |
| Rendu final | FFmpeg local H.264/AAC 15 s OK | Plus de 25 clips non gérés ; longue durée non éprouvée |
| Livraison MP4 | URL MCP renvoyée par l'agent | « done » sans ffprobe réel ni vérification décodage/audio/sous-titres |
| Reprise | État encodé dans l'historique, mocks | Pas de persistance durable/locks/réconciliation facturation |
| Logs de production | Messages console et état agent | Pas d'audit structuré par job, étape, modèle, coût, retry et résultat |
| Documentation | README anglais développeur, benchmarks et logs | Documentation finale multilingue à rédiger après stabilisation |

## Défauts du sélecteur et conséquences

1. La variable « qualité » est un prior éditorial global par modèle, y compris image. Elle ne mesure pas séparément création, composition, référence, identité, précision TTS ou fiabilité du tool calling.
2. Le score initial JavaScript et la grille présentée au modèle décisionnel ont des pondérations différentes. Des candidats performants peuvent être éliminés avant d'être vus par D3.
3. Le champ toolCalling envoyé au classificateur prend la valeur true pour tout candidat « orchestrator » au lieu de rapporter la capacité native réelle, et le contexte, la prise en charge d'images de référence, les voix françaises et la résolution ne sont pas scorés.
4. Une fois l'image 1 générée, le système n'effectue pas de boucle réelle : audit visuel → correction I2I/alternance du modèle → nouvelle image → mesure sur plusieurs plans.
5. Les modèles de décision ne sont pas réinterrogés après de nouvelles données de production, ni lors du montage. Le plan détaillé n'est pas le centre de la décision.
6. Il manque un banc de test comparatif par rôle sur de vraies sorties, des coûts réels et une grille de jugement indépendant.
7. D3 Free peut journaliser les prompts et les employer pour l'entraînement selon la description Pollinations ; offrir un mode confidentialité.
8. Le modèle TTS n'est pas toujours capable des voix demandées ; le mapping des voix dans le code est encore approximatif et dépend du fournisseur.
9. Validation de film insuffisante : une URL média n'atteste ni la durée, ni un vrai rendu, ni l'audio, ni les sous-titres.

## Séparation des niveaux de preuve

- **Réel validé** : 8 catégories de choix en une requête chez D3/JEV/Microsoft ; catalogue utilisateur ; onboarding privé ; pilote 15 s précédent ; clips FFmpeg sur PC2.
- **Simulé / unitaire** : 24 tests de permissions, décision, scénario, reprise et génération par lots.
- **Non validé** : film 60 s complet produit par v0.2.1 pour les trois qualités, I2I réel, qualité de voix/dialogues, cohérence multi-images, sous-titres synchronisés, effets avancés et publication.

## Ordre de travail proposé

- P0 : politique de scoring **par tâche**, source de benchmarks multimodaux, statut/fraîcheur/couverture, application stricte des droits et budget.
- P0 : QA film 60 s réel pour ECO/MEDIUM/PRO avec facture complète et validation du décodage MP4.
- P0 : boucle artistique vision → I2I/retry/fallback → validation des personnages.
- P1 : catalogue d'effets/transitions vérifiés FFmpeg, audio multipersonnages, vrais sous-titres.
- P1 : reprise/idempotence, journaux anonymisés de génération, conformité confidentialité.
- P2 : docs définitives FR/EN/ES, exemples, release notes, attribution et conditions d'usage.

## Décision

**NO-GO public** à cette étape. GitHub reçoit les comptes rendus d'ingénierie et les tickets ; l'agent Pollinations doit rester PRIVATE. La version définitive du README/guide ne sera écrite qu'après tri et validation.
