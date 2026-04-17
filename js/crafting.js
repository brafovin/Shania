const RECIPES = [
    {
        id: 'planks',
        name: 'Holzbretter',
        emoji: '🟤',
        ingredients: [{ id: 'wood', count: 1 }],
        result: { id: 'planks', count: 4 }
    },
    {
        id: 'stick',
        name: 'Stöcke',
        emoji: '🥢',
        ingredients: [{ id: 'planks', count: 2 }],
        result: { id: 'stick', count: 4 }
    },
    {
        id: 'crafting_table',
        name: 'Werkbank',
        emoji: '🔧',
        ingredients: [{ id: 'planks', count: 4 }],
        result: { id: 'crafting_table', count: 1 }
    },
    {
        id: 'torch',
        name: 'Fackel',
        emoji: '🕯️',
        ingredients: [{ id: 'coal', count: 1 }, { id: 'stick', count: 1 }],
        result: { id: 'torch', count: 4 }
    },
    {
        id: 'wood_pickaxe',
        name: 'Holzspitzhacke',
        emoji: '⛏️',
        ingredients: [{ id: 'planks', count: 3 }, { id: 'stick', count: 2 }],
        result: { id: 'wood_pickaxe', count: 1 }
    },
    {
        id: 'stone_pickaxe',
        name: 'Steinspitzhacke',
        emoji: '⛏️',
        ingredients: [{ id: 'cobblestone', count: 3 }, { id: 'stick', count: 2 }],
        result: { id: 'stone_pickaxe', count: 1 }
    },
    {
        id: 'wood_axe',
        name: 'Holzaxt',
        emoji: '🪓',
        ingredients: [{ id: 'planks', count: 3 }, { id: 'stick', count: 2 }],
        result: { id: 'wood_axe', count: 1 }
    },
    {
        id: 'stone_axe',
        name: 'Steinaxt',
        emoji: '🪓',
        ingredients: [{ id: 'cobblestone', count: 3 }, { id: 'stick', count: 2 }],
        result: { id: 'stone_axe', count: 1 }
    },
    {
        id: 'wood_sword',
        name: 'Holzschwert',
        emoji: '🗡️',
        ingredients: [{ id: 'planks', count: 2 }, { id: 'stick', count: 1 }],
        result: { id: 'wood_sword', count: 1 }
    },
    {
        id: 'stone_sword',
        name: 'Steinschwert',
        emoji: '🗡️',
        ingredients: [{ id: 'cobblestone', count: 2 }, { id: 'stick', count: 1 }],
        result: { id: 'stone_sword', count: 1 }
    },
    {
        id: 'bread',
        name: 'Brot',
        emoji: '🍞',
        ingredients: [{ id: 'wheat', count: 3 }],
        result: { id: 'bread', count: 1 }
    },
    {
        id: 'glass',
        name: 'Glas',
        emoji: '🔲',
        ingredients: [{ id: 'sand', count: 4 }],
        result: { id: 'glass', count: 4 }
    },
    {
        id: 'cooked_pork',
        name: 'Gebratenes Fleisch',
        emoji: '🥩',
        ingredients: [{ id: 'pork', count: 1 }, { id: 'coal', count: 1 }],
        result: { id: 'cooked_pork', count: 1 }
    },
];

class CraftingSystem {
    constructor(player) {
        this.player = player;
        this.craftSlots = [null, null, null, null];
        this.setupUI();
    }

    setupUI() {
        // Render recipe list
        const grid = document.getElementById('recipes-grid');
        grid.innerHTML = '';
        RECIPES.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
                <div class="icon">${recipe.emoji}</div>
                <div class="name">${recipe.name}</div>
                <div class="req">${recipe.ingredients.map(i => {
                    const item = ITEMS[i.id];
                    return `${item ? item.emoji : '?'} x${i.count}`;
                }).join(' + ')}</div>
            `;
            card.addEventListener('click', () => this.autoCraft(recipe));
            grid.appendChild(card);
        });

        document.getElementById('craft-btn').addEventListener('click', () => this.tryCraft());
        document.getElementById('close-inventory').addEventListener('click', () => {
            document.getElementById('inventory-screen').style.display = 'none';
            if (document.pointerLockElement !== document.getElementById('game-canvas')) {
                document.getElementById('game-canvas').requestPointerLock();
            }
        });
    }

    autoCraft(recipe) {
        const canCraft = recipe.ingredients.every(ing => this.player.hasItem(ing.id, ing.count));
        if (!canCraft) {
            showMessage('Nicht genug Material!');
            return;
        }
        recipe.ingredients.forEach(ing => this.player.removeItem(ing.id, ing.count));
        this.player.giveItem(recipe.result.id, recipe.result.count);
        showMessage(`Hergestellt: ${recipe.name} x${recipe.result.count}`);
        updateInventoryUI(this.player);
    }

    tryCraft() {
        const filled = this.craftSlots.filter(s => s);
        if (filled.length === 0) return;

        // Try to match a recipe
        for (const recipe of RECIPES) {
            if (this.matchesRecipe(recipe)) {
                recipe.ingredients.forEach(ing => this.player.removeItem(ing.id, ing.count));
                this.player.giveItem(recipe.result.id, recipe.result.count);
                showMessage(`Hergestellt: ${recipe.name}!`);
                this.craftSlots = [null, null, null, null];
                this.updateCraftUI();
                updateInventoryUI(this.player);
                return;
            }
        }
        showMessage('Kein passendes Rezept!');
    }

    matchesRecipe(recipe) {
        return recipe.ingredients.every(ing => this.player.hasItem(ing.id, ing.count));
    }

    updateCraftUI() {
        document.querySelectorAll('.craft-slot').forEach((el, i) => {
            const item = this.craftSlots[i];
            el.textContent = item ? (ITEMS[item]?.emoji || '?') : '';
            el.classList.toggle('filled', !!item);
        });
    }
}

function updateInventoryUI(player) {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 36; i++) {
        const slot = player.inventory[i];
        const el = document.createElement('div');
        el.className = 'slot' + (i === player.hotbarSlot ? ' selected' : '');
        if (slot) {
            const itemData = ITEMS[slot.id] || {};
            el.innerHTML = `<div class="slot-icon">${itemData.emoji || '?'}</div><span class="slot-count">${slot.count > 1 ? slot.count : ''}</span>`;
            el.title = itemData.name || slot.id;
        }
        el.addEventListener('click', () => {
            player.hotbarSlot = i;
            updateHotbarUI(player);
            updateInventoryUI(player);
        });
        grid.appendChild(el);
    }
}

function updateHotbarUI(player) {
    document.querySelectorAll('#hotbar .slot').forEach((el, i) => {
        const slotIdx = i;
        const slot = player.inventory[slotIdx];
        el.classList.toggle('selected', slotIdx === player.hotbarSlot);
        const icon = el.querySelector('.slot-icon');
        const count = el.querySelector('.slot-count');
        if (slot) {
            const itemData = ITEMS[slot.id] || {};
            icon.textContent = itemData.emoji || '?';
            count.textContent = slot.count > 1 ? slot.count : '';
        } else {
            icon.textContent = '';
            count.textContent = '';
        }
    });

    const held = player.inventory[player.hotbarSlot];
    const nameEl = document.getElementById('selected-item-name');
    if (held) {
        const itemData = ITEMS[held.id] || {};
        nameEl.textContent = itemData.name || held.id;
    } else {
        nameEl.textContent = '';
    }
}

let msgTimer = null;
function showMessage(text) {
    const el = document.getElementById('message-box');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
