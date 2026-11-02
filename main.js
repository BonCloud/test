/**
 * Turn Cinematic
 *
 * 1. The GM gives each actor a faction: prophet, angel, liquidator or survivor.
 *    Angels also get a grade: D, C, B or A.
 * 2. When combat reaches that actor's turn, every client plays a short
 *    cinematic. Each faction has its own composition and typeface.
 *    Angels are horrors: the higher the grade, the worse it gets, and the
 *    grade is stamped onto the screen.
 *
 * The Angel's wing, halo and grade stamps are plain PNG files you can swap
 * (see Configure Settings > Turn Cinematic, or just overwrite the files in
 * the module's assets folder).
 */

const MODULE_ID = "turn-cinematic";
const FLAG = "faction";
const GRADE_FLAG = "grade";

const FACTIONS = {
  prophet: { label: "Prophet", accent: "#b79cff", glow: "#4b2a9e" },
  angel: { label: "Angel", accent: "#d9d1bc", glow: "#5b3a46" },
  liquidator: { label: "Liquidator", accent: "#ff6a3d", glow: "#8a1c0c" },
  survivor: { label: "Survivor", accent: "#c4cf86", glow: "#46522a" }
};

/** Angel grades, weakest to strongest. The palette sours from bruise to blood. */
const GRADES = ["D", "C", "B", "A"];
const GRADE_LOOK = {
  D: { accent: "#d9d1bc", glow: "#5b3a46" }, // bone and bruise
  C: { accent: "#dcd48f", glow: "#58641c" }, // jaundice and rot
  B: { accent: "#e9b3a2", glow: "#8f1022" }, // raw flesh and blood
  A: { accent: "#ffe1d3", glow: "#c6001b" } // white-hot and arterial
};
/** What each grade has on screen. Every grade includes everything below it. */
const ANGEL_FX = [
  { halos: 1, wings: 0, wingScale: 0, dust: 0, flash: false }, // D
  { halos: 1, wings: 1, wingScale: 0.72, dust: 8, flash: false }, // C
  { halos: 2, wings: 1, wingScale: 0.86, dust: 14, flash: true }, // B
  { halos: 3, wings: 2, wingScale: 1, dust: 18, flash: true } // A
];

/**
 * Hands reaching in from the screen's edge, per grade (D has none).
 * x: where across the screen (0-1) · w: size, as a share of screen height
 * from: "b" rises from the bottom, "t" hangs from the top · flip: mirror it
 * at: seconds in when it starts reaching · dim: how dark (far ones are darker)
 */
const HAND_SETS = [
  [],
  [],
  [
    { x: 0.12, w: 0.7, from: "b", at: 1.0 },
    { x: 0.88, w: 0.7, from: "b", flip: true, at: 1.2 }
  ],
  [
    { x: 0.08, w: 0.74, from: "b", at: 1.0, gt: 2.7 },
    { x: 0.92, w: 0.74, from: "b", flip: true, at: 1.2, gt: 3 }
  ]
];

/** Replaceable pictures and sound, and what they default to. Empty = off. */
const FILES = {
  angelWing: { name: "Angel: wing image", hint: "A transparent PNG of the RIGHT wing, shoulder on the left edge, vertically centered. The left wing is this image flipped.", def: "angel-wing.png", kind: "image" },
  angelWingLeft: { name: "Angel: left wing image (optional)", hint: "Leave empty to use the wing image flipped. Set it if your art has separate left and right wings.", def: "", kind: "image" },
  angelHalo: { name: "Angel: halo image", hint: "A square transparent PNG, drawn centered. It rotates behind the portrait; higher grades stack more copies.", def: "angel-halo.png", kind: "image" },
  angelHands: { name: "Angel: reaching hands image", hint: "A transparent PNG of arms and hands reaching UP, cut off flat at the bottom edge. Grades B and A use it, reaching in from the bottom corners.", def: "angel-hands.png", kind: "image" },
  stampD: { name: "Grade D stamp", hint: "A transparent PNG of the stamp, drawn square.", def: "stamp-D.png", kind: "image" },
  stampC: { name: "Grade C stamp", hint: "", def: "stamp-C.png", kind: "image" },
  stampB: { name: "Grade B stamp", hint: "", def: "stamp-B.png", kind: "image" },
  stampA: { name: "Grade A stamp", hint: "", def: "stamp-A.png", kind: "image" },
  stampSound: { name: "Stamp impact sound", hint: "Plays the moment the stamp hits. .ogg or .mp3.", def: "stamp.ogg", kind: "audio" },
  defeatSound: { name: "Kill sound", hint: "Plays when the KILLED stamp lands on a fallen enemy's cinematic. .ogg or .mp3.", def: "stamp.ogg", kind: "audio" },
  killedStamp: { name: "Kill: KILLED picture", hint: "The picture that lands on a killed enemy: a GIF (animated or not) or a PNG, any width and height. It is slammed down, tilted a little, and shown as it is. Leave empty for none.", def: "killed-stamp.gif", kind: "image" },
  blood1: { name: "Kill: blood texture 1", hint: "A transparent PNG of blood splatter, thrown onto the screen when an enemy is killed, at a random turn, size and mirroring. This one is also used for the big splat under the stamp. Leave empty to skip it.", def: "blood-1.png", kind: "image" },
  blood2: { name: "Kill: blood texture 2", hint: "A second blood texture (the default is a spray of droplets). Each splat picks one of the four at random. Leave empty to skip it.", def: "blood-2.png", kind: "image" },
  blood3: { name: "Kill: blood texture 3", hint: "A third blood texture. Each splat picks one of the four at random. Leave empty to skip it.", def: "blood-3.png", kind: "image" },
  blood4: { name: "Kill: blood texture 4", hint: "A fourth blood texture (the default is a smear with a fine mist). Leave empty to skip it.", def: "blood-4.png", kind: "image" },
  prophetSeal: { name: "Prophet: seal image", hint: "A square transparent PNG of the wax seal, drawn centered. The portrait is placed in the middle of it, so leave a round space there.", def: "prophet-seal.png", kind: "image" },
  prophetParchment: { name: "Prophet: parchment image", hint: "A tall transparent PNG of the ribbon or scroll that hangs from under the seal. Its top is hidden behind the seal; the name is written on it.", def: "prophet-parchment.png", kind: "image" },
  prophetRays: { name: "Prophet: rays image", hint: "A square transparent PNG of rays of light, drawn centered on the seal and behind everything else.", def: "prophet-rays.png", kind: "image" }
};

/** When the stamp is thrown (seconds in). It lands about 0.37s later. */
const STAMP_AT = 1.3;
const STAMP_LANDS = STAMP_AT + 0.37;

const NS = "http://www.w3.org/2000/svg";

/** The cinematic on screen right now: { el, sound, timers } */
let current = null;
/** Remembers the last turn we announced so re-renders don't replay it. */
let lastKey = null;

/* -------------------------------------------------------------------------- */
/*  Settings                                                                  */
/* -------------------------------------------------------------------------- */

