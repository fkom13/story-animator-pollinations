# État du cache interne Artificial Analysis — 9 novembre 2026

Ce fichier ne contient que des métadonnées de fonctionnement. Les données détaillées de l'API Artificial Analysis Free restent privées sur PC2.

## Confirmé

- Les deux Secret Brokers Connect5 et Connect9 contiennent le secret artificial-analysis-api-key, scope provider/artificial-analysis.
- Premier rafraîchissement réel par Connect9 secret_exec : 9 catégories sur 9, aucun échec, 90 requêtes de quota restantes après les vérifications et les collectes.
- Réinitialisation du quota communiquée par l'API : 2026-11-10 02:36:36 UTC.
- Cache local PC2 : /home/fkomp/.local/share/story-animator/aa-cache-private, répertoire 0700, fichiers 0600.
- Le collecteur utilise six heures de TTL, un verrou Linux flock, un garde quota et conserve les anciennes données valides en cas de panne.
- Dépôt cible fkom13/story-animator-bench-cache-private : créé, cloné et accessible en écriture, mais GitHub confirme PRIVATE FALSE. Il est donc PUBLIC malgré son nom. Aucun benchmark n'y a été envoyé.

| Catégorie | Modèles fournis dans le snapshot |
|---|---:|
| LLM | 200 |
| Text-to-image | 108 |
| Image-editing | 79 |
| Text-to-speech | 104 |
| Speech-to-text | 78 |
| Text-to-video | 37 |
| Image-to-video | 38 |
| Image-to-video with audio | 33 |
| Speech-to-speech | 48 |

Ces nombres ne sont pas des disponibilités sur Pollinations ni une permission pour les utilisateurs finaux.

## Blocages et suites

1. Basculer le dépôt GitHub cible en PRIVATE dans Settings / General / Danger Zone / Change repository visibility. Le collecteur n'autorise pas les uploads tant que l'API GitHub ne confirme pas private=true.
2. La tentative de provisionner automatiquement une credential chiffrée systemd-creds à partir du broker a été bloquée par les contrôles de sécurité. Aucun fichier de clé permanente n'a été créé sur PC2.
3. Le service système de référence a été ajouté au dépôt du code, mais il n'est pas installé ni activé ; le timer utilisateur reste inactive/disabled.
4. Une fois l'export chiffré autorisé et le dépôt privé vérifié, lancer un second passage à cache chaud, puis le timer toutes les six heures.
5. Respecter les droits de redistribution : les réponses brutes Artificial Analysis Free doivent rester dans une destination d'usage interne, pas dans le dépôt public du Code Agent.

## Vérification sans révélation du secret

- python3 scripts/aa_cache_refresh.py --status
- python3 scripts/aa_cache_refresh.py --dry-run
- python3 -m unittest discover -s tests -p test_aa_cache.py -v

Les refresh réels utilisent le secret IACA par référence, sans l'exposer aux commandes persistantes, au modèle ou à GitHub.
