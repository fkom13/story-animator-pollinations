# Story Animator — Dynamic Director v0.2

Pollinations Community Code Agent. Public source repository, PRIVATE agent during tests. No IACA or FreeVideoMaker private source, no creator API key supplied to runtime. The customer's own delegated key pays for Pollinations generations.

## Architecture

- agent.ts: the sole source executed by Pollinations. Built from the four independent source modules.
- src/01-core.js: key, model registry, health and benchmark ranking.
- src/02-story.js: decision classifier, writing, directorial revision, dynamic storyboard and price estimation.
- src/03-media.js: image generation, first-image visual quality check, animated FFmpeg shots, TTS and captions.
- src/04-agent.js: conversational onboarding, human approval, resumable media batches.
- scripts/build.mjs: compile modules into one self-contained agent.ts; arbitrary npm packages are not installed by Pollinations.
- tests/director-v02.test.mjs: mocked key/price/permission and workflow regression tests.
- tests/media-v02-validate.mjs: actual local FFmpeg tests using previously generated media without new image costs.

The former v0.1.3 is protected in git branch safety/pre-dynamic-director.

## Onboarding and caller-key preflight

Before deciding on a model, the agent checks the *current caller's* delegated rights using /account/key and /account/balance; /v1/models lists current capabilities, paid_only and prices; /models/status?minutes=60 supplies operational reliability and latency; Pollinations and FFmpeg MCP discovery verifies accessible tools.

- Any missing text/image/audio/edit/vision category is disclosed before storyboard or spending.
- Missing speech access triggers an immediate warning: no audio narration or dialogue with this key.
- A key which does not prove questPollenOnly cannot guarantee zero Paid spend in Eco/Medium. Scenario planning can proceed; strict production stops until permissions are adjusted. Keys are never pasted into the agent.
- Per-category roles are automatically ranked with primary and fallbacks: classifier, writer, director, orchestrator, vision, T2I, I2I, TTS and STT.
- Scores use user entitlement, modality, live prices, health/latency and clearly labeled editorial creative priors; they are NOT arbitrary hardcoded model allowlists.
- For known matching LLMs, an independent benchmark is fetched live from ArtificialWatch Bench Index, CC BY 4.0. Attribution: https://artificialwatch.com/benchmarks ; dataset https://artificialwatch.com/data/bench-index.json . This is a general LLM benchmark, not a creativity or TTS benchmark; unpaired models get no invented benchmark score.
- Artificial Analysis offers separate media ranking endpoints but requires its own API key and redistribution license, so it is not silently accessed via customer credentials.

## Decision fallback engine (v0.2.1)

The caller's key is checked first. Then the agent fetches the live model
catalogue, pricing, 60-minute health metrics and external LLM index. The
typed-decision service reviews the scenario and **up to eight distinct
production categories in one call** (screenwriter, director, T2I, I2I, TTS,
vision, orchestrator and transcription). It receives only explicitly eligible
models and their metadata; never the raw API key.

The chain is **ordered and strictly enforced**:

- With a Pro project, a key allowing Paid (questPollenOnly=false), and JEV
  available: **D3 Free → JEV Paid → Microsoft-Decision-1 Quest → JavaScript**.
- Eco, Medium, or a key enforcing Quest-only: **D3 Free →
  Microsoft-Decision-1 Quest → JavaScript**.
- Missing/disabled/not-allowed models are skipped automatically. Every
  permission, health and paid_only check uses the caller's latest catalogue.
  Model success cannot override the JavaScript safety filter.

A decision falls back on access denial, insufficient credits, server errors,
timeouts, missing JSON, unexpected option or malformed confidence. The old
JavaScript weighted scorer is the deterministic last fallback. A successful
decision model may reorder the primary choice within an eligible category;
the remaining JavaScript-ranked candidates become role fallbacks.

The decision model's probabilities are estimates, not calibration
guarantees. D3 is a free third-party provider whose description warns
submitted inputs may be logged or used for model training. Do not send
confidential briefs to D3 without choosing an appropriate privacy policy.

Validation: 12 cascade-specific tests plus 12 existing workflow tests,
all passing. A real 2026-11-08 smoke test produced complete eight-category
decisions from D3, JEV and Microsoft (5.90 s / 5.93 s / 6.75 s respectively)
over the same 428-model catalogue. This test generated no images or videos.

## User conversation

1. User proposes an idea, tone and desired length. The agent recommends 15, 30, or 60 seconds, but custom lengths are supported subject to practical runtime/size constraints.
2. The low-cost decision model classifies genre, visual style, complexity, character continuity and rhythm, after the caller-key check. JEV is Paid-only and therefore considered only when Paid is permitted.
3. The user chooses Eco, Medium or Pro and optionally per-stage model/fallback:
   - MODE ECO / MODE MEDIUM / MODE PRO
   - MODELE writer provider/model-id
   - FALLBACK t2i provider/model-id
4. SCENARIO 60 MEDIUM writes a dramatic treatment and optionally has a separate director refine it; the agent presents the full synopsis, character bible, narration, intelligent shot breakdown, individual model rankings, and rough Quest/Paid Pollen cost ranges.
5. VALIDER SCRIPT <project-id> validates the creative plan without buying images.
6. VALIDER PRODUCTION <project-id> explicitly authorizes media generation.
7. CONTINUER generates batches of up to four images, verifies the first actual image through a vision model if authorized, renders animated segments through Pollinations MCP FFmpeg, and finally combines the clips with voice and approximate burned-in subtitles.

All actions use the customer's delegated Pollinations permissions and money, not the publisher's. No fixed Pollen spending ceiling exists in the agent. Key-side budget limits still apply.

## Quality tiers

- Eco: Quest-only strict, up to one image per five seconds, simple but coherent animations.
- Medium: Quest-only strict, up to three images per five seconds, more interesting shot changes and transitions.
- Pro: Quest/Paid models permitted, up to five images per five seconds, ambitious sequences and faster montage.
- In every tier the actual rhythm is decided from the screenplay's narrative intensity. Five seconds is a planning window, not a fixed scene length.
- Voice, captions, photorealism, style, format and requested length are part of the budget estimate.

## Verified and experimental

- Automated tests cover permissions, unavailable audio, user restrictions, class/category selection, dynamic 60/85-second screenplay planning, approvals and replay-safe resumed batches.
- Real local FFmpeg tests cover mixed shot durations, H.264/AAC audio and burned subtitles.
- Pollinations Code Agent runtime and full MP4 still require live smoke testing after syncing this v0.2 revision.
- Subtitles are approximated from script beats; accurate word-alignment and downloadable SRT are not yet guaranteed.
- State is retained by the chat's replayed history marker. Cross-session storage and invisible persistence via Pollinations Computer are not yet implemented.
- Long videos need several CONTINUER interactions because of MCP request call limits. Final media URLs should be checked with a real probe before claiming a valid film.
- A first-image vision QC runs when the caller can access an appropriate vision model. Multi-image I2I continuity remains a future extension.

## PC2 development

Project: /home/fkomp/Desktop/oracle/story-animator-pollinations

Build: npm run build
Unit tests: npm run check
Real local FFmpeg test: node tests/media-v02-validate.mjs

GitHub: https://github.com/fkom13/story-animator-pollinations
Pollinations: https://enter.pollinations.ai
Official guide: https://github.com/pollinations/pollinations/blob/main/BUILD_YOUR_OWN_AGENT.md
