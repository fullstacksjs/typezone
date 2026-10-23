// Word pool, bucketed by length. Lowercase a-z only.

const RAW = `
axe bow orc elf gem ore sky fox owl ice oak ash fir hut ink jam key log mud net pan rat rod
sap tar urn yak zip ant bat cup den egg fog gum hog ivy jet kit lid mob nut oar pig ram saw
tin vat wax yam arc bay cob dew elk fin hex imp jaw kin lip mug nap pod rug sod tub cat dog
sun map run zap web vow hum dig rye wit gap orb rim

wind fire rock gold iron coal ruby jade mine pick cave lava frog wolf bear hawk crow moon star
rain snow leaf tree root bark seed vine moss sand dune hill peak lake pond wave tide reef ship
sail mast rope fort wall gate helm mace club bolt dart bomb claw fang horn tusk hoof wing nest
lair dusk dawn mist haze glow ember zeal void rune glyph oath duel raid loot coin gear cart
kiln dust ruin tomb crypt veil fume husk yarn quiz jolt knot lynx mole newt puma toad wasp
yeti hare boar mule colt fawn kelp cliff vale glen bog moor fern sage mint lime plum pear fig
opal onyx jasper brass zinc tusk drum harp lute bell horn flag tent lamp wick oven pot mug

storm flame stone metal sword spear arrow armor blade forge anvil chest crown jewel tower
river ocean field grove marsh swamp cliff ridge mesa canyon frost blaze spark ember ashes
quest knave rogue ranger druid witch giant troll ghoul demon angel brave noble swift sharp
heavy quick quiet loyal proud grand royal magic charm spell potion scroll wand staff orb
shield helmet gauntlet lance pike flail sling brute beast raven eagle viper cobra tiger
lion panda otter bison moose camel llama koala zebra horse sheep goose quail crane heron
apple grape lemon mango peach melon berry olive cocoa honey bread toast feast candy
plank brick tiles slate cedar maple birch aspen hazel alder willow cloud thunder light
night shade ghost spirit glyph rune relic altar crypt vault siege march rally fight guard
watch scout climb dodge parry slash pierce smash crush break shout yield chant drift float

castle dragon knight goblin wizard hunter archer temple bridge market harbor island valley
forest desert jungle meadow canyon summit glacier tundra lagoon stream spring autumn winter
summer shadow silver bronze copper cobalt marble granite quartz amber garnet topaz zircon
falcon badger beaver ferret jackal walrus python lizard turtle spider beetle hornet mantis
banner trophy riches empire throne palace legion cavalry battle combat strike charge ambush
rescue defend retreat plunder pillage breach rampart turret cannon musket rocket barrel
hammer chisel shovel bucket candle lantern kettle saddle quiver dagger cutlass sabre glaive
mystic arcane cosmic primal savage fierce wicked frozen molten golden hidden ancient sacred

thunder warrior soldier captain general monarch kingdom fortress citadel bastion outpost
crystal emerald diamond sapphire obsidian platinum mercury cyclone tornado volcano
avalanche monsoon tempest blizzard wildfire sunrise sunset twilight midnight starlight
phoenix griffin unicorn chimera basilisk kraken leviathan behemoth goliath sorcerer
champion guardian sentinel catapult trebuchet ballista rampage stampede onslaught uprising
treasure fortune bounty harvest orchard vineyard granary workshop foundry smelter quarry
compass lantern journey voyage odyssey pilgrim nomad explorer frontier horizon skyline
gargoyle sentinel paladin templar crusader vanguard marauder conqueror berserker warlock
necromancer alchemist enchanter illusion mirage serpent scorpion mammoth sabertooth
labyrinth monolith obelisk pyramid colossus juggernaut wanderer lightning earthquake
waterfall snowstorm moonlight firestorm ironclad stronghold battering siegework
`;

// Normalise to unique, clean a-z words.
const ALL = [...new Set(
  RAW.split(/\s+/).map((w) => w.replace(/[^a-z]/g, '')).filter((w) => w.length >= 3),
)];

const BY_LEN = new Map();
for (const w of ALL) {
  if (!BY_LEN.has(w.length)) BY_LEN.set(w.length, []);
  BY_LEN.get(w.length).push(w);
}

function poolFor(min, max) {
  const out = [];
  for (let l = min; l <= max; l++) out.push(...(BY_LEN.get(l) || []));
  return out;
}

const poolCache = new Map();
function cachedPool(min, max) {
  const key = `${min}-${max}`;
  if (!poolCache.has(key)) poolCache.set(key, poolFor(min, max));
  return poolCache.get(key);
}

/**
 * Pick a random word with length in [min, max], preferring words whose first
 * letter is not in `avoid` (so targeting by first letter stays unambiguous) and
 * which are not in `exclude`.
 */
export function pickWord(min, max, avoid = new Set(), exclude = new Set()) {
  const pool = cachedPool(min, max);
  for (let i = 0; i < 40; i++) {
    const w = pool[(Math.random() * pool.length) | 0];
    if (!avoid.has(w[0]) && !exclude.has(w)) return w;
  }
  for (let i = 0; i < 20; i++) {
    const w = pool[(Math.random() * pool.length) | 0];
    if (!exclude.has(w)) return w;
  }
  return pool[(Math.random() * pool.length) | 0];
}

export const WORD_COUNT = ALL.length;