Hooks.once("init", () => {
  const S = game.settings;

  S.register(MODULE_ID, "enabled", {
    name: "Show turn cinematic",
    hint: "Turn this off to hide the cinematic on your screen only.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  S.register(MODULE_ID, "volume", {
    name: "Cinematic volume",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.8
  });

  S.register(MODULE_ID, "lite", {
    name: "Lite effects (slower computers)",
    hint: "If the cinematic stutters on your computer, turn this on. Effects still play, but nothing loops forever, and the heaviest extras (flung ink, flashes, falling blood, ash and lightning) are skipped.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  S.register(MODULE_ID, "speak", {
    name: "Read the name aloud",
    hint: "Uses your browser's text-to-speech voice.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  S.register(MODULE_ID, "seconds", {
    name: "Duration (seconds)",
    hint: "Higher Angel grades run longer than this: +0.75 seconds per grade above D.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 2, max: 12, step: 0.5 },
    default: 5
  });

  S.register(MODULE_ID, "portrait", {
    name: "Portrait image",
    hint: "Which picture appears in front of the background.",
    scope: "world",
    config: true,
    type: String,
    choices: { token: "Token art", actor: "Actor portrait" },
    default: "token"
  });

  S.register(MODULE_ID, "turnOrder", {
    name: "Turn order",
    hint: "Activation: each round the sides take turns, the enemy first, then a friendly, then an enemy, and so on. In the combat tracker, press the arrow on a fighter to make them go next: only someone on the side whose turn it is who hasn't gone yet can be picked (players can pick their own characters). Next Turn picks the top one for you. When one side has nobody left, the other side plays the rest of its fighters. Nobody rolls initiative; the numbers in the tracker are the activation order. Enemy means a hostile token; everyone else is friendly. Initiative: Foundry's normal order.",
    scope: "world",
    config: true,
    type: String,
    choices: { activation: "Activation (enemy, friendly, enemy...)", initiative: "Initiative (Foundry's normal order)" },
    default: "activation",
    onChange: () => {
      try { ui.combat?.render(); } catch { /* the tracker isn't open */ }
    }
  });
  S.register(MODULE_ID, "ping", {
    name: "Ping the token whose turn it is",
    hint: "When a turn starts (after its cinematic), the GM's computer pings that token on the map so everyone can see who it is. Players only see a ping where their characters can see. Hidden fighters are never pinged. \"Ping and pull\" also moves everyone's view to the token.",
    scope: "world",
    config: true,
    type: String,
    choices: { ping: "Ping the token", pull: "Ping and pull everyone's view to it", off: "Off" },
    default: "ping"
  });
  S.register(MODULE_ID, "defeat", {
    name: "Kill cinematics",
    hint: "The moment an enemy is defeated, killed, or removed from the fight (their token deleted, or taken out of the combat tracker), they get a short cinematic of their own: their faction's look, drained of color, the name struck through, blood splattered and KILLED stamped across it. Several at once play one after another, and the next turn waits for them. Enemies with no faction set are skipped. Click one to skip it.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  S.register(MODULE_ID, "defeatSeconds", {
    name: "Kill cinematic length (seconds)",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 2, max: 10, step: 0.5 },
    default: 4
  });

  for (const [key, look] of Object.entries(FACTIONS)) {
    // The Angel has no band behind it, so it has no background video.
    if (key !== "angel") {
      S.register(MODULE_ID, `${key}Video`, {
        name: `${look.label}: background video`,
        hint: key === "prophet"
          ? "A .webm file. Only the Hunted look uses it: the Biblical look has no background, so the game shows through."
          : "A .webm file. Leave empty for a plain colored background.",
        scope: "world",
        config: true,
        type: String,
        filePicker: "video",
        default: `modules/${MODULE_ID}/assets/${key}.webm`
      });
    }
    S.register(MODULE_ID, `${key}Audio`, {
      name: `${look.label}: sound`,
      hint: "An .mp3 or .ogg file. Leave empty for silence.",
      scope: "world",
      config: true,
      type: String,
      filePicker: "audio",
      default: `modules/${MODULE_ID}/assets/${key}.mp3`
    });
  }

  // The Angel's replaceable art and the stamp sound.
  for (const [key, f] of Object.entries(FILES)) {
    S.register(MODULE_ID, key, {
      name: f.name,
      hint: f.hint,
      scope: "world",
      config: true,
      type: String,
      filePicker: f.kind,
      default: f.def ? `modules/${MODULE_ID}/assets/${f.def}` : ""
    });
  }

  // Nudges, so any wing or halo art can be lined up without editing code.
  const nudge = (key, name, hint, min, max, def, step = 1) =>
    S.register(MODULE_ID, key, { name, hint, scope: "world", config: true, type: Number, range: { min, max, step }, default: def });
  nudge("wingSize", "Angel wing size (%)", "Scales both wings.", 40, 220, 100, 5);
  nudge("wingGap", "Angel wing distance from center (%)", "Moves the wings' shoulders away from (+) or into (-) the portrait.", -30, 60, 0, 1);
  nudge("wingY", "Angel wing height (%)", "Moves the wings up (-) or down (+).", -50, 50, 0, 1);
  nudge("haloSize", "Angel halo size (%)", "Scales the halo behind the portrait.", 40, 220, 100, 5);
  nudge("prophetSealSize", "Prophet seal size (%)", "Scales the seal image (the portrait stays the same size).", 40, 220, 100, 5);
  nudge("prophetParchmentSize", "Prophet parchment thickness (%)", "Makes the parchment strip thicker or thinner, with the name on it scaling along.", 40, 220, 100, 5);
  nudge("prophetRaysSize", "Prophet rays size (%)", "Scales the rays image.", 40, 300, 100, 5);
  nudge("prophetX", "Prophet position across the screen (%)", "Where the Prophet's seal sits across the screen: low numbers are the left, 50 is the middle. The parchment unrolls from the seal to the right edge. Very low numbers push the seal partly off the screen.", 5, 90, 17, 1);
  nudge("prophetNameY", "Prophet name height (%)", "Moves the name up (-) or down (+) on the parchment.", -30, 30, 0, 1);
  S.register(MODULE_ID, "prophetLook", {
    name: "Prophet: look",
    hint: "Biblical: your seal image around the portrait, your parchment with the name on it, and your rays behind. Hunted: the typed report with a reticle.",
    scope: "world",
    config: true,
    type: String,
    choices: { biblical: "Biblical (seal, parchment and rays)", hunted: "Hunted (typewriter and reticle)" },
    default: "biblical"
  });
  S.register(MODULE_ID, "prophetDim", {
    name: "Prophet: darken the screen behind",
    hint: "The biblical Prophet has no background of its own. This only lays a light, dark-purple tint over the whole screen behind it, so the seal and rays stand out. Turn it off to show the game untouched.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  S.register(MODULE_ID, "angelDim", {
    name: "Angel: darken the screen behind",
    hint: "The Angel has no band or background of its own. This only tints and darkens the whole screen behind it (deep red at the higher grades). Turn it off to show the game untouched.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  S.register(MODULE_ID, "handsMirror", {
    name: "Reaching hands: lean toward the middle",
    hint: "On: the hands are mirrored so they reach in toward the angel. Off: the picture is used the way it was drawn.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  nudge("handSize", "Reaching hands size (%)", "Scales the hands that reach in at grades B and A.", 40, 220, 100, 5);
  nudge("killedStampSize", "Kill stamp size (%)", "Scales the KILLED stamp.", 40, 220, 100, 5);
  nudge("killedStampTilt", "Kill stamp tilt (degrees)", "Turns the KILLED stamp. Negative leans it to the left (counter-clockwise).", -30, 30, -7, 1);
  nudge("bloodSize", "Kill blood size (%)", "Scales the blood splatters.", 40, 220, 100, 5);
  S.register(MODULE_ID, "bloodClean", {
    name: "Kill: clean dark edges off the blood",
    hint: "Some blood pictures carry a thin dark (black) fringe around the splat, or a nearly invisible dark box, that only shows up on screen. On: the module cleans those off when it loads your pictures (your files are not changed). Turn it off to show the pictures exactly as they are.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => dropCleanTextures()
  });
  nudge("stampSize", "Grade stamp size (%)", "Scales the grade stamp.", 40, 220, 100, 5);
});

Hooks.once("ready", () => {
  // Handy for macros: game.modules.get("turn-cinematic").api.show({...})
  game.modules.get(MODULE_ID).api = { show, setFaction, setGrade, openAssignDialog, FACTIONS, GRADES };
  wrapNextTurn();

  // Warm the bundled fonts and your pictures so the first cinematic doesn't pop in.
  for (const f of [
    '900 1em "TC Cinzel"',
    '700 1em "TC Cinzel"',
    '1em "TC Special Elite"',
    '1em "TC Uncial Antiqua"',
    '1em "TC Pirata One"',
    '1em "TC Saira Stencil"',
    '1em "TC IM Fell"',
    'italic 1em "TC IM Fell"'
  ]) document.fonts?.load(f).catch(() => {});
  for (const [key, f] of Object.entries(FILES)) {
    const src = f.kind === "image" ? game.settings.get(MODULE_ID, key) : "";
    if (src) new Image().src = src;
  }
  for (const key of BLOOD) {
    const src = game.settings.get(MODULE_ID, key);
    if (src) cleanTexture(src);
  }
});

/* -------------------------------------------------------------------------- */
/*  Trigger: a new turn starts                                                */
/* -------------------------------------------------------------------------- */

/** Set while we wait for the GM's computer to put a new round in order. */
let waiting = null;
/** True while this computer (the GM's) is writing a new round's order. */
let arranging = false;

Hooks.on("updateCombat", (combat, changed, options) => {
  if (!combat.started) return;
  if (options?.[MODULE_ID]?.reorder) return; // our own correction of the turn marker
  const ordered = changed.flags?.[MODULE_ID]?.ordered;
  const moved = "turn" in changed || "round" in changed;

  if (activationOn()) {
    // A new round: the GM's computer lines everyone up first, and its "ordered" flag tells us to play.
    if ("round" in changed) return void startRound(combat);
    // While the order is being written, any turn marker that moves is part of that, not a new turn.
    if (ordered === undefined && (!moved || arranging || waiting)) return;
  } else if (!moved) return;

  announce(combat);
});

Hooks.on("deleteCombat", (combat) => {
  dismiss();
  cancelFallen();
  clearTimeout(pingTimer);
  arrangeQueue.delete(combat);
  if (combat) fallenShown.delete(combat.id);
});

/** The cinematic for whoever's turn it is now. */
function announce(combat) {
  clearTimeout(waiting);
  waiting = null;

  // Only react to fights on the scene you're looking at.
  if (combat.scene && combat.scene.id !== canvas.scene?.id) return;

  const combatant = combat.combatant;
  if (!combatant) return;

  const key = `${combat.id}:${combat.round}:${combatant.id}`;
  if (key === lastKey) return;
  lastKey = key;

  // Anyone who just fell gets their moment first, then this turn's cinematic.
  afterFallen(() => {
    // Don't reveal combatants the GM has hidden.
    const data = combatant.hidden && !game.user.isGM ? null : describe(combatant);
    if (data) show(data);
    // The map ping waits until the cinematic is over, so everyone can see it.
    pingTurn(combat, combatant, data ? cinematicSeconds(data) : 0);
  });
}

/* ---- the map ping: which token's turn it is ---- */

let pingTimer = null;

/** How long a turn's cinematic plays (the same sum show() uses). */
function cinematicSeconds({ faction, grade }) {
  if (!FACTIONS[faction] || !game.settings.get(MODULE_ID, "enabled")) return 0;
  const gradeIndex = faction === "angel" && GRADES.includes(grade) ? GRADES.indexOf(grade) : 0;
  return Number(game.settings.get(MODULE_ID, "seconds")) + gradeIndex * 0.75;
}

/**
 * Ping the token whose turn it is. Only the GM's computer does it (it tells everyone else's), so it
 * isn't repeated once per player, and never for a hidden fighter or a hidden token.
 */
function pingTurn(combat, combatant, delaySeconds = 0) {
  clearTimeout(pingTimer);
  pingTimer = null;
  try {
    if (game.settings.get(MODULE_ID, "ping") === "off") return;
    if (!game.users.activeGM?.isSelf) return;
    if (combatant.hidden || combatant.token?.hidden) return;
    pingTimer = setTimeout(() => {
      pingTimer = null;
      try {
        // the turn may have moved on while the cinematic played
        if (!combat.started || combat.combatant?.id !== combatant.id) return;
        if (combat.scene && combat.scene.id !== canvas.scene?.id) return;
        const token = combatant.token?.object;
        if (!token || !canvas.ready || typeof canvas.ping !== "function") return;
        const pull = game.settings.get(MODULE_ID, "ping") === "pull";
        const types = CONFIG.Canvas?.pings?.types ?? {};
        canvas.ping(token.center, { style: pull ? types.PULL ?? "chevron" : types.PULSE ?? "pulse", pull });
      } catch (err) {
        console.warn(`${MODULE_ID} | could not ping the token`, err);
      }
    }, Math.max(0, delaySeconds) * 1000 + 250);
  } catch (err) {
    console.warn(`${MODULE_ID} | could not ping the token`, err);
  }
}

/* ---- enemies who fall: a cinematic the moment they go down ---- */

/** Combatants (by id, per fight) whose fall has been shown, so two signals for one death play once. */
const fallenShown = new Map();
/** Cinematics waiting their turn, when several fall at once. */
const fallenLine = [];
/** What to do once the line is empty (the next turn's cinematic). */
let afterFallenFn = null;
let fallenGuard = null;

/**
 * An enemy went down or was removed. Plays their defeat cinematic at once (or queues it behind another
 * that's still showing). Friends, hidden enemies (for players) and enemies with no faction get nothing.
 */
function enemyFell(combatant) {
  try {
    if (!game.settings.get(MODULE_ID, "defeat")) return;
    const combat = combatant?.combat ?? combatant?.parent;
    if (!combat?.started) return;
    if (combat.scene && combat.scene.id !== canvas.scene?.id) return;
    if (!fallenShown.has(combat.id)) fallenShown.set(combat.id, new Set());
    const seen = fallenShown.get(combat.id);
    if (seen.has(combatant.id)) return;
    seen.add(combatant.id);
    if (sideOf(combatant) !== "enemy") return;
    if (combatant.hidden && !game.user.isGM) return;
    const data = describe(combatant);
    if (!data) return;
    fallenLine.push(data);
    settleFallen();
  } catch (err) {
    console.warn(`${MODULE_ID} | could not show a defeat`, err);
  }
}

/** They are back on their feet: if they fall again, that counts. */
function enemyRose(combatant) {
  const combat = combatant?.combat ?? combatant?.parent;
  if (combat) fallenShown.get(combat.id)?.delete(combatant.id);
}

/** Show the next waiting defeat, or when there are none left, carry on with whatever was held back. */
function settleFallen() {
  clearTimeout(fallenGuard);
  if (current?.defeated) return; // one is still showing; its onDone brings us back here
  const data = fallenLine.shift();
  if (data) {
    show({ ...data, defeated: true, onDone: settleFallen });
    // If something else replaces it, nothing would call us back, so check again shortly after it should have ended.
    const seconds = Math.min(10, Math.max(2, Number(game.settings.get(MODULE_ID, "defeatSeconds")) || 4));
    fallenGuard = setTimeout(settleFallen, (seconds + 2) * 1000);
    return;
  }
  const next = afterFallenFn;
  afterFallenFn = null;
  next?.();
}

/** Run `fn` now, or once the defeat cinematics that are showing or waiting have finished. */
function afterFallen(fn) {
  if (!fallenLine.length && !current?.defeated) return fn();
  afterFallenFn = fn; // the newest turn wins
}

function cancelFallen() {
  clearTimeout(fallenGuard);
  fallenLine.length = 0;
  afterFallenFn = null;
}

// The signals: marked defeated, a "dead" status, a combatant removed from the fight, or its token deleted.
Hooks.on("updateCombatant", (combatant, changed) => {
  if (changed?.defeated === true) enemyFell(combatant);
  else if (changed?.defeated === false) enemyRose(combatant);
});
Hooks.on("deleteCombatant", (combatant) => enemyFell(combatant));
Hooks.on("deleteToken", (token) => {
  for (const combat of game.combats?.values?.() ?? []) {
    const c = combat.combatants.find((x) => x.tokenId === token.id);
    if (c) enemyFell(c);
  }
});
for (const gained of [true, false]) {
  Hooks.on(gained ? "createActiveEffect" : "deleteActiveEffect", (effect) => {
    if (!effect.statuses?.has?.(CONFIG.specialStatusEffects?.DEFEATED ?? "dead")) return;
    const actor = effect.parent;
    for (const combat of game.combats?.values?.() ?? []) {
      const c = combat.combatants.find((x) => x.actor === actor || (actor && x.actor?.uuid === actor.uuid));
      if (!c) continue;
      if (gained && c.isDefeated) enemyFell(c);
      else if (!gained && !c.isDefeated) enemyRose(c);
    }
  });
}
/** Turn a combatant into the plain data show() needs, or null if no faction. */
function describe(combatant) {
  const actor = combatant.actor ?? game.actors.get(combatant.actorId);
  const faction = actor?.getFlag(MODULE_ID, FLAG);
  if (!FACTIONS[faction]) return null;

  const preferActor = game.settings.get(MODULE_ID, "portrait") === "actor";
  const tokenImg = combatant.token?.texture?.src ?? combatant.img;
  const img = (preferActor ? actor.img ?? tokenImg : tokenImg ?? actor.img) || "icons/svg/mystery-man.svg";

  const grade = faction === "angel" ? actor.getFlag(MODULE_ID, GRADE_FLAG) ?? "D" : null;
  return { faction, grade, name: combatant.name || actor.name, img };
}

/* -------------------------------------------------------------------------- */
/*  Activation: the sides take turns, the enemy first                         */
/* -------------------------------------------------------------------------- */

const activationOn = () => game.settings.get(MODULE_ID, "turnOrder") === "activation";
const opposite = (side) => (side === "enemy" ? "friend" : "enemy");

/** "enemy" for a hostile token, "friend" for everyone else (and always for a player's character). */
function sideOf(combatant) {
  if (combatant.actor?.hasPlayerOwner) return "friend";
  const disposition = combatant.token?.disposition;
  if (Number.isFinite(disposition)) return disposition < 0 ? "enemy" : "friend";
  return "enemy";
}

/**
 * The order the turns should take: enemy, friendly, enemy... Whoever has
 * already gone this round (everyone up to `keepThrough`) stays where they are.
 * `first` is the one who goes next. Within a side the tracker's own order is
 * kept, so dragging someone in the tracker still works. When one side runs
 * out, the other carries on. The defeated go last.
 */
function planOrder(combat, { keepThrough = -1, first = null } = {}) {
  const turns = [...combat.turns];
  const kept = turns.slice(0, keepThrough + 1);
  const rest = turns.slice(keepThrough + 1);
  const pools = { enemy: [], friend: [] };
  const dead = [];
  for (const c of rest) (c.isDefeated ? dead : pools[sideOf(c)]).push(c);

  const sequence = [];
  let side = kept.length ? opposite(sideOf(kept.at(-1))) : "enemy";
  if (first) {
    const pool = pools[sideOf(first)];
    pool.splice(pool.indexOf(first), 1);
    sequence.push(first);
    side = opposite(sideOf(first));
  }
  while (pools.enemy.length || pools.friend.length) {
    const taken = (pools[side].length ? pools[side] : pools[opposite(side)]).shift();
    sequence.push(taken);
    side = opposite(sideOf(taken));
  }
  return [...kept, ...sequence, ...dead];
}

/** Write the order into the tracker (as initiative numbers) and keep the turn marker on the right fighter. */
async function applyOrder(combat, list, wantIndex) {
  const updates = [];
  list.forEach((c, i) => {
    const value = list.length - i;
    if (c.initiative !== value) updates.push({ _id: c.id, initiative: value });
  });
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
  if (wantIndex != null && combat.turn !== wantIndex) {
    await combat.update({ turn: wantIndex }, { [MODULE_ID]: { reorder: true } });
  }
}

/** A new round: the GM's computer lines everyone up, then tells every computer to play. */
function startRound(combat) {
  clearTimeout(waiting);
  waiting = null;
  const gm = game.users.activeGM;
  if (!gm) return announce(combat); // nobody who could write the order
  if (gm.isSelf) {
    arrangeRound(combat).catch((err) => {
      console.warn(`${MODULE_ID} | could not arrange the round`, err);
      announce(combat);
    });
  } else {
    // The GM's computer is doing it; if we never hear back, play anyway.
    waiting = setTimeout(() => announce(combat), 2500);
  }
}

async function arrangeRound(combat) {
  arranging = true;
  try {
    await applyOrder(combat, planOrder(combat), 0);
  } finally {
    arranging = false;
  }
  await combat.setFlag(MODULE_ID, "ordered", `${combat.round}:${Date.now()}`);
}

/**
 * Line the fight up right away, not only when a round starts: when a fight is set up, when someone
 * joins or leaves it, or when a token changes sides. Only the GM's computer writes the order.
 */
let arrangeTimer = null;
const arrangeQueue = new Set();

function scheduleArrange(combat) {
  if (!combat || !activationOn() || !game.users.activeGM?.isSelf) return;
  arrangeQueue.add(combat);
  clearTimeout(arrangeTimer);
  arrangeTimer = setTimeout(async () => {
    arrangeTimer = null;
    const list = [...arrangeQueue];
    arrangeQueue.clear();
    for (const c of list) {
      try {
        await arrangeNow(c);
      } catch (err) {
        console.warn(`${MODULE_ID} | could not line the fight up`, err);
      }
    }
  }, 300);
}

async function arrangeNow(combat) {
  if (arranging || !combat?.turns?.length) return;
  // Once the fight has started, whoever has already gone (and whoever is up now) stays put.
  const index = combat.started ? Math.max(combat.turn ?? 0, 0) : -1;
  arranging = true;
  try {
    await applyOrder(combat, planOrder(combat, { keepThrough: index }), combat.started ? index : null);
  } finally {
    arranging = false;
  }
}

Hooks.on("createCombatant", (combatant) => scheduleArrange(combatant.combat ?? combatant.parent));
Hooks.on("deleteCombatant", (combatant) => scheduleArrange(combatant.combat ?? combatant.parent));
Hooks.on("updateToken", (token, changed) => {
  if (!changed || !("disposition" in changed)) return;
  for (const combat of game.combats?.values?.() ?? []) {
    if (combat.combatants.some((c) => c.tokenId === token.id)) scheduleArrange(combat);
  }
});
Hooks.once("ready", () => {
  for (const combat of game.combats?.values?.() ?? []) scheduleArrange(combat);
});

/* ---- the combat tracker shows the activation order, not initiative ---- */

Hooks.on("renderCombatTracker", (app, html) => {
  try {
    decorateTracker(app, html);
  } catch (err) {
    console.warn(`${MODULE_ID} | could not mark up the combat tracker`, err);
  }
});

function decorateTracker(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const on = activationOn();
  root.classList.toggle("tc-activation", on);
  if (!on) return;
  const combat = app?.viewed ?? game.combats?.viewed;
  if (!combat) return;

  // who may be picked to go next, and whether this person may pick them
  const { pool } = combat.started ? nextPool(combat) : { pool: [] };
  const pickable = new Set(pool.filter((c) => mayPick(game.user, c)).map((c) => c.id));

  let place = 0;
  combat.turns.forEach((c, i) => {
    if (c.hidden && !game.user.isGM) return; // players don't see these rows, so don't count them
    const down = c.isDefeated;
    if (!down) place++; // the fallen aren't numbered
    const row = root.querySelector(`.combatant[data-combatant-id="${c.id}"]`);
    if (!row) return;
    const side = down ? "down" : sideOf(c);
    row.dataset.tcSide = side;
    row.classList.toggle("tc-done", !!combat.started && !down && i < combat.turn);
    row.classList.toggle("tc-pickable", pickable.has(c.id));
    const slot = row.querySelector(".token-initiative");
    if (slot) {
      const badge = document.createElement("span");
      badge.className = "tc-order";
      badge.textContent = down ? "\u2715" : String(place);
      badge.title = down ? "Down" : `${side === "enemy" ? "Enemy" : "Friendly"}: activation ${place}`;
      slot.replaceChildren(badge);
      if (pickable.has(c.id)) {
        const go = document.createElement("button");
        go.type = "button";
        go.className = "tc-go";
        go.textContent = "\u25b6";
        go.title = `${c.name} goes next`;
        go.setAttribute("aria-label", go.title);
        go.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation(); // don't also select the row
          requestActivation(combat, c.id);
        });
        slot.prepend(go);
      }
    }
  });

  root.querySelectorAll(".tc-activation-note").forEach((n) => n.remove());
  const list = root.querySelector("ol.combat-tracker, .combat-tracker, ol");
  if (list) {
    const note = document.createElement("div");
    note.className = "tc-activation-note";
    const sideName = (c) => (sideOf(c) === "enemy" ? "an enemy" : "a friendly");
    if (!combat.started) note.textContent = "Activation \u00b7 the enemy goes first, then a friendly";
    else if (!pool.length) note.textContent = "Activation \u00b7 everyone has gone: Next Turn starts the next round";
    else note.textContent = `Activation \u00b7 ${sideName(pool[0])} goes next${pickable.size ? " (press \u25b6 to choose)" : ""}`;
    list.before(note);
  }
}

