const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    SAND: 4,
    WOOD: 5,
    LEAVES: 6,
    WATER: 7,
    GRAVEL: 8,
    COAL_ORE: 9,
    IRON_ORE: 10,
    GOLD_ORE: 11,
    PLANKS: 12,
    CRAFTING_TABLE: 13,
    TORCH: 14,
    WHEAT_0: 15,
    WHEAT_1: 16,
    WHEAT_2: 17,
    WHEAT_FULL: 18,
    FARMLAND: 19,
    COBBLESTONE: 20,
    GLASS: 21,
    CHEST: 22,
    BEDROCK: 23,
    SNOW: 24,
    ICE: 25,
    CACTUS: 26,
};

const BLOCK_DATA = {
    [BLOCKS.GRASS]:    { name:'Gras', emoji:'🌿', color:0x4a7c59, topColor:0x5ea85c, hardness:1, drop:BLOCKS.DIRT, tool:null },
    [BLOCKS.DIRT]:     { name:'Erde', emoji:'🟫', color:0x8B6914, hardness:1, tool:null },
    [BLOCKS.STONE]:    { name:'Stein', emoji:'🪨', color:0x888888, hardness:3, drop:BLOCKS.COBBLESTONE, tool:'pickaxe' },
    [BLOCKS.COBBLESTONE]:{ name:'Kopfstein', emoji:'🪨', color:0x777777, hardness:3, tool:'pickaxe' },
    [BLOCKS.SAND]:     { name:'Sand', emoji:'🏖️', color:0xf0d080, hardness:1, tool:null },
    [BLOCKS.GRAVEL]:   { name:'Kies', emoji:'⚫', color:0x9e9e9e, hardness:1, tool:null },
    [BLOCKS.WOOD]:     { name:'Holz', emoji:'🪵', color:0x8B4513, hardness:2, tool:'axe' },
    [BLOCKS.LEAVES]:   { name:'Blätter', emoji:'🍃', color:0x2d6e33, hardness:1, transparent:true, tool:null },
    [BLOCKS.PLANKS]:   { name:'Holzbrett', emoji:'🟤', color:0xbc8a5f, hardness:2, tool:'axe' },
    [BLOCKS.COAL_ORE]: { name:'Kohleerz', emoji:'⬛', color:0x555555, hardness:3, tool:'pickaxe', drops:'coal', dropCount:2 },
    [BLOCKS.IRON_ORE]: { name:'Eisenerz', emoji:'🔘', color:0xb8860b, hardness:4, tool:'pickaxe', drops:'iron_ore', dropCount:1 },
    [BLOCKS.GOLD_ORE]: { name:'Golderz', emoji:'🟡', color:0xffd700, hardness:5, tool:'pickaxe', drops:'gold_ore', dropCount:1 },
    [BLOCKS.WATER]:    { name:'Wasser', emoji:'💧', color:0x2266cc, hardness:Infinity, transparent:true, liquid:true },
    [BLOCKS.CRAFTING_TABLE]:{ name:'Werkbank', emoji:'🔧', color:0x8B4513, hardness:2, tool:'axe' },
    [BLOCKS.TORCH]:    { name:'Fackel', emoji:'🕯️', color:0xff8800, hardness:0, transparent:true, light:true },
    [BLOCKS.FARMLAND]: { name:'Ackerland', emoji:'🟤', color:0x6b4226, hardness:1, tool:null },
    [BLOCKS.WHEAT_0]:  { name:'Weizen (jung)', emoji:'🌱', color:0x4a7c59, hardness:0, transparent:true, crop:true, stage:0 },
    [BLOCKS.WHEAT_1]:  { name:'Weizen', emoji:'🌿', color:0x5ea85c, hardness:0, transparent:true, crop:true, stage:1 },
    [BLOCKS.WHEAT_2]:  { name:'Weizen (reif)', emoji:'🌾', color:0xa8c44e, hardness:0, transparent:true, crop:true, stage:2 },
    [BLOCKS.WHEAT_FULL]:{ name:'Weizen (voll)', emoji:'🌾', color:0xdaa520, hardness:0, transparent:true, crop:true, stage:3, drop:'wheat', dropCount:2 },
    [BLOCKS.GLASS]:    { name:'Glas', emoji:'🔲', color:0xaaddff, hardness:1, transparent:true },
    [BLOCKS.CHEST]:    { name:'Kiste', emoji:'📦', color:0xa0522d, hardness:2, tool:'axe' },
    [BLOCKS.BEDROCK]:  { name:'Grundstein', emoji:'⬛', color:0x333333, hardness:Infinity },
    [BLOCKS.SNOW]:     { name:'Schnee', emoji:'❄️', color:0xffffff, hardness:0.5, tool:null },
    [BLOCKS.ICE]:      { name:'Eis', emoji:'🧊', color:0x88ccff, hardness:1, transparent:true },
    [BLOCKS.CACTUS]:   { name:'Kaktus', emoji:'🌵', color:0x3a7a30, hardness:1, tool:null },
};

