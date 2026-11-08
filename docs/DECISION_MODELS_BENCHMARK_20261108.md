# Comparatif réel des 8 modèles de décision Pollinations — 08/11/2026

**32 requêtes structurées réussies sur 32** : 8 modèles × 4 tests, via Polli CLI sur PC2 et /v1/chat/completions. Aucun modèle de génération vidéo/image ni aucune clé API n'a été intégré au test.

## Scénarios

| Cas | Situation de réalisation | Référence arithmétique |
|---|---|---|
| S1 | Scénariste, Le Corbeau et le Renard street photoréaliste, Medium Quest | B : A 81,30 / B 89,30 / C 78,80 |
| S2 | Images Pro, garder la même identité des personnages après premier échec visuel | B : A 79,55 / B 91,00 / C 74,00 |
| S3 | Script Eco, coût (55 %) et vitesse (15 %) prépondérants | C : A 51,60 / B 87,30 / C 94,75 |
| S4 | **Modèles réels** : A = GPT-6.1 Terra, B = DeepSeek V4.1 Flash, C = GLM-5.3 Flash, D = GPT-6 Luna | B : A 73,46 / B 76,17 / C 61,79 / D 63,25 |

S1 à S3 utilisent des candidats et critères synthétiques pour mesurer une sélection par rapport à une formule de référence reproductible. S4 utilise le catalogue Pollinations et ArtificialWatch du 8 novembre 2026 avec des facteurs créatifs et scores de coût/latence **explicitement heuristiques**. Ces références ne prouvent pas la qualité cinématographique réelle.

## Résultats

La valeur en pourcentage représente la probabilité annoncée pour le candidat choisi (Span : probabilité Noul indépendante), **pas une précision mesurée**.

| Modèle | Accès | S1 | S2 | S3 | S4 réel | Concordance | Temps moyen |
|---|---|---|---|---|---|---|---|
| Jev 1.14 | Paid | B 70 % | B 100 % | C 77 % | A 83 % | 3/4 | 4,90 s |
| D3 | Free | B 99,5 % | B 100 % | C 99,6 % | B 85,4 % | 4/4 | 5,85 s |
| Microsoft Decision-1 | Quest | A 85 % | B 99,1 % | C 97,6 % | A 69,9 % | 2/4 | 6,14 s |
| Span-01 Lite | Free | B 96,8 % | B 98,8 % | C 96,6 % | A 89,2 % | 3/4 | 5,41 s |
| GPT-6 Luna Decisions | Paid | B 93 % | B 99 % | C 92 % | A 67 % | 3/4 | 5,26 s |
| Kev 4B | Paid | B 62,9 % | B 91,2 % | C 83 % | A 43,2 % | 3/4 | 6,01 s |
| Perplexity Decider V1.2 | Paid | B 83,9 % | B 99,7 % | C 97,7 % | A 49,9 % | 3/4 | 5,19 s |
| Liquid d1 | Paid | A 73,1 % | B 98,8 % | C 79,7 % | A 89,3 % | 2/4 | **4,67 s** |

**Total : 32/32 requêtes valides, 23/32 concordances** avec nos quatre calculs de référence.

### S4 : vrais modèles Quest accessibles et indices vérifiés

| ID | Modèle | Indice ArtificialWatch | Coût 3 000 tokens entrée + 700 sortie | Santé catalogue |
|---|---|---|---|---|
| A | openai/gpt-6.1-terra | 77,6 | 0,004875 Pollen | 96,80 % |
| B | deepseek/deepseek-v4.1-flash | 68,0 | 0,000870 Pollen | 99,44 % |
| C | z-ai/glm-5.3-flash | 25,0 | 0,000800 Pollen | 99,93 % |
| D | openai/gpt-6-luna | 32,8 | 0,0004875 Pollen | 99,51 % |

La préférence de sept décideurs pour Terra en S4, malgré la courte avance arithmétique de DeepSeek selon les pondérations, montre qu'ils ne réalisent **pas obligatoirement le calcul demandé à la lettre**. C'est une divergence de jugement, pas un diagnostic de panne ni une preuve que Terra est inférieur.

## Conclusion technique

- **D3 (Free)** : le seul à rejoindre nos quatre références dans ce mini-échantillon, mais sa fiche annonce que les entrées peuvent être journalisées et utilisées pour l'entraînement. Réserver aux briefs non confidentiels si sa politique de données est acceptable.
- **Microsoft (Quest)** : fonctionne et répond correctement à la variation Eco, mais ses probabilités élevées ne signifient pas que la formule pondérée a été respectée.
- **Jev (Paid)** : utile comme second arbitre, coûts très faibles, réponses structurées et probabilité moins tranchée sur les scénarios ambigus.
- **Span Lite (Free)** : le format natif employé est Noul (plusieurs jugements indépendants), non un classement catégoriel; les pourcentages ne doivent pas être traités comme une distribution normalisée.
- **Perplexity** : exprime la meilleure hésitation visible en S4 (A 49,9 % contre B 47,2 %).
- **Liquid** : plus rapide dans ce petit test, mais ses préférences divergent du calcul de référence en S1 et S4.
- **Kev** : incertitude plus marquée, et latence légèrement supérieure.

La meilleure architecture pour Story Animator serait : **préfiltrage déterministe des permissions et coûts → modèle de décision pour juger les critères qualitatifs → calcul pondéré exact en JavaScript → éventuel arbitre secondaire si désaccord**. Renvoyer l'utilisateur à son propre niveau de qualité et à la politique Quest/Paid avant toute dépense.

Le test n'établit pas la calibration de ces probabilités sur seulement quatre cas. Il compare le **routage et le scoring**, pas la qualité finale des films. Les appels initiaux à /alpha/decisions avaient donné HTTP 500 et certaines sessions détachées des erreurs d'authentification 401/503 ; les 32 mesures finales ci-dessus proviennent exclusivement de véritables réponses réussies via Chat Completions.

## Reproduction et sources

- Script : tests/manual-decision-benchmark.py (Polli CLI authentifiée, aucune clé insérée dans le code).
- Réponses complètes : docs/decision-model-bench-20261108.json.
- Benchmark externe : https://artificialwatch.com/benchmarks — données sous CC BY 4.0 : https://artificialwatch.com/data/bench-index.json .
- Documentation : https://gen.pollinations.ai/docs .

La consommation de la séance complète, y compris les essais exploratoires et reprises, est de l'ordre de **0,001 Pollen** selon les soldes observés ; elle n'a pas été comptabilisée au centième de micro-Pollen par modèle.