/* ---- picking who goes next ---- */

/** The channel a player's pick travels on, to reach the GM's computer. */
const SOCKET = `module.${MODULE_ID}`;

/**
 * Who may go next. The other side takes the next turn, and only someone on that side who hasn't gone
 * yet can be picked. If that side has nobody left, the side that is still standing carries on with
 * the rest of its fighters, so the bigger side plays out its remainder once the smaller one is done.
 */
function nextPool(combat) {
  const index = combat.turn ?? -1;
  const current = combat.turns[index];
  if (!current) return { current: null, index, pool: [] };
  const pending = combat.turns.slice(index + 1).filter((c) => !c.isDefeated);
  const wanted = pending.filter((c) => sideOf(c) === opposite(sideOf(current)));
  return { current, index, pool: wanted.length ? wanted : pending };
}

/** The GM may pick anyone who is up for it; a player may pick only a friendly character they own. */
function mayPick(user, combatant) {
  if (user?.isGM) return true;
  return sideOf(combatant) === "friend" && !!combatant.actor?.testUserPermission?.(user, "OWNER");
}

let activating = false;

/** A button was pressed. The GM's computer does it; a player's request is sent there. */
function requestActivation(combat, combatantId) {
  if (game.user.isGM) {
    if (activating) return;
    activating = true;
    activateCombatant(combat, combatantId)
      .catch((err) => {
        console.warn(`${MODULE_ID} | could not make that fighter go next`, err);
        ui.notifications?.warn("Turn Cinematic: that fighter could not go next.");
      })
      .finally(() => {
        activating = false;
      });
  } else {
    game.socket?.emit(SOCKET, { type: "activate", combatId: combat.id, combatantId, userId: game.user.id });
  }
}

