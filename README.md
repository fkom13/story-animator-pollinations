# Story Animator — Pollinations Code Agent (v0.1)

> Public showcase agent, entirely separate from our private FreeVideoMaker and IACA.
> **Status:** local code and mocked tests; no live Pollinations render or dashboard
> registration claimed. FreeVideoMaker's private Python logic is NOT included.

A community **Code Agent** that proposes a narrated short story with animated
still images, then (after approvals) attempts generation with Pollinations
MCP image, speech, transcription and FFmpeg tools. Production uses only
Pollinations services and the *caller's own Pollen*.

## Layout on PC2

This project is an independent **sibling** of:
- `/home/fkomp/Desktop/oracle/opencode-pollinations-plugin` — unchanged.
- `/home/fkomp/Desktop/oracle/story-animator-pollinations` — this repo.

Pollinations needs an **independent public GitHub repository** with `agent.ts` at
its root. The GitHub source is deployed and executed on Pollinations,
not on GitHub Actions. No custom npm dependencies are installed in the agent.

## V1 — on-boarding (French first)

1. User gives an idea; agent asks only for missing parameters: 15/30 sec,
   story tone, style, 16:9/9:16, Quest Strict or Plus.
2. Agent builds synopsis, scene list, planned shots, voice-over and camera moves;
   it emits a `[[STORY_PLAN:...]]` marker. Conversation history must be supplied
   again on subsequent requests: Pollinations Responses are stateless.
3. `PRODUIRE <id>`: fresh rights/balance/catalog/MCP checks (read-only);
   no media generation. Shows a `PREFLIGHT_OK` marker only when passed.
4. `CONFIRMER <id>`: rechecks rights and authorizes a limited
   set of image/audio/FFmpeg MCP tools for the production turn.
5. Agent attempts to generate images, speech, timed captions and MP4 via
   Pollinations; errors and partial results must be reported, never faked.

**Real video output is not verified until we connect a Pollinations Code Agent
and exercise the alpha MCP servers with a caller key.** The exact MCP tool
schemas are discovered at runtime; authentication is required to list them
outside an agent. Stage 5 is experimental.

V1 purposely has NO I2V, NO dependence on our private Python pipeline, and
NO external VPS. Animated-image effects are described for FFmpeg:
`zoompan`, pans, fades/`xfade`, optional burned-in captions and audio sync.

## V1 Quest compatibility — live registry

Before production, `/v1/models` is read. For Quest Strict, an eligible model
MUST have `paid_only === false` and the relevant input/output/endpoints.
Suggested preferences, with fallback in order:

| Capability | Primary | Backup |
| --- | --- | --- |
| Scenario/chat | `minimax/minimax-m3.1-flash` | `openai/gpt-6-luna` |
| Image T2I | `black-forest-labs/flux.1-schnell` | `tongyi-mai/z-image-turbo` |
| Image edit I2I | `black-forest-labs/flux.2-klein-4b` | `microsoft/mai-image-2.6-flash` |
| TTS voice | `microsoft/mai-voice-2.1-flash` | `openai/tts-1` |
| Speech-to-text/captions | `microsoft/mai-transcribe-2` | `openai/whisper-large-v3` |

Quality Plus is reserved for later: the initial whitelist deliberately
contains no Paid-only model. A mere label `Quest` is not sufficient:
Pollinations spends Quest Pollen first on regular models when it covers
the request; otherwise it could use Paid Pollen. **Quest Strict therefore
requires readable Quest balance (normally `account:usage`) and blocks media
generation if the indicated Quest balance cannot cover the pilot budget.**

## Permission preflight (no secrets!)

The Code Agent does not receive the caller's API key. It uses
`pollinations(path,init)` and MCP helpers provided by the platform.

- `GET /account/key`: validity/type, visible scopes and model restrictions.
- `GET /account/balance`: remaining key budget and, if `account:usage`
  is granted, Quest/Paid balance.
- `GET /v1/models`: current capabilities, availability and `paid_only`.
- MCP discovery: `pollinations` and `ffmpeg` tool catalogs.

A restricted key might allow only `text` but not `image`/`audio`; in that
case preflight stops before media generation and recommends authorizing
the missing categories or exact models in the caller's Pollinations
dashboard. For Quest Strict, missing `account:usage` means it cannot prove
the no-Paid constraint and must fail closed.

**Never request `account:keys` (administrator permission) or have users
paste keys into chat.** No credential is logged. Tools are not exposed during
planning. During production each media model ID must be in the verified
whitelist, and tool calls are capped at 13.

**Important limitation:** the pilot's 0.25-Pollen figure is a
*pre-production estimate/check*, NOT a transactional budget cap enforced
by Pollinations across nested tool calls. The caller should separately
configure a strict key budget in the dashboard. This is also a reason to
test a 15-second pilot and avoid publishing broadly before real validation.

## Testing on PC2

```bash
cd /home/fkomp/Desktop/oracle/story-animator-pollinations
node --test tests/agent.test.mjs
```

Tests use in-memory mocked `pollinations()` and MCP methods. They do not
call paid APIs, nor prove end-to-end video production.

## Publishing to GitHub + Pollinations

1. Push **this repository only** to a public GitHub repository named
   `story-animator-pollinations` on the intended GitHub account.
2. Dashboard <https://enter.pollinations.ai/> → My Models → Agents →
   Create → **Code Agent**, enter the GitHub repository URL.
3. Start agent visibility **private**; a public repository is still needed
   for Code Agent's source.
4. In Pollinations, call the registered agent model ID
   (normally `<github-user>/story-animator-pollinations`) via chat
   with the user's key and the conversation history maintained.
5. Run a 15-second pilot and inspect the output media and actual Pollen costs.
6. Community visibility requires publisher access; only enable after
   successful real tests of the MCP alpha services and key permissions.

Official reference:
<https://github.com/pollinations/pollinations/blob/main/BUILD_YOUR_OWN_AGENT.md>

## Known experimental boundaries

- MCP server names and tool argument schemas are dynamic and were not
  readable anonymously; the agent will discover them when deployed.
- Narrative/scene state currently depends on replaying the conversation;
  restart persistence and cross-session resumability are NOT implemented.
- First MVP's FFmpeg montage, speech timing and captions are **not verified**.
- The SDK's default tool-loop limit and Pollinations MCP's 16-calls/request
  limit may require the future design to break long films into several turns.
- No further media charges should occur without explicit confirmation;
  however planning itself uses a small paid text model call.
- Some user's key restrictions may not be exposed by `GET /account/key`;
  any denied model call must fail rather than silently use Paid.
- Media URLs may be unlisted but accessible to anyone with the link;
  do not submit personal or confidential media in public tests.

## Development rules

No personal credentials, `.env`, logs with tokens, exported MCP secrets,
FreeVideoMaker source, or IACA configuration may be committed here.
