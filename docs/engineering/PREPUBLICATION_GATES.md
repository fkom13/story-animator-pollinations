# PREPUBLICATION GATES — Story Animator (checklist de sortie)
État : DRAFT, aucune autorisation de publication. Date 2026-11-08.
But : garder l'agent Pollinations PRIVATE jusqu'à ce que le workflow réel soit validé. Le dépôt source étant public, aucun secret, token, projet client ou prompt confidentiel ne doit être commité.

## Gates indispensables P0

- [ ] **Sécurité clé utilisateur** : diagnostic réel de clés Quest-only, Paid, restreintes à une famille, budget épuisé, clé invalide, droits non vérifiables. Chaque fallback applique la même politique.
- [ ] **Arbitrage par métier** : politique unique de poids, 8 rôles, modèle décisionnel principal/fallback, preuves de tool calling et de vision, benchmarks avec source/date/couverture et erreurs explicites.
- [ ] **Politique données** : le mode confidentiel ne transmet pas de brief à D3 sans consentement ; choix d'un décideur compatible selon les données fournisseur et le mode.
- [ ] **Coût prévisible** : fourchettes Quest/Paid séparées avant production, estimation des images selon découpage réel, prix audio/FFmpeg, coût retries, refus des dépenses non couvertes par l'accord.
- [ ] **Flux script et validation** : brief → modèle de décision → choix de modèles/étapes → storyboard et budget → VALIDER SCRIPT → VALIDER PRODUCTION ; changement matériel réclame une nouvelle validation.
- [ ] **15s, 30s, 60s E2E** : films complètement générés sur l'agent privé, au moins ECO 60s, MEDIUM 60s, PRO 60s ; aucune image ne doit être créée par l'assistant externe pour « aider » le pipeline.
- [ ] **Cohérence de personnages** : 3+ images à orientations différentes, contrôle vision effectivement multimodal, révision I2I réelle et fallback qualité.
- [ ] **Audio et sous-titres** : narration FR réelle intelligible, choix de voix valide, alignement temporel au minimum par segment, SRT téléchargeable et incrustation visible dans le MP4 ; annoncer franchement ce qui est indisponible.
- [ ] **Effets/montage** : trois vrais profils ECO/MEDIUM/PRO d'effets/rythme, catalogue des transitions validées FFmpeg, inserts rapides, transitions non répétitives, durées exactes et montage final stable.
- [ ] **Preuve média** : vérifier URL HTTP lisible, vraie extension .mp4 disponible, ffprobe durée/pistes/codec, décodage de frames réparties, durée de la voix, présence des sous-titres si demandés.
- [ ] **Reprise/idempotence** : tester interruption après une facture image, après TTS, au milieu d'un segment et avant final ; réexécution ne duplique pas les achats.
- [ ] **Journal QA** : pour chaque étape, modèle réel, fallback, droits, coût estimé/réel, latence, score QC, erreur et résultat, sans stocker de token ni divulguer le brief de l'utilisateur.
- [ ] **Quotas/limites** : test d'un projet de 90+ secondes, sous-montages si plus de 25 clips, tronquage de commandes FFmpeg et timeout correctement gérés.

## Gates documentaires / conformité P1

- [ ] Licence, sources, attribution et droits de redistribution ArtificialWatch/Artificial Analysis clarifiés.
- [ ] README minimal de navigation vers les guides, distinct du cahier d'ingénierie interne.
- [ ] Documentation **français, anglais, espagnol** sur la même version de code, sans traduction automatique non relue des paramètres d'API.
- [ ] Guides : installation Code Agent, configuration du compte, confidentialité D3, modes de qualité, modèle/fallback, onboarding, budget, monitoring, dépannage.
- [ ] Changelog, matrice de compatibilité modèles et MCP, exemples de film avec budget vérifié et médias reproductibles.
- [ ] Échantillons et tests de non-régression avant publication ; procédure de rollback versionné.
- [ ] Revue en lecture seule par second agent + arbitrage des risques résiduels.

## Format des journaux de production proposé

Événement JSON Lines : horodatage UTC, run_id non sensible, stage, task_role,
quality_mode, model_requested, model_served, decision_engine, decision_fallback,
model_fallback, source_benchmark, benchmark_timestamp, key_permission_result
(sans clé), quest_paid_class, estimated_cost, actual_cost_if_available,
latency_ms, tool_called, output_kind, output_validation, qc_result,
retry_reason, approval_revision, error_type.

La **clé brute** et les conversations personnelles ne doivent JAMAIS se retrouver
dans le log public GitHub. GitHub reçoit les tests anonymisés et décisions
d'ingénierie ; les logs utilisateurs restent privés selon leur politique de rétention.

## État connu au 08/11/2026

- Tests automatisés présents : **24/24**.
- Choix de modèles réels : D3/JEV/Microsoft, huit rôles par requête, démontré.
- Agent Code Agent encore **PRIVATE**, dépôt GitHub public.
- Premier film BEEP-7 15 s vérifié sur une version précédente ; montage local FFmpeg H.264/AAC validé.
- v0.2.1 : test scénario 60 s réel, **pas de production 60 s complète validée**.
- **NO-GO publication**, tant que les cases P0 ne sont pas démontrées.

Le document est volontairement préparatoire. Le tri et la documentation multilingue finale sont une phase distincte, à faire après la stabilisation du workflow.
