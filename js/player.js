class Player {
    constructor(world) {
        this.world = world;
        this.position = new THREE.Vector3(0, 40, 0);
        this.velocity = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.onGround = false;
        this.health = 20;
        this.maxHealth = 20;
        this.hunger = 20;
        this.maxHunger = 20;
        this.dead = false;
        this.width = 0.4;
        this.height = 1.8;
        this.eyeHeight = 1.6;
        this.speed = 5;
        this.jumpForce = 8;
        this.gravity = -25;
        this.inventory = new Array(36).fill(null);
        this.hotbarSlot = 0;
        this.hurtTimer = 0;
        this.hungerTimer = 0;
        this.regenTimer = 0;
        this.invincibleTimer = 0;
        this.miningBlock = null;
        this.miningProgress = 0;
        this.attackCooldown = 0;

        // Starter items
        this.giveItem('wood', 10, true);
        this.giveItem('apple', 5, true);
        this.giveItem('seeds', 3, true);
        this.giveItem('planks', 8, true);
        this.giveItem('torch', 4, true);
    }

    giveItem(itemId, count = 1, silent = false) {
        // Check if block item
        const blockKey = itemId.toUpperCase();
        const blockId = BLOCKS[blockKey];
        const itemData = ITEMS[itemId] || (blockId !== undefined ? { name: BLOCK_DATA[blockId]?.name, emoji: BLOCK_DATA[blockId]?.emoji, placeable: blockId } : null);
        if (!itemData) return false;

        // Try stack existing
        for (let i = 0; i < this.inventory.length; i++) {
            const slot = this.inventory[i];
            if (slot && slot.id === itemId && slot.count < 64) {
                slot.count += count;
                return true;
            }
        }
        // Find empty slot
        for (let i = 0; i < this.inventory.length; i++) {
            if (!this.inventory[i]) {
                this.inventory[i] = { id: itemId, count, ...itemData };
                return true;
            }
        }
        return false;
    }

    removeItem(itemId, count = 1) {
        for (let i = 0; i < this.inventory.length; i++) {
            const slot = this.inventory[i];
            if (slot && slot.id === itemId) {
                slot.count -= count;
                if (slot.count <= 0) this.inventory[i] = null;
                return true;
            }
        }
        return false;
    }

    hasItem(itemId, count = 1) {
        let total = 0;
        for (const slot of this.inventory) {
            if (slot && slot.id === itemId) total += slot.count;
        }
        return total >= count;
    }

    getHeldItem() {
        return this.inventory[this.hotbarSlot];
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    eat(item) {
        if (!item || !item.food) return false;
        this.hunger = Math.min(this.maxHunger, this.hunger + item.food);
        return true;
    }

    takeDamage(dmg, cause = 'unknown') {
        if (this.invincibleTimer > 0 || this.dead) return;
        this.health -= dmg;
        this.invincibleTimer = 0.5;
        this.hurtTimer = 0.2;
        if (this.health <= 0) {
            this.health = 0;
            this.dead = true;
        }
        return this.dead;
    }

    respawn() {
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;
        this.dead = false;
        this.position.set(0, this.world.getHeight(0, 0) + 3, 0);
        this.velocity.set(0, 0, 0);
    }

    update(dt, keys, camera) {
        if (this.dead) return;

        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        // Hunger
        this.hungerTimer += dt;
        if (this.hungerTimer > 8) {
            this.hungerTimer = 0;
            if (this.hunger > 0) this.hunger--;
            if (this.hunger === 0) this.takeDamage(1, 'hunger');
        }

        // Regen
        if (this.hunger >= 18 && this.health < this.maxHealth) {
            this.regenTimer += dt;
            if (this.regenTimer > 2) { this.regenTimer = 0; this.heal(1); }
        }

        // Movement
        const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const move = new THREE.Vector3();

        if (keys['KeyW'] || keys['ArrowUp']) move.addScaledVector(forward, 1);
        if (keys['KeyS'] || keys['ArrowDown']) move.addScaledVector(forward, -1);
        if (keys['KeyA'] || keys['ArrowLeft']) move.addScaledVector(right, -1);
        if (keys['KeyD'] || keys['ArrowRight']) move.addScaledVector(right, 1);

        const spd = (keys['ShiftLeft'] ? this.speed * 1.6 : this.speed) * (this.hunger < 3 ? 0.4 : 1);

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(spd);
            this.velocity.x = move.x;
            this.velocity.z = move.z;
        } else {
            this.velocity.x *= 0.7;
            this.velocity.z *= 0.7;
            if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
            if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
        }

        if (keys['Space'] && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

        // Gravity
        this.velocity.y += this.gravity * dt;

        // Collision X
        const newX = this.position.x + this.velocity.x * dt;
        if (!this.collidesAt(newX, this.position.y, this.position.z)) this.position.x = newX;
        else this.velocity.x = 0;

        // Collision Z
        const newZ = this.position.z + this.velocity.z * dt;
        if (!this.collidesAt(this.position.x, this.position.y, newZ)) this.position.z = newZ;
        else this.velocity.z = 0;

        // Collision Y
        const newY = this.position.y + this.velocity.y * dt;
        if (!this.collidesAt(this.position.x, newY, this.position.z)) {
            this.position.y = newY;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) this.onGround = true;
            this.velocity.y = 0;
        }

        // Keep above bedrock
        if (this.position.y < 1) { this.position.y = 1; this.velocity.y = 0; }

        // Void damage
        if (this.position.y < 0) this.takeDamage(5, 'void');

        // Camera
        camera.position.set(
            this.position.x,
            this.position.y + this.eyeHeight,
            this.position.z
        );
        camera.rotation.order = 'YXZ';
        camera.rotation.y = this.yaw;
        camera.rotation.x = this.pitch;
    }

    collidesAt(x, y, z) {
        const hw = this.width;
        const offsets = [
            [hw, 0, hw], [-hw, 0, hw], [hw, 0, -hw], [-hw, 0, -hw],
            [hw, this.height * 0.5, hw], [-hw, this.height * 0.5, hw],
            [hw, this.height * 0.5, -hw], [-hw, this.height * 0.5, -hw],
            [hw, this.height, hw], [-hw, this.height, hw],
            [hw, this.height, -hw], [-hw, this.height, -hw],
        ];
        for (const [dx, dy, dz] of offsets) {
            const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz);
            const bt = this.world.getBlock(bx, by, bz);
            const bd = BLOCK_DATA[bt];
            if (bt !== BLOCKS.AIR && bd && !bd.liquid && !bd.transparent && !bd.crop) return true;
        }
        return false;
    }

    startMining(blockType) {
        const data = BLOCK_DATA[blockType];
        if (!data) return;
        const held = this.getHeldItem();
        const toolType = held && ITEMS[held.id] ? ITEMS[held.id].type : null;
        const toolBonus = (data.tool && toolType === data.tool) ? 3 : 1;
        this.miningSpeed = toolBonus / (data.hardness || 1);
    }

    updateMining(dt, targetBlock) {
        if (!targetBlock) { this.miningProgress = 0; return false; }
        this.miningProgress += this.miningSpeed * dt;
        return this.miningProgress >= 1;
    }
}
