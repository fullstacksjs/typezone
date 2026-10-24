# Glossary

- **Purchase prediction**: the local player changes for purchases awaiting server processing. It includes cumulative upgrade prices, gold, charges, health and cooldowns.
- **Processed watermark**: the highest action sequence processed for a player in a match. A snapshot includes the result of every action through this sequence, whether accepted or rejected.
- **Typing view**: the authoritative frame with unprocessed local typing actions applied. It exposes visible targets, their current words, the predicted mode and the active lock.
- **Lock**: the word currently being typed, including target ID, word index and character progress.