/**
 * Make `combatantId` take the next turn: ends the current turn and starts theirs. Refused unless they
 * are really allowed to go next (right side, not gone yet, not down) and `user` may pick them.
 */
async function activateCombatant(combat, combatantId, user = game.user) {
  if (!game.user.isGM || !activationOn() || !combat?.started) return false;
  const chosen = nextPool(combat).pool.find((c) => c.id === combatantId);
  if (!chosen || !mayPick(user, chosen)) return false;
  await pickNext(combat, chosen);
  await combat.nextTurn();
  return true;
}

/** A player's pick reaches us: only the active GM's computer acts on it. */
Hooks.once("ready", () => {
  try {
    game.socket?.on?.(SOCKET, async (message) => {
      try {
        if (message?.type !== "activate" || !game.users.activeGM?.isSelf) return;
        const combat = game.combats?.get?.(message.combatId);
        const user = game.users?.get?.(message.userId);
        if (!combat || !user) return;
        await activateCombatant(combat, message.combatantId, user);
      } catch (err) {
        console.warn(`${MODULE_ID} | could not act on a player's pick`, err);
      }
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | could not listen for players' picks`, err);
  }
});

/** Before Next Turn moves on: make sure the other side goes next (the one picked, or else the first in the tracker). */
async function pickNext(combat, forced = null) {
  if (!activationOn() || !game.user.isGM || !combat.started) return;
  const { current, index, pool } = nextPool(combat);
  if (!current || !pool.length) return;
  const chosen = pool.find((c) => c.id === forced?.id) ?? pool[0];
  await applyOrder(combat, planOrder(combat, { keepThrough: index, first: chosen }), index);
}

/** Wrap Next Turn once, so the GM's click can reorder the sides first. Anything that goes wrong falls back to the normal behavior. */
function wrapNextTurn() {
  let proto;
  try {
    proto = CONFIG.Combat?.documentClass?.prototype;
  } catch {
    return;
  }
  if (!proto?.nextTurn || proto.nextTurn.__turnCinematic) return;
  const original = proto.nextTurn;
  const wrapped = async function (...args) {
    try {
      await pickNext(this);
    } catch (err) {
      console.warn(`${MODULE_ID} | could not arrange the next activation`, err);
    }
    return original.apply(this, args);
  };
  wrapped.__turnCinematic = true;
  proto.nextTurn = wrapped;
}

/* -------------------------------------------------------------------------- */
/*  The cinematic                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Play a cinematic. `defeated` gives it the fallen-enemy treatment (shorter, drained of color,
 * KILLED stamped on with blood, click to skip). `onDone` runs when it ends or is skipped, or at once if
 * there is nothing to show; it does not run if something else replaces the cinematic.
 */
async function show({ faction, name, img, grade, defeated = false, onDone = null }) {
  if (!FACTIONS[faction] || !game.settings.get(MODULE_ID, "enabled")) {
    onDone?.();
    return;
  }

  dismiss(); // replace a cinematic that's still on screen

  const gradeKey = faction === "angel" ? (GRADES.includes(grade) ? grade : "D") : null;
  const gradeIndex = gradeKey ? GRADES.indexOf(gradeKey) : 0;
  const seconds = defeated
    ? Math.min(10, Math.max(2, Number(game.settings.get(MODULE_ID, "defeatSeconds")) || 4))
    : game.settings.get(MODULE_ID, "seconds") + gradeIndex * 0.75;

  const el = buildOverlay({
    faction,
    grade: gradeKey,
    gradeIndex,
    name: name || "Unknown",
    img: img || "icons/svg/mystery-man.svg",
    video: faction === "angel" ? "" : game.settings.get(MODULE_ID, `${faction}Video`),
    defeated
  });
  document.body.append(el);

  const state = { el, sound: null, timers: [], defeated };
  current = state;
  const end = () => {
    dismiss(state);
    onDone?.();
  };
  state.timers.push(
    setTimeout(() => {
      el.classList.add("tc--out");
      stopSound(state.sound);
    }, Math.max(0, seconds * 1000 - 500)),
    setTimeout(end, seconds * 1000)
  );

  if (defeated) {
    // Color drains away, blood splatters, KILLED lands with a thud, a click skips it.
    el.style.pointerEvents = "auto";
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      if (current === state) end();
    });
    state.timers.push(setTimeout(() => el.classList.add("tc-fell"), 300));
    state.timers.push(
      setTimeout(() => {
        if (current !== state) return;
        const src = game.settings.get(MODULE_ID, "defeatSound");
        if (src) playSound(src);
      }, 1100)
    );
    return;
  }

  // The stamp hits with a thud.
  if (faction === "angel") {
    state.timers.push(
      setTimeout(() => {
        if (current !== state) return;
        const src = game.settings.get(MODULE_ID, "stampSound");
        if (src) playSound(src);
      }, (STAMP_LANDS - 0.04) * 1000)
    );
  }

  speak(name);

  const sound = await playSound(game.settings.get(MODULE_ID, `${faction}Audio`));
  if (current === state) state.sound = sound;
  else stopSound(sound, 0); // it was replaced while the file was loading
}

