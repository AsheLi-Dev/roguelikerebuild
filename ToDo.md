# Finger Mod Implementation Plan

Ordered from easiest to most complex. Mods that share the same hook or logic are grouped together — implement the whole group in one pass.

---

## Tier 1 — Trivial (single condition check inside an existing hook)

### Group A — Damage-at-attack multipliers
> All four share the same pattern: inside `damageEnemy()` in `combat.js`, check a condition on the enemy or player state and multiply `amount` before it is applied. One implementation pass covers all four.

- [x] **Execute Pressure** (`main_execute_pressure`)
  Check `enemy.hp / enemy.maxHp < 0.30` → apply `× 1.50`.

- [x] **Bleed Synergy** (`main_bleed_synergy`)
  Check `enemy.status.bleed` (or equivalent bleed flag) is active → apply `× 1.20`.
  Bleed lives on `enemy.state` (not `status-manager`): checks `bleedStacks > 0 && bleedTimer > 0`. Works with knives skill, bleed finger, and crit-bleed ring.

- [x] **Close Range Dominance** (`main_close_range_dominance`)
  Compute `distance(player, enemy)`. If within ~120px → apply `× 1.30`.

- [x] **Dash Consumption Power** (`main_dash_consumption_power`)
  Read `player.movement.dashCharges` and `getMaxDashCharges(game)`. Missing charges = max − current. Apply `× (1 + missingCharges × 0.10)`.

---

### Group B — Level-up hooks
> Both trigger from `onLevelUp()` in `experience.js`. Add the new mod checks side by side in that function.

- [x] **Level Gold Burst** (`main_level_gold_burst`)
  On level up: `game.gold += 100 * game.player.level`.

- [x] **Level Up Sustain** (`main_level_up_sustain`)
  On level up: heal player for `10%` of max HP; +20% move speed for 3s via `levelUpSpeedTimer` in `fingerExperimentState`, cleared by `updateFingerExperimentRuntime`.

---

### Group C — Periodic Empower (reuse existing timer infrastructure)
> `main_empowered_strike` already has a 3-second timer and a ready-flag in `finger-experiment-runtime.js` and the damage check in `roguelike-game.js`. `main_periodic_empower` is mechanically identical. Generalise the runtime check to fire for either mod ID and mark it implemented.

- [ ] **Periodic Empower** (`main_periodic_empower`)
  In `finger-experiment-runtime.js`: extend the `activeMainMod` check to also match `main_periodic_empower`. In `roguelike-game.js`: the existing `empoweredStrikeReady` flag already does the job. Just mark `implemented: true`.

---

## Tier 2 — Easy (small new hooks, no new state machines)

### Group D — Chest hooks
> All three fire from `openSearchable()` in `searchables.js`, right after `game.spendGold(goldCost)`. Add a single "finger mod chest block" that handles all three checks together.

- [ ] **Chest Refund** (`main_chest_refund`)
  10% chance → `game.gold += Math.floor(goldCost * 0.50)`.

- [ ] **Chest Healing** (`main_chest_healing`)
  10% chance → heal player for 10 HP (capped at max HP).

- [ ] **Chest Max HP Scaling** (`main_chest_max_hp_scaling`)
  On every chest open: increment a persistent counter (stored in `fingerExperimentState.chestHpGained`). If `< 100`, add 5 to max HP via `setPlayerStatSource`.

---

### Group E — On-crit triggers
> Both fire from the same point in `combat.js` immediately after `resolvedMeta.isCrit = true` is set (around line 1034). Add a "finger crit block" that checks for both mods.

- [ ] **Crit Recharge Dash** (`main_crit_recharge_dash`)
  On crit: `player.movement.dashCharges = Math.min(dashCharges + 2, getMaxDashCharges(game))`.

- [ ] **Critical Infliction** (`main_critical_infliction`)
  On crit: pick a random entry from `['burn', 'poison', 'bleed']` and call `applyStatusPayload(enemy, payload)`.
  ⚠️ Same bleed dependency as Bleed Synergy above.

---

## Tier 3 — Medium (new state fields or cross-system coordination)