function getBlockColor(type, face) {
    const data = BLOCK_DATA[type];
    if (!data) return 0xffffff;
    if (type === BLOCKS.GRASS && face === 'top') return data.topColor || data.color;
    return data.color;
}

function createBlockMaterial(type, face) {
    let color = getBlockColor(type, face);
    const data = BLOCK_DATA[type];
    const mat = new THREE.MeshLambertMaterial({ color });
    if (data && data.transparent) { mat.transparent = true; mat.opacity = (type === BLOCKS.WATER) ? 0.65 : (type === BLOCKS.GLASS) ? 0.4 : 0.85; }
    return mat;
}

const ITEMS = {
    coal:       { name:'Kohle', emoji:'⬛' },
    iron_ore:   { name:'Eisenerz', emoji:'🔘' },
    gold_ore:   { name:'Golderz', emoji:'🟡' },
    wheat:      { name:'Weizen', emoji:'🌾' },
    seeds:      { name:'Samen', emoji:'🌱' },
    bread:      { name:'Brot', emoji:'🍞', food:5 },
    apple:      { name:'Apfel', emoji:'🍎', food:4 },
    stick:      { name:'Stock', emoji:'🥢' },
    wood_sword: { name:'Holzschwert', emoji:'🗡️', damage:3, type:'sword' },
    stone_sword:{ name:'Steinschwert', emoji:'🗡️', damage:5, type:'sword' },
    wood_pickaxe:{ name:'Holzspitzhacke', emoji:'⛏️', damage:1, type:'pickaxe', level:1 },
    stone_pickaxe:{ name:'Steinspitzhacke', emoji:'⛏️', damage:1, type:'pickaxe', level:2 },
    wood_axe:   { name:'Holzaxt', emoji:'🪓', damage:2, type:'axe' },
    stone_axe:  { name:'Steinaxt', emoji:'🪓', damage:2, type:'axe' },
    torch:      { name:'Fackel', emoji:'🕯️', placeable:BLOCKS.TORCH },
    planks:     { name:'Holzbrett', emoji:'🟤', placeable:BLOCKS.PLANKS },
    crafting_table:{ name:'Werkbank', emoji:'🔧', placeable:BLOCKS.CRAFTING_TABLE },
    glass:      { name:'Glas', emoji:'🔲', placeable:BLOCKS.GLASS },
    cooked_pork:{ name:'Gebratenes Fleisch', emoji:'🥩', food:8 },
    pork:       { name:'Rohes Fleisch', emoji:'🥩', food:3 },
};

// Add all placeable blocks as items too
Object.keys(BLOCKS).forEach(k => {
    const id = BLOCKS[k];
    if (id === BLOCKS.AIR) return;
    const d = BLOCK_DATA[id];
    if (!d) return;
    if (!ITEMS[k.toLowerCase()]) {
        ITEMS[k.toLowerCase()] = { name: d.name, emoji: d.emoji, placeable: id };
    }
});