function dismiss(state = current) {
  if (!state) return;
  state.timers.forEach(clearTimeout);
  state.el.remove();
  stopSound(state.sound, 300);
  if (current === state) current = null;
}

/* ---- building blocks ---------------------------------------------------- */

function h(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pct = (key) => (Number(game.settings.get(MODULE_ID, key)) || 0) / 100;

function buildOverlay({ faction, grade, gradeIndex, name, img, video, defeated = false }) {
  const look = grade ? GRADE_LOOK[grade] : FACTIONS[faction];

  const root = h("div");
  root.id = "turn-cinematic";
  root.dataset.faction = faction;
  if (defeated) root.dataset.fate = "defeated";
  if (grade) root.dataset.grade = grade;
  if (faction === "prophet") root.dataset.look = game.settings.get(MODULE_ID, "prophetLook");
  if (game.settings.get(MODULE_ID, "lite")) root.classList.add("tc-lite");
  root.style.setProperty("--tc-accent", look.accent);
  root.style.setProperty("--tc-glow", look.glow);
  // Long names shrink so they still fit.
  root.style.setProperty("--tc-fit", Math.min(1, 12 / Math.max(name.length, 1)).toFixed(3));
  root.style.setProperty("--tc-len", Math.max(name.length, 1));

  const stage = h("div", "tc-stage");
  // The Angel and the biblical Prophet float straight over the game: no band, no video, no borders.
  const floating = faction === "prophet" && root.dataset.look === "biblical";
  const bare = faction === "angel" || floating;
  const band = h("div", "tc-band");

  if (video && !bare) {
    const bg = loopingVideo(video);
    bg.classList.add("tc-video");
    // If the file is missing, drop the <video> and show the colored band.
    bg.addEventListener("error", () => bg.remove(), { once: true });
    band.append(bg);
  }
  if (faction === "survivor") band.style.setProperty("--tc-torn", tornPolygon());
  band.append(h("div", "tc-shade"));

  const edges = bare ? [] : [h("div", "tc-edge tc-edge--top"), h("div", "tc-edge tc-edge--bottom")];

  const portrait = h("div", "tc-portrait");
  portrait.append(portraitMedia(img));
  if (faction === "prophet" && root.dataset.look === "hunted") portrait.append(h("div", "tc-reticle"));

  const label = faction === "angel" ? `Grade ${grade} Angel` : look.label;
  const text = buildText(faction, name, label, root.dataset.look);

  const fx = (DECOR[faction] ?? (() => ({})))({ root, grade, gradeIndex, name });

  stage.append(
    ...(fx.first ?? []),
    ...(bare ? [] : [band]),
    ...(fx.back ?? []),
    ...(fx.under ?? []),
    ...edges,
    ...(fx.mid ?? []),
    portrait,
    text,
    ...(fx.front ?? [])
  );
  // The dim wash behind: the Angel's and the biblical Prophet's can each be turned off.
  const dimmed = faction === "angel" ? game.settings.get(MODULE_ID, "angelDim") : floating ? game.settings.get(MODULE_ID, "prophetDim") : true;
  const dim = dimmed ? [h("div", "tc-dim")] : [];
  root.append(...dim, stage, ...(fx.root ?? []));
  if (defeated) {
    root.style.setProperty("--tc-fate-k", pct("killedStampSize") || 1);
    root.style.setProperty("--tc-fate-rot", `${Number(game.settings.get(MODULE_ID, "killedStampTilt")) || 0}deg`);
    root.append(h("div", "tc-fate-wash"), bloodLayer(faction, root.dataset.look), killedStamp());
  }
  return root;
}

/** The KILLED picture, exactly as you supplied it (a GIF plays). Nothing is shown if there is none or it won't load. */
function killedStamp() {
  const src = game.settings.get(MODULE_ID, "killedStamp");
  if (!src) return h("span");
  const img = h("img", "tc-fate");
  img.alt = "Killed";
  img.decoding = "async";
  img.src = src;
  img.addEventListener("error", () => img.remove(), { once: true });
  return img;
}

/* ---- blood: your four textures, thrown across the screen when an enemy is killed ---- */

/** The four textures. Each is turned any way when it is thrown. */
const BLOOD = ["blood1", "blood2", "blood3", "blood4"];

/**
 * Splatters over the whole screen (not grayed out like the picture under them): a big one where
 * the stamp lands, the rest thrown around it. Each takes one of your textures at random, turned and
 * mirrored differently. A texture that is empty or won't load is simply left out.
 */
function bloodLayer(faction, look) {
  const layer = h("div", "tc-blood");
  const textures = BLOOD.map((key) => game.settings.get(MODULE_ID, key)).filter(Boolean);
  if (!textures.length) return layer;

  // where the stamp lands, matching the stamp's own position
  const at = faction === "angel" ? [50, 36] : faction === "prophet" && look === "biblical" ? [64, 50] : [50, 52];
  const aspect = Math.max(window.innerWidth, 320) / Math.max(window.innerHeight, 240);
  const scale = pct("bloodSize") || 1;
  const lite = game.settings.get(MODULE_ID, "lite");
  const clamp = (v) => Math.min(97, Math.max(3, v));
  const pick = () => textures[Math.floor(Math.random() * textures.length)];

  const spots = [{ x: at[0], y: at[1], size: 62, texture: textures[0] }];
  const extra = lite ? 4 : 8;
  for (let i = 0; i < extra; i++) {
    const near = i < 3; // a few close, the rest across the screen
    spots.push({
      x: clamp(at[0] + (rand(-1, 1) * (near ? 22 : 46)) / Math.max(aspect / 1.78, 0.6)),
      y: clamp(at[1] + rand(-1, 1) * (near ? 20 : 45)),
      size: near ? rand(30, 52) : rand(22, 44),
      texture: pick()
    });
  }

  spots.forEach((spot, i) => {
    const wrap = h("div", "tc-bl");
    wrap.style.setProperty("--x", `${spot.x.toFixed(1)}%`);
    wrap.style.setProperty("--y", `${spot.y.toFixed(1)}%`);
    wrap.style.setProperty("--w", `${(spot.size * scale).toFixed(1)}vh`);
    wrap.style.setProperty("--r", `${rand(-180, 180).toFixed(0)}deg`);
    wrap.style.setProperty("--d", `${(0.72 + i * 0.05).toFixed(2)}s`);
    const img = h("img");
    img.alt = "";
    img.decoding = "async";
    if (Math.random() < 0.5) img.style.setProperty("--fx", "-1");
    img.addEventListener("error", () => wrap.remove(), { once: true });
    wrap.append(img);
    layer.append(wrap);
    // the cleaned copy (or the file itself if it can't be cleaned); it only starts showing once it's in
    cleanTexture(spot.texture).then((url) => { img.src = url; });
  });
  return layer;
}

/**
 * Blood pictures often carry a dark fringe: the pixels that are only partly see-through hold black or
 * a dark red instead of the blood's own color (a leftover from how many programs save a feathered
 * edge, or from "color to alpha"), and a nearly invisible dark box around the whole picture. Neither
 * shows in most image viewers, but over the game it reads as a black border. So when a picture is
 * loaded, its barely-visible pixels are removed and the partly see-through ones take the color of the
 * solid blood beside them. A copy is made in memory; the file is never touched. If the picture can't
 * be read (another website without permission), it is used as it is.
 */
const CLEANED = new Map();

function dropCleanTextures() {
  for (const p of CLEANED.values()) p.then((url) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); }).catch(() => {});
  CLEANED.clear();
}

