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