### Group F — Incoming-damage hooks
> All three fire when the player takes damage. Find the player damage-taken path (the place where player HP is actually decremented) and add a "finger damage-taken block". Each mod either modifies the incoming amount or creates a side effect.

- [ ] **Sprint Damage Reduction** (`main_sprint_damage_reduction`)
  If `player.movement.state === 'sprint'` (or `sprintTimer > 0`): multiply incoming damage by `0.70` before applying.

- [ ] **Gold Shield** (`main_gold_shield`)
  If `game.gold > 0`: consumed = `Math.floor(game.gold * 0.01)`. Subtract from gold. Reduce incoming damage by `consumed * 0.10`. Minimum 0 damage.

- [ ] **Hit Slow Field** (`main_hit_slow_field`)
  On taking damage: loop `game.enemies`, compute distance to player, for all enemies within ~150px call `applyStatusPayload(enemy, { slowDuration: 0.5, slowMult: 0.30 })`.

---

### Group G — Kill-event hooks
> Both fire on enemy death. Piggyback onto the `onEnemyKilledByPlayer(game, enemy)` call in `combat.js` (line ~1156).

- [ ] **Crit Gold Drop** (`main_crit_gold_drop`)
  Pass `isCrit` flag into the kill context (or store it temporarily on `fingerExperimentState.lastHitWasCrit`). In the gold drop spawner (`gold.js`, `spawnGoldDropsForEnemy`): if crit-kill flag is set, multiply drop values by `1.40`.

- [ ] **Minion Elite Conversion** (`main_minion_elite_conversion`)
  On minion kill (check `enemy.tier === 'mob'` or equivalent): 1% chance → override drop tier to `'elite'` before `spawnGoldDropsForEnemy` runs.

---

### Group H — Dynamic stat scaling (update each frame or on gold/stat change)
> Both derive a bonus from a live game value. The cleanest approach is to recompute and call `setPlayerStatSource(player, 'finger_scaling', ...)` once per frame in `updateFingerExperimentRuntime`.

- [ ] **HP to Dash Scaling** (`main_hp_to_dash_scaling`)
  Each frame: extra charges = `Math.floor(getPlayerStat(player, 'maxHp') / 100)`. Write result into `fingerExperimentState.hpDashBonusCharges`. Patch `getMaxDashCharges()` in `movement.js` to add this value.

- [ ] **Gold to Movement Speed** (`main_gold_to_move_speed`)
  Each frame: bonus = `game.gold / 100 * 0.01`. Call `setPlayerStatSource(player, 'finger_gold_speed', { moveSpeed: { mult: 1 + bonus } })`.

---

### Group I — XP system hooks

- [ ] **XP to Gold Conversion** (`main_xp_to_gold_conversion`)
  In `grantExperience()` (or the xp-orb pickup site in `experience.js`): if this mod is active, skip the XP grant entirely and instead do `game.gold += 10` per orb. Store a flag on `fingerExperimentState.xpToGoldActive` so the check is a single branch.

- [ ] **XP Risk-Reward** (`main_xp_risk_reward`)
  Two parts: (1) In `grantExperience()`: multiply amount by `1.50`. (2) In the player damage-taken block (same place as Group F): subtract `Math.floor(game.player.xp * 0.10)` from current XP (floor at 0, do not remove levels).

---

### Group J — Timed post-crit state
> Requires a new state block in `fingerExperimentState` with a HoT timer and a damage-reduction flag.

- [ ] **Crit Sustain Window** (`main_crit_sustain_window`)
  On crit: if not already active, set `critSustainTimer = 5.0`, `critSustainDrActive = true`.
  In `updateFingerExperimentRuntime`: tick timer down; while active, heal player `(0.05 * maxHp / 5) * dt` per frame. On expiry clear the DR flag.
  In incoming-damage block (Group F): if `critSustainDrActive`, multiply incoming by `0.80`.
  Cannot stack: ignore new crits while already active.

---

### Group K — Post-skill and combo attack state

- [ ] **Skill Follow-up Strike** (`main_skill_followup_strike`)
  Set `fingerExperimentState.skillFollowupReady = true` immediately after any skill is used (hook at the skill-dispatch site in `weapon-art-runtime.js` or wherever skills fire). In `damageEnemy()`: if the flag is set, apply `× 1.40` damage and add `+0.40` to crit roll for this hit only, then clear the flag.