function cleanTexture(src) {
  if (!game.settings.get(MODULE_ID, "bloodClean")) return Promise.resolve(src);
  if (!CLEANED.has(src)) CLEANED.set(src, makeClean(src).catch(() => src));
  return CLEANED.get(src);
}

async function makeClean(src) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const ratio = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const W = Math.max(1, Math.round(img.naturalWidth * ratio));
  const H = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H); // throws if the picture can't be read: caught by the caller
  const px = data.data;

  // 0. a picture with no see-through part at all, on a black background: black becomes see-through
  let lowest = 255;
  for (let i = 3; i < px.length; i += 4) if (px[i] < lowest) lowest = px[i];
  const dark = (x, y) => { const i = (y * W + x) * 4; return Math.max(px[i], px[i + 1], px[i + 2]) < 50; };
  if (lowest >= 250 && dark(0, 0) && dark(W - 1, 0) && dark(0, H - 1) && dark(W - 1, H - 1)) {
    let brightest = 1;
    for (let i = 0; i < px.length; i += 4) brightest = Math.max(brightest, px[i], px[i + 1], px[i + 2]);
    const knee = brightest * 0.5;
    for (let i = 0; i < px.length; i += 4) {
      const m = Math.max(px[i], px[i + 1], px[i + 2]);
      const keep = Math.min(1, Math.max(0, (m - 6) / knee));
      if (keep > 0 && keep < 1) {
        px[i] = Math.min(255, px[i] / keep);
        px[i + 1] = Math.min(255, px[i + 1] / keep);
        px[i + 2] = Math.min(255, px[i + 2] / keep);
      }
      px[i + 3] = Math.round(keep * 255);
    }
  }

  // 1. only the solid blood (as solid as this picture gets), everything else see-through
  let top = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > top) top = px[i];
  const solid = Math.max(200, top - 3);
  const core = ctx.createImageData(W, H);
  const c = core.data;
  const mean = [0, 0, 0];
  let solidCount = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] >= solid) {
      c[i] = px[i]; c[i + 1] = px[i + 1]; c[i + 2] = px[i + 2]; c[i + 3] = 255;
      mean[0] += px[i]; mean[1] += px[i + 1]; mean[2] += px[i + 2];
      solidCount++;
    }
  }
  if (solidCount) for (let k = 0; k < 3; k++) mean[k] /= solidCount;
  const coreCanvas = document.createElement("canvas");
  coreCanvas.width = W;
  coreCanvas.height = H;
  coreCanvas.getContext("2d").putImageData(core, 0, 0);

  // 2. spread the solid blood's color outward: shrink it in halves, then lay the small versions down
  //    from the smallest to the full size, so every pixel ends up with the color of the nearest blood
  const levels = [coreCanvas];
  while (Math.max(levels.at(-1).width, levels.at(-1).height) > 8) {
    const prev = levels.at(-1);
    const next = document.createElement("canvas");
    next.width = Math.max(1, Math.round(prev.width / 2));
    next.height = Math.max(1, Math.round(prev.height / 2));
    const nctx = next.getContext("2d");
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(prev, 0, 0, next.width, next.height);
    levels.push(next);
  }
  const grown = document.createElement("canvas");
  grown.width = W;
  grown.height = H;
  const gctx = grown.getContext("2d", { willReadFrequently: true });
  gctx.imageSmoothingQuality = "high";
  for (let i = levels.length - 1; i >= 0; i--) gctx.drawImage(levels[i], 0, 0, W, H);
  const near = gctx.getImageData(0, 0, W, H).data;

  // 3. the partly see-through pixels borrow that color when theirs is darker; the barely visible go
  //    (far from any solid blood the picture's average blood color is used)
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 14) { px[i + 3] = 0; continue; }
    if (a >= solid || !solidCount) continue;
    const t = Math.min(1, near[i + 3] / 32);
    const r = near[i] * t + mean[0] * (1 - t);
    const g = near[i + 1] * t + mean[1] * (1 - t);
    const b = near[i + 2] * t + mean[2] * (1 - t);
    const mine = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    const theirs = r * 0.3 + g * 0.59 + b * 0.11;
    if (mine < theirs * 0.9) { px[i] = r; px[i + 1] = g; px[i + 2] = b; }
  }
  ctx.putImageData(data, 0, 0);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("no blob");
  return URL.createObjectURL(blob);
}

