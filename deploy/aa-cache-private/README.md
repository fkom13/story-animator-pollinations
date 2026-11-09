# Story Animator: private Artificial Analysis benchmark cache

Status: coded and unit-tested, NOT ENABLED (2026-11-09). The Pollinations Code Agent remains private.

## Why a central cache?

Artificial Analysis Free API quota: 100 calls per fixed 24-hour window shared by user/organization. Nine categories fetched four times daily: about 36 calls/day irrespective of how many users open Story Animator. Actual quota remaining and reset are read from response headers; collector stops before exhausting allowance.

Legal restriction: Artificial Analysis Free data are for INTERNAL USE ONLY. Do not publish the raw benchmark payload to a PUBLIC GitHub repository or distribute it through a public Code Agent. The collector, tests and schedule can be public; the AA data must stay in restricted storage. Terms and pricing: https://artificialanalysis.ai/data-api and https://artificialanalysis.ai/data-api/docs .

## Current design

- PC2 single-writer job: scripts/aa_cache_refresh.py with Linux flock, category TTL of six hours and max 52 recorded calls per 24h. Nine categories: LLM, T2I, I2I, TTS, STT, T2V, I2V, I2V with audio, speech-to-speech.
- Private files: ~/.local/share/story-animator/aa-cache-private, mode 0700 directories and 0600 data.
- API key comes from Connect9 or Connect5 Secret Broker, or from an encrypted systemd credential (not from source control or a plaintext .env).
- If a PRIVATE GitHub repository is configured, the collector independently verifies that GitHub REST returns private=true BEFORE copying benchmark files. Public repo is explicitly rejected.
- Public source GitHub keeps scripts, docs, tests and *aggregate non-sensitive metadata only*.
- Public Pollinations Code Agent users NEVER call AA nor receive raw Free API data. Continue to use ArtificialWatch CC BY 4.0, Pollinations health/price/availability and our own independent tests for community ranking.
- Last successful snapshots remain when 429, 5xx or key errors occur; no rapid retry storm.
- The key provided in chat should eventually be rotated at the source if the owner wants it to be confidential again.

## Two secure IACA refs

Connect5 and Connect9 target the same ref within separate Secret Brokers:
secret://provider/artificial-analysis/artificial-analysis-api-key

The user must submit the secure input widget for each node. Reading secret metadata shows configured=true only after saving. The value is never a ChatGPT tool parameter.

## PC2 encrypted service credential (after secure input)

Use the Connect9 IACA secret_exec operation to inject AA_API_KEY for a single command, which passes its bytes directly to systemd-creds encrypt --with-key=host --name=aa-key - ~/.config/story-animator/aa-key.cred . The raw secret must never appear in shell history, logs or a GitHub commit. No plaintext .env is needed.

After provisioning, copy the example service and timer into ~/.config/systemd/user and enable the timer only once the credential is installed.

    systemctl --user daemon-reload
    systemctl --user enable --now story-animator-aa-cache.timer
    systemctl --user start story-animator-aa-cache.service
    systemctl --user list-timers story-animator-aa-cache.timer

The timer runs every six hours, with jitter. The service uses LoadCredentialEncrypted rather than storing the key in the unit.

## Optional PRIVATE GitHub mirror

The connected GitHub integration could not create a private repo automatically. Create a repository manually with PRIVATE visibility, e.g. fkom13/story-animator-bench-cache-private, only accessible to internal authorized maintainers.

Clone to ~/Desktop/oracle/story-animator-bench-cache-private; add an empty .aa-private-only marker. The refresh job rejects all pushes until origin is confirmed private by GitHub API. Never change that repository to Public, and never link the raw data directly from a community agent.

We should not rely solely on GitHub Actions: the fkom13 CI had a billing lock. PC2 systemd is the primary schedule; a private GitHub Action can be added later if authorized and enabled.

## Validation

Dry run, no key or API calls:

    python3 scripts/aa_cache_refresh.py --dry-run
    python3 -m unittest discover -s tests -p test_aa_cache.py -v

Live smoke test only after secure broker entry is configured. Monitor metadata with:

    python3 scripts/aa_cache_refresh.py --status

Do NOT display raw benchmark contents in logs or public documentation.

## Redistribution

For serving AA-derived rankings to public users, seek Artificial Analysis Commercial redistribution rights, or publish separate independent benchmark results created with sufficient rights. Until then, public cache remains only technical metadata, not licensed AA datasets.