- [ ] **Combo Scaling** (`main_combo_scaling`)
  Track `fingerExperimentState.comboCount` (0–6) and `comboResetTimer`. On each successful hit: increment count (cap 6), reset timer to ~1.5s. In `damageEnemy()`: apply `× (1 + comboCount × 0.05)` and add `comboCount × 0.05` to crit roll. In `updateFingerExperimentRuntime`: tick timer; when it expires, reset `comboCount` to 0.

---

### Group L — Free First Chest (biome-scoped state)

- [ ] **Free First Chest** (`main_free_first_chest`)
  Add `fingerExperimentState.firstChestOpenedThisBiome = false`. Reset to `false` on biome transition. In `openSearchable()`, before the `game.spendGold(goldCost)` call: if this mod is active and the flag is `false`, skip the gold spend and set the flag to `true`.
  Note: find where biome transitions fire to know where to reset the flag.

---

## Tier 4 — Complex (cross-system propagation or tricky logic)

### Group M — Debuff Amplifier

- [ ] **Debuff Amplifier** (`main_debuff_amplifier`)
  DoT ticks originate in `updateStatusState()` in `status-manager.js`. That function currently has no reference to the player or to finger mods. Two options:
  (a) Pass a `damageMultiplier` argument through the tick callback chain.
  (b) Store the multiplier on the enemy entity when the debuff is applied (write `enemy.status.dotDamageMultiplier = 1.50` at apply-time, read it at tick-time).
  Option (b) is safer. Implement by patching the `onCrit` and status-apply sites to stamp the multiplier, then read it in the tick path.

---

### Group N — Killing Spree

- [ ] **Killing Spree** (`main_killing_spree`)
  Requires a sliding kill-time window. In `fingerExperimentState`, maintain `killTimestamps: []`. On each enemy kill: push `Date.now()` (or game time), then prune entries older than 1 second. If `killTimestamps.length >= 6`: clear the array, set `killingSpreeTimer = 4.0`, `killingSpreeActive = true`.
  In `updateFingerExperimentRuntime`: tick `killingSpreeTimer` down; clear active flag on expiry.
  In `damageEnemy()`: if active, apply `× 1.30`.
  In move-speed computation: if active, apply `+ 0.30` moveSpeed multiplier via `setPlayerStatSource`.

---

## Tier 5 — Dangerous (touches core movement system)

### Group O — Slide Replacement

- [ ] **Slide Replacement** (`main_slide_replacement`)
  This mod replaces the dash with an entirely different movement mechanic. It is the highest-risk change in this list because it modifies `movement.js` deeply.
  Plan before implementing:
  - Define what "slide" means vs "dash": same input, different animation, different physics (linear momentum, no collision immunity?).
  - Add a new movement state `"slide"` alongside `"dash"` in `movement.js`.
  - Patch `consumeDashCharge()` / dash trigger site: if this mod is active, route to the slide path instead.
  - Apply `× 1.50` to slide speed and extend slide distance by `× 1.50`.
  - Determine if the slide should still consume dash charges or have its own cooldown.
  - Do not start this until all other mods are done — a mid-feature movement refactor will conflict with Group H (HP to Dash Scaling) if that isn't already stable.

---

## Notes

- **Bleed status**: Bleed Synergy (Group A) and Critical Infliction (Group E) both depend on bleed existing as a real status effect. Check `status-manager.js` before those groups. If bleed is absent, implement it first (or defer those two mods).
- **Finger mod active check**: every implementation site should gate behind `isModActive(game, 'mod_id')` or an equivalent helper that checks `game.fingerExperimentState.activeMainMod?.id === 'mod_id'`. Don't skip this — unimplemented mods with `implemented: false` will never reach these paths, but active-mod checks are still the correct defensive pattern.
- **`fingerExperimentState` extension**: Groups B, J, K, L, N all require new fields on `fingerExperimentState`. Initialise them in `applyFingerExperimentToRun()` in `finger-experiment-runtime.js` so they reset cleanly on every run start.