function buildText(faction, name, label, look) {
  const text = h("div", "tc-text");
  const tag = h("div", "tc-faction");
  tag.textContent = label;

  // The name is split into letters so each faction can reveal it its own way.
  const title = h("h1", "tc-name");
  title.setAttribute("aria-label", name);
  const words = name.split(/\s+/).filter(Boolean);
  let i = 0;
  words.forEach((word, w) => {
    const wrap = h("span", "tc-word");
    for (const ch of word) {
      const letter = h("span");
      letter.textContent = ch;
      letter.setAttribute("aria-hidden", "true");
      letter.style.setProperty("--i", Math.min(i++, 24));
      if (faction === "angel") {
        // Every letter sits a little wrong, and a few twitch.
        letter.style.setProperty("--jr", `${rand(-3.2, 3.2).toFixed(1)}deg`);
        letter.style.setProperty("--jy", `${rand(-0.045, 0.045).toFixed(3)}em`);
        letter.style.setProperty("--tw", `${rand(0, 5).toFixed(2)}s`);
        if (Math.random() < 0.14) letter.classList.add("tc-wrong");
      }
      wrap.append(letter);
    }
    title.append(wrap);
    if (w < words.length - 1) title.append(" ");
  });
  text.append(tag, title);

  if (faction === "prophet" && look === "biblical") {
    // your parchment goes behind the name; with no parchment the name turns light so it can still be read
    const src = game.settings.get(MODULE_ID, "prophetParchment");
    if (src) {
      const paper = artImg(src, "tc-parchment");
      paper.addEventListener("error", () => text.classList.add("tc-no-paper"), { once: true });
      text.prepend(paper);
    } else text.classList.add("tc-no-paper");
  }

  if (faction === "survivor") {
    // A hand-drawn line that scratches itself in under the name.
    const line = svgEl("svg", { class: "tc-scribble", viewBox: "0 0 300 20", preserveAspectRatio: "none", "aria-hidden": "true" });
    const path = svgEl("path", { d: "M3 13 C 50 3, 95 18, 150 9 S 240 15, 297 5", pathLength: "1" });
    path.style.setProperty("--n", Math.min(i, 24));
    line.append(path);
    title.append(line); // inside the name, so it is exactly as wide as the name
  }
  return text;
}

/* ---- per-faction decoration -------------------------------------------- */

const DECOR = {
  angel: angelDecor,
  prophet: prophetDecor,
  liquidator: () => ({ root: [h("div", "tc-slash")] })
  // survivor is done in CSS alone
};

/* ---- the biblical Prophet: your seal, your parchment and your rays ---- */

function prophetDecor({ root }) {
  if (root.dataset.look !== "biblical") return {};
  const x = Number(game.settings.get(MODULE_ID, "prophetX"));
  root.style.setProperty("--tc-x", `${Number.isFinite(x) ? x : 17}%`);
  root.style.setProperty("--tc-seal-k", pct("prophetSealSize") || 1);
  root.style.setProperty("--tc-rib-k", pct("prophetParchmentSize") || 1);
  root.style.setProperty("--tc-rays-k", pct("prophetRaysSize") || 1);
  root.style.setProperty("--tc-name-y", pct("prophetNameY"));
  const rays = game.settings.get(MODULE_ID, "prophetRays");
  const seal = game.settings.get(MODULE_ID, "prophetSeal");
  return {
    back: rays ? [artImg(rays, "tc-rays")] : [],
    mid: seal ? [artImg(seal, "tc-seal")] : []
  };
}

function angelDecor({ root, grade, gradeIndex }) {
  const fx = ANGEL_FX[gradeIndex];
  const out = { back: [], under: [], mid: [], front: [], root: [] };

  // Wing, halo and stamp sizes the GM nudged in settings.
  root.style.setProperty("--tc-wing-size", pct("wingSize") || 1);
  root.style.setProperty("--tc-wing-gap", pct("wingGap"));
  root.style.setProperty("--tc-wing-y", pct("wingY"));
  root.style.setProperty("--tc-halo-size", pct("haloSize") || 1);
  root.style.setProperty("--tc-hand-size", pct("handSize") || 1);

  root.style.setProperty("--tc-stamp-size", pct("stampSize") || 1);
  root.style.setProperty("--tc-stamp-at", `${STAMP_AT}s`);

  // Halos: the same picture turned slowly in opposite directions, bigger each time.
  const HALOS = [
    { k: 1.0, dir: 1, op: 0.95, secs: 70 },
    { k: 1.42, dir: -1, op: 0.7, secs: 95 },
    { k: 1.9, dir: 1, op: 0.5, secs: 130 }
  ];
  const haloSrc = game.settings.get(MODULE_ID, "angelHalo");
  if (haloSrc) {
    for (let n = 0; n < fx.halos; n++) out.back.push(artImg(haloSrc, "tc-halo", { "--k": HALOS[n].k, "--dir": HALOS[n].dir, "--op": HALOS[n].op, "--secs": `${HALOS[n].secs}s`, "--n": n }));
  }


  // Wings. At grade A a second, higher pair sits behind the first.
  const wingSrc = game.settings.get(MODULE_ID, "angelWing");
  if (wingSrc && fx.wings) {
    for (let pair = fx.wings; pair >= 1; pair--) {
      const scale = fx.wingScale * (pair === 2 ? 0.74 : 1);
      out.back.push(wing("l", pair, scale), wing("r", pair, scale));
    }
  }

  if (fx.dust) out.front.push(dust(fx.dust));

  // Hands reaching in from the bottom corners (B and A), in front of the portrait, wings and name.
  const handSrc = game.settings.get(MODULE_ID, "angelHands");
  if (handSrc) for (const spec of HAND_SETS[gradeIndex]) out.front.push(hand(handSrc, spec));

  // The stamp comes down last, so it lands on top of the hands and the grade can always be read.
  out.front.push(stamp(grade, gradeIndex));
  if (fx.flash) out.root.push(h("div", "tc-flash"));
  return out;
}

/** An <img> that quietly removes itself if the file is missing. */
function artImg(src, className, vars = {}) {
  const img = h("img", className);
  img.alt = "";
  img.decoding = "async";
  img.src = src;
  for (const [k, v] of Object.entries(vars)) img.style.setProperty(k, v);
  img.addEventListener("error", () => img.remove(), { once: true });
  return img;
}

/** One wing, built from your wing picture. The left one is the same picture flipped. */
function wing(side, pair, scale) {
  const left = side === "l";
  const own = left ? game.settings.get(MODULE_ID, "angelWingLeft") : "";
  const src = own || game.settings.get(MODULE_ID, "angelWing");

  const wrap = h("div", `tc-wing tc-wing--${side} tc-wing--p${pair}`);
  wrap.style.setProperty("--k", scale);
  const sway = h("div", "tc-wing-sway");
  const img = artImg(src, "tc-wing-img");
  if (left && !own) img.classList.add("tc-flip");
  img.addEventListener("error", () => wrap.remove(), { once: true });
  sway.append(img);
  wrap.append(sway);
  return wrap;
}

/** One cluster of reaching hands. It rises from the edge, then keeps clawing forward. */
function hand(src, spec) {
  const mirror = game.settings.get(MODULE_ID, "handsMirror");
  const wrap = h("div", `tc-hand tc-hand--${spec.from}`);
  wrap.style.cssText =
    `--x:${spec.x};--w:${spec.w};--at:${spec.at}s;--dim:${spec.dim ?? 1};` +
    `--fx:${!!spec.flip !== mirror ? -1 : 1};--gt:${spec.gt ?? 2.8}s;--go:${rand(0, 0.8).toFixed(2)}s`;
  const reach = h("div", "tc-hand-reach");
  const sway = h("div", "tc-hand-sway");
  const img = artImg(src, "tc-hand-img");
  img.addEventListener("error", () => wrap.remove(), { once: true });
  sway.append(img);
  reach.append(sway);
  wrap.append(reach);
  return wrap;
}

/** The grade stamp. It is thrown from above, hits hard, and leaves an inky print. */
function stamp(grade, gradeIndex) {
  const wrap = h("div", "tc-stamp");
  wrap.style.setProperty("--rot", `${(-9 + rand(-3, 3)).toFixed(1)}deg`);
  wrap.style.setProperty("--tilt", `${rand(-16, -8).toFixed(1)}deg`);

  const art = h("div", "tc-stamp-art");
  const src = game.settings.get(MODULE_ID, `stamp${grade}`);
  const fallback = () => {
    const f = h("div", "tc-stamp-fallback");
    f.innerHTML = `<small>GRADE</small><b>${grade}</b>`;
    return f;
  };
  if (src) {
    const img = h("img");
    img.alt = "";
    img.src = src;
    img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
    art.append(img);
  } else {
    art.append(fallback());
  }

  // Ink flung out by the impact; heavier grades throw more.
  const spatter = h("div", "tc-spatter");
  for (let i = 0; i < 9 + gradeIndex * 5; i++) {
    // The seal sits under the name, so the ink is only flung out sideways and down.
    const a = rand(-0.08, 1.08) * Math.PI;
    const d = rand(0.52, 0.82 + gradeIndex * 0.08);
    const dot = h("span");
    dot.style.setProperty("--dx", (Math.cos(a) * d).toFixed(3));
    dot.style.setProperty("--dy", (Math.sin(a) * d).toFixed(3));
    dot.style.setProperty("--s", `${rand(0.012, 0.05 + gradeIndex * 0.012).toFixed(3)}`);
    spatter.append(dot);
  }

  wrap.append(h("div", "tc-stamp-shock"), art, spatter);
  return wrap;
}

