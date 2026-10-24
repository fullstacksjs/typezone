# Glossary

- **Purchase prediction**: the local player changes for purchases awaiting server processing. It includes cumulative upgrade prices, gold, charges, health and cooldowns.
- **Processed watermark**: the highest action sequence processed for a player in a match. A snapshot includes the result of every action through this sequence, whether accepted or rejected.
- **Typing view**: the authoritative frame with unprocessed local typing actions applied. It exposes visible targets, their current words, the predicted mode and the active lock.
- **Lock**: the word currently being typed, including target ID, word index and character progress.
- **Lesson policy**: the shared permissions and guidance for the current tutorial lesson and predicted mode. It cannot advance authoritative progress.
- **Airdrop**: a crate holding one hidden item, raced for by typing its word from Fight mode. Its contents stay on the server until it is claimed.
- **Claim**: the first completed airdrop word. Later claims for the same crate are rejected.
- **Item**: a held airdrop reward, revealed only to its owner. Snapshots are redacted per seat, so the opponent's items have no type.
- **Tutorial completion**: the `done` lesson, with frozen simulation and closed gameplay input while the final battlefield and exit choices stay visible.
- **Offer**: a purchasable entry in `OFFERS` (mob, spell or upgrade). It owns its price, readiness, predictable player changes and authoritative match effect.
- **Item kind**: an entry in `ITEM_KINDS` that owns an airdrop item's use conditions and effect.
- **Command**: a gameplay wire action (`{ t, ... }`) with a row in `COMMANDS`. `Game.apply` and `Tutorial.apply` run commands; Room dispatches every in-match message through them.
- **Match session**: the browser's per-match prediction state (`MatchSession`): sequence, purchase prediction, typing view and the merged frame it draws.
- **System**: a match component that owns one mechanic (clock, mine, battlefield, airdrop supply). `Game` composes them and injects shared ids and the event log.
