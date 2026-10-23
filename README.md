# TypeZone

A real-time 1v1 typing battle. Each player has a base and two modes:

- **⛏ Gather**: type ore words to mine gold. Clean streaks build a combo multiplier (up to 2.5x). Golden ore pays 3x but crumbles after 7 seconds. Luck can unlock diamond ore, which pays 5x and also lasts 7 seconds.
- **⚔ Fight**: type the words floating above incoming mobs to destroy them before they reach your base. Kills pay a bounty and charge your ⚡ Lightning.

Spend gold to send mobs at your opponent or to cast spells:

| Key | Item | Cost | Effect |
|---|---|---|---|
| 1 | Goblin | 20 | Fast, 1 short word; 3 charges, 4s recharge |
| 2 | Knight | 45 | Armored: 2 words; 2 charges, 8s recharge |
| 3 | Slime | 35 | Splits into 2 slimelets; 2 charges, 12s recharge |
| 4 | Giant | 90 | Slow, 3 long words, 25 damage; 1 charge, 20s recharge |
| 5 | Frost | 40 | Slow mobs attacking you by 60% for 6s; 15s cooldown from cast |
| 6 | Fog | 45 | Blur your opponent's words for 7s |
| 7 | Repair | 50 | +15 base HP; 20s cooldown from cast |
| 8 | Pickaxe | 40→160 | +25% gather gold (4 levels) |
| 9 | Luck | 50 / 90 / 140 | Golden chance 20% / 28% / 36%; level 3 adds 4% diamond chance |
| 0 | Drill Sergeant | 60 / 100 / 150 | Mob recharge time reduced by 15% / 30% / 45% |

Mob charges start full and refill one at a time while below the cap. Drill Sergeant preserves existing recharge progress when upgraded. Shop buttons show charges, recharge progress, cooldowns, and upgrade levels.

Kills pay `round(mob cost × 0.5 × defender combo multiplier × defender Pickaxe multiplier)`, including Lightning kills. Slimelets use a bounty cost of 6 gold and move at speed 72. The parent Slime pays its own cost-based bounty. While at least three mobs are heading toward your base, passive income increases by 50%, stacking with overtime. The HUD shows this pressure bonus.

Other controls: `Tab` switches mode, `Enter` fires Lightning (strips a word off every incoming mob), `Esc`/`Backspace` drops your target. Typos reset your combo.

You can see your opponent's mode, gold and live typing progress on your mobs, so attack while they're busy mining. At 2:30 overtime starts: mobs keep speeding up and income doubles. At 5:00 sudden death crumbles both bases and Repair is disabled.

## Running

```bash
npm install
npm start          # http://localhost:3000 (override with PORT=...)
npm test
```

Create a room and share the link or 4-letter code, or play **Practice vs bot** (easy / normal / hard).

## Layout

- `server/game.js`: authoritative match simulation (economy, mobs, spells, win conditions)
- `server/bot.js`: simulated typist for practice mode
- `server/room.js`: lobby, countdown, 20 Hz tick loop, rematch, forfeits
- `server/index.js`: static file server + WebSocket entry point
- `shared/`: tuning constants and the word list, used by both server and client
- `public/`: browser client (canvas battlefield, DOM HUD, WebAudio sfx); no build step