/** Ash drifting up through the band. */
function dust(count) {
  const wrap = h("div", "tc-dust");
  for (let i = 0; i < count; i++) {
    const s = h("span");
    s.style.cssText =
      `--x:${rand(2, 98).toFixed(1)}%;--s:${rand(2, 6).toFixed(1)}px;--d:${rand(0, 3.5).toFixed(2)}s;` +
      `--t:${rand(2.8, 5.4).toFixed(2)}s;--dx:${rand(-40, 40).toFixed(0)}px;--rise:${rand(0.45, 0.95).toFixed(2)}`;
    wrap.append(s);
  }
  return wrap;
}

/** A rough, ripped edge for the Survivor band (a CSS polygon). */
function tornPolygon() {
  const pts = [];
  for (let x = 0; x <= 100; x += 2.5) pts.push(`${x}% ${rand(0, 5).toFixed(1)}%`);
  for (let x = 100; x >= 0; x -= 2.5) pts.push(`${x}% ${(100 - rand(0, 5)).toFixed(1)}%`);
  return pts.join(",");
}

function loopingVideo(src) {
  const v = document.createElement("video");
  v.src = src;
  v.muted = true; // the faction sound is a separate audio file
  v.loop = true;
  v.autoplay = true;
  v.playsInline = true;
  v.play?.().catch(() => {});
  return v;
}

function portraitMedia(src) {
  if (/\.(webm|mp4|m4v|ogv)(\?|$)/i.test(src)) return loopingVideo(src);
  const img = h("img");
  img.alt = "";
  img.src = src;
  img.addEventListener("error", () => (img.src = "icons/svg/mystery-man.svg"), { once: true });
  return img;
}

/* -------------------------------------------------------------------------- */
/*  Sound                                                                     */
/* -------------------------------------------------------------------------- */

async function playSound(src) {
  if (!src) return null;
  const interfaceVolume = game.settings.get("core", "globalInterfaceVolume") ?? 1;
  const volume = game.settings.get(MODULE_ID, "volume") * interfaceVolume;
  try {
    // The `false` keeps it local: every client already runs this itself.
    return await foundry.audio.AudioHelper.play({ src, volume, loop: false, autoplay: true }, false);
  } catch (err) {
    console.warn(`${MODULE_ID} | could not play ${src}`, err);
    return null;
  }
}

function stopSound(sound, fadeMs = 600) {
  if (!sound) return;
  if (!fadeMs) return void sound.stop();
  Promise.resolve(sound.fade?.(0, { duration: fadeMs }))
    .catch(() => {})
    .finally(() => sound.stop());
}

function speak(name) {
  if (!game.settings.get(MODULE_ID, "speak") || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(name);
  utterance.volume = game.settings.get(MODULE_ID, "volume");
  speechSynthesis.speak(utterance);
}

/* -------------------------------------------------------------------------- */
/*  Assigning factions (GM)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Set or clear one actor's faction. Pass null/"" to clear.
 * For angels, `grade` is "D", "C", "B" or "A" (an existing grade is kept, or D if none).
 */
async function setFaction(actor, faction, grade) {
  if (faction && !FACTIONS[faction]) throw new Error(`Unknown faction "${faction}".`);
  if (!faction) {
    await actor.unsetFlag(MODULE_ID, FLAG);
    await actor.unsetFlag(MODULE_ID, GRADE_FLAG);
    return;
  }
  await actor.setFlag(MODULE_ID, FLAG, faction);
  if (faction === "angel") {
    const g = grade || actor.getFlag(MODULE_ID, GRADE_FLAG) || "D";
    await setGrade(actor, g);
  } else {
    await actor.unsetFlag(MODULE_ID, GRADE_FLAG);
  }
}

/** Set an angel's grade. */
async function setGrade(actor, grade) {
  if (!GRADES.includes(grade)) throw new Error(`Unknown grade "${grade}". Use D, C, B or A.`);
  return actor.setFlag(MODULE_ID, GRADE_FLAG, grade);
}

// Adds a "Factions" button to the Actors sidebar tab.
Hooks.on("renderActorDirectory", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || root.querySelector(".tc-factions-btn")) return;

  const button = h("button", "tc-factions-btn");
  button.type = "button";
  button.innerHTML = `<i class="fa-solid fa-masks-theater"></i> Factions`;
  button.addEventListener("click", openAssignDialog);

  (root.querySelector(".header-actions") ?? root.querySelector("header"))?.append(button);
});

async function openAssignDialog() {
  const actors = game.actors.contents.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!actors.length) return ui.notifications.warn("Turn Cinematic: there are no actors yet.");

  const factionOptions = (picked) =>
    [`<option value="">None</option>`]
      .concat(
        Object.entries(FACTIONS).map(
          ([key, look]) => `<option value="${key}" ${key === picked ? "selected" : ""}>${look.label}</option>`
        )
      )
      .join("");
  const gradeOptions = (picked) =>
    GRADES.map((g) => `<option value="${g}" ${g === picked ? "selected" : ""}>Grade ${g}</option>`).join("");

  const rows = actors
    .map((actor) => {
      const faction = actor.getFlag(MODULE_ID, FLAG) ?? "";
      const grade = actor.getFlag(MODULE_ID, GRADE_FLAG) ?? "D";
      return `<div class="tc-row" data-name="${esc(actor.name.toLowerCase())}">
        <img src="${esc(actor.img)}" alt="">
        <span class="tc-row-name">${esc(actor.name)}</span>
        <select data-kind="faction" data-actor="${actor.id}">${factionOptions(faction)}</select>
        <span class="tc-grade-slot"><select data-kind="grade" data-actor="${actor.id}" ${faction === "angel" ? "" : "hidden"}>${gradeOptions(grade)}</select></span>
        <button type="button" data-preview="${actor.id}" title="Preview this cinematic"><i class="fa-solid fa-play"></i></button>
      </div>`;
    })
    .join("");

  const pick = (root, id, kind) => root.querySelector(`select[data-kind="${kind}"][data-actor="${id}"]`);

  await foundry.applications.api.DialogV2.wait({
    window: { title: "Assign factions", icon: "fa-solid fa-masks-theater" },
    position: { width: 600 },
    content: `<div class="tc-assign">
      <input type="search" name="tcFilter" placeholder="Filter characters">
      <div class="tc-rows">${rows}</div>
    </div>`,
    buttons: [
      {
        action: "save",
        label: "Save factions",
        icon: "fa-solid fa-check",
        default: true,
        callback: async (event, button, dialog) => {
          const root = dialog?.element ?? button.form ?? document;
          let changed = 0;
          for (const actor of actors) {
            const faction = pick(root, actor.id, "faction")?.value ?? "";
            const grade = faction === "angel" ? pick(root, actor.id, "grade")?.value || "D" : "";
            const currentFaction = actor.getFlag(MODULE_ID, FLAG) ?? "";
            const currentGrade = currentFaction === "angel" ? actor.getFlag(MODULE_ID, GRADE_FLAG) ?? "D" : "";
            if (faction === currentFaction && grade === currentGrade) continue;
            await setFaction(actor, faction, grade);
            changed++;
          }
          ui.notifications.info(`Turn Cinematic: updated ${changed} actor${changed === 1 ? "" : "s"}.`);
        }
      }
    ],
    render: (event, dialog) => {
      const root = dialog.element;

      root.querySelector("[name=tcFilter]").addEventListener("input", (ev) => {
        const q = ev.target.value.trim().toLowerCase();
        root.querySelectorAll(".tc-row").forEach((row) => (row.hidden = !row.dataset.name.includes(q)));
      });

      // The grade picker only exists for angels.
      root.addEventListener("change", (ev) => {
        const select = ev.target;
        if (select.dataset?.kind !== "faction") return;
        pick(root, select.dataset.actor, "grade").hidden = select.value !== "angel";
      });

      root.querySelectorAll("[data-preview]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const actor = game.actors.get(btn.dataset.preview);
          const faction = pick(root, actor.id, "faction").value;
          if (!faction) return ui.notifications.warn("Pick a faction for this character first.");
          const grade = faction === "angel" ? pick(root, actor.id, "grade").value : null;
          show({ faction, grade, name: actor.name, img: actor.img });
        })
      );
    },
    rejectClose: false
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
