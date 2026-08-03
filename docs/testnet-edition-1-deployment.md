# Testnet Edition 1 Deployment

## Deployment Record

| Field | Value |
| --- | --- |
| Program ID | `zkbugbounty_7f3c92.aleo` |
| Network | Aleo Testnet |
| Previous edition | `0` |
| Current edition | `1` |
| Consensus Version | `18` |
| Upgrade transaction | `at1jlz849t23sdyc58kdxevxl50x6kpjq8ypcf9253d825vvkeu9c8sshk78x` |
| Fee transaction | `at15c8j82u3mpxj0c6fq3kq9873rmzly0h8gegumypjtafz4wlg8s8q6k0c5r` |
| Candidate commit | `e6bf874a744f1913b1b6a30ca7db47a4f1215043` |
| Candidate tag | `escrow-v2-testnet-v18-candidate` |
| Leo | `4.4.0` |
| snarkVM | `4.9.0` |
| Result | accepted / confirmed |

## Fee Summary

| Fee | Credits |
| --- | --- |
| Transaction storage | `36.270000` |
| Program synthesis | `3.161866` |
| Namespace | `1.000000` |
| Constructor | `0.002000` |
| Base fee | `40.433866` |
| Priority fee | `8.000000` |
| Total fee | `48.433866` |

## Verification Evidence

The official public API verified the upgrade transaction as `deploy`, with deployment edition `1`, the expected Program ID, and the expected owner. The Program endpoint and `latest_edition` endpoint returned HTTP 200; `latest_edition` returned `1`.

The standalone fee transaction endpoint returned HTTP 404 at the post-deployment query time. This document therefore records the public fee transaction identifier supplied by Leo, but does not claim an additional API-level relationship beyond the accepted upgrade transaction and the Leo result.

The broadcast timestamp and block metadata are not recorded here because they were not independently extracted during this write-only documentation step.

## Security and Quality Gates

- WCEI final decision: `ACCEPTED`.
- Local Devnode Escrow v2 E2E: PASS; Credits conservation: `0` microcredits.
- Credits Future failure atomicity probe: PASS.
- Candidate source changed after deployment: NO.
- Existing Candidate tag remains immutable and unchanged.
- Documentation contains only public deployment metadata and no credential material, signed payload, or proof payload.

## Runtime Status

Aleo Testnet reports Program edition `1`. Escrow v2 capability is read from the public Program source and current edition at runtime. Payment state still requires confirmed wallet transactions and Mapping verification; UI state is not payment authority.

## Production Frontend Status

At `2026-08-03T13:28:13Z`, `https://aleo-gilt.vercel.app` returned HTTP 200. Its deployed public APIs still reported edition `0` and `ProgramUpgradeRequired`, which identifies the prior Vercel build as stale. The local source now verifies edition `1` and Escrow v2 capability from public endpoints, but this repository change has not been redeployed to Vercel in this task. A separate frontend deployment is required before production UI can present the updated status.