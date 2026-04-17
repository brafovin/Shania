class Entity {
    constructor(scene, world, x, y, z) {
        this.scene = scene;
        this.world = world;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3();
        this.health = 10;
        this.maxHealth = 10;
        this.dead = false;
        this.mesh = null;
        this.hurtTimer = 0;
        this.gravity = -20;
        this.onGround = false;
        this.hostile = false;
        this.attackCooldown = 0;
        this.alertRange = 16;
        this.attackRange = 1.5;
        this.speed = 3;
        this.createMesh();
    }

    createMesh() {
        const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const mat = new THREE.MeshLambertMaterial({ color: 0x22cc22 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Health bar
        const barGeo = new THREE.PlaneGeometry(1, 0.1);
        const barBg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
        barBg.position.set(0, 1.2, 0);
        this.healthBarBg = barBg;
        this.mesh.add(barBg);

        const barFill = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        barFill.position.set(0, 1.2, 0.01);
        this.healthBar = barFill;
        this.mesh.add(barFill);
    }

    update(dt, playerPos) {
        if (this.dead) return;
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        if (this.mesh.material) {
            this.mesh.material.color.setHex(this.hurtTimer > 0 ? 0xff4444 : this.getColor());
        }

        // AI
        if (this.hostile && playerPos) {
            const dist = this.position.distanceTo(playerPos);
            if (dist < this.alertRange) {
                const dir = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
                this.velocity.x = dir.x * this.speed;
                this.velocity.z = dir.z * this.speed;
                this.mesh.lookAt(playerPos.x, this.position.y, playerPos.z);
            } else {
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
            }
        }

        // Physics
        this.velocity.y += this.gravity * dt;
        const dx = this.velocity.x * dt;
        const dy = this.velocity.y * dt;
        const dz = this.velocity.z * dt;

        // Check collision X
        const newX = this.position.x + dx;
        if (!this.collidesAt(newX, this.position.y, this.position.z))
            this.position.x = newX;
        else this.velocity.x = 0;

        // Check collision Z
        const newZ = this.position.z + dz;
        if (!this.collidesAt(this.position.x, this.position.y, newZ))
            this.position.z = newZ;
        else this.velocity.z = 0;

        // Check collision Y
        const newY = this.position.y + dy;
        if (!this.collidesAt(this.position.x, newY, this.position.z)) {
            this.position.y = newY;
            this.onGround = false;
        } else {
            if (this.velocity.y < 0) this.onGround = true;
            this.velocity.y = 0;
        }

        // Jump over obstacles
        if (this.onGround && this.hostile && Math.abs(this.velocity.x) < 0.1 && Math.abs(this.velocity.z) < 0.1) {
            // stuck, try jump
        }
        if (this.onGround && this.hostile) {
            const blockedX = this.collidesAt(this.position.x + this.velocity.x * 0.2, this.position.y + 1, this.position.z);
            if (!blockedX && (Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5)) {
                // might jump
            }
        }

        this.mesh.position.set(this.position.x, this.position.y + 0.9, this.position.z);

        // Update health bar
        const ratio = this.health / this.maxHealth;
        this.healthBar.scale.x = ratio;
        this.healthBar.position.x = -(1 - ratio) * 0.5;
        this.healthBarBg.visible = this.health < this.maxHealth;
        this.healthBar.visible = this.health < this.maxHealth;
    }

    collidesAt(x, y, z) {
        const hw = 0.35, hh = 0.9;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            const bx = Math.floor(x + dx * hw * 0.9);
            const by = Math.floor(y + dy * hh * 0.9 + hh);
            const bz = Math.floor(z + dz * hw * 0.9);
            const bt = this.world.getBlock(bx, by, bz);
            const bd = BLOCK_DATA[bt];
            if (bt !== BLOCKS.AIR && bd && !bd.liquid && !bd.transparent) {
                const bmin = new THREE.Vector3(bx - 0.5, by - 0.5, bz - 0.5);
                const bmax = new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5);
                if (x - hw < bmax.x && x + hw > bmin.x &&
                    y < bmax.y && y + hh * 2 > bmin.y &&
                    z - hw < bmax.z && z + hw > bmin.z) return true;
            }
        }
        return false;
    }

    takeDamage(dmg) {
        this.health -= dmg;
        this.hurtTimer = 0.3;
        if (this.health <= 0) this.die();
    }

    die() {
        this.dead = true;
        this.scene.remove(this.mesh);
    }

    getColor() { return 0x22cc22; }
    getLoot() { return []; }
}

class Zombie extends Entity {
    constructor(scene, world, x, y, z) {
        super(scene, world, x, y, z);
        this.health = 20;
        this.maxHealth = 20;
        this.hostile = true;
        this.speed = 2.5;
        this.attackDamage = 3;
        this.mesh.material.color.setHex(0x2d5a27);
        this.type = 'zombie';
    }
    getColor() { return 0x2d5a27; }
    getLoot() { return [{ item: 'pork', count: 1 + Math.floor(Math.random() * 2) }]; }
}

class Skeleton extends Entity {
    constructor(scene, world, x, y, z) {
        super(scene, world, x, y, z);
        this.health = 15;
        this.maxHealth = 15;
        this.hostile = true;
        this.speed = 2.8;
        this.attackDamage = 2;
        this.mesh.material.color.setHex(0xddddcc);
        this.type = 'skeleton';
    }
    getColor() { return 0xddddcc; }
    getLoot() { return [{ item: 'coal', count: Math.floor(Math.random() * 2) }]; }
}

class Spider extends Entity {
    constructor(scene, world, x, y, z) {
        super(scene, world, x, y, z);
        this.health = 16;
        this.maxHealth = 16;
        this.hostile = true;
        this.speed = 4;
        this.attackDamage = 2;
        this.mesh.material.color.setHex(0x333333);
        this.mesh.scale.set(1.2, 0.7, 1.2);
        this.type = 'spider';
    }
    getColor() { return 0x333333; }
    getLoot() { return [{ item: 'stick', count: 1 }]; }
}

class Cow extends Entity {
    constructor(scene, world, x, y, z) {
        super(scene, world, x, y, z);
        this.health = 10;
        this.maxHealth = 10;
        this.hostile = false;
        this.speed = 1.5;
        this.mesh.material.color.setHex(0x8B6914);
        this.mesh.scale.set(1.2, 1.2, 1.6);
        this.type = 'cow';
        this.wanderTimer = 0;
        this.wanderDir = new THREE.Vector3();
    }
    update(dt, playerPos) {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 3 + Math.random() * 4;
            const angle = Math.random() * Math.PI * 2;
            this.wanderDir.set(Math.cos(angle) * this.speed, 0, Math.sin(angle) * this.speed);
            if (Math.random() < 0.3) this.wanderDir.set(0, 0, 0);
        }
        this.velocity.x = this.wanderDir.x;
        this.velocity.z = this.wanderDir.z;
        super.update(dt, null);
    }
    getColor() { return 0x8B6914; }
    getLoot() { return [{ item: 'pork', count: 2 + Math.floor(Math.random() * 2) }]; }
}

class EntityManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.entities = [];
        this.spawnTimer = 0;
        this.maxEntities = 30;
    }

    spawnInitial(playerX, playerZ) {
        // Spawn animals near player
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 10 + Math.random() * 20;
            const x = playerX + Math.cos(angle) * r;
            const z = playerZ + Math.sin(angle) * r;
            const y = this.world.getHeight(x, z) + 2;
            this.entities.push(new Cow(this.scene, this.world, x, y, z));
        }
    }

    trySpawn(playerX, playerY, playerZ, isNight) {
        if (this.entities.length >= this.maxEntities) return;

        const angle = Math.random() * Math.PI * 2;
        const r = 16 + Math.random() * 24;
        const x = playerX + Math.cos(angle) * r;
        const z = playerZ + Math.sin(angle) * r;
        const h = this.world.getHeight(x, z);
        const y = h + 2;

        if (isNight && Math.random() < 0.7) {
            const roll = Math.random();
            if (roll < 0.5) this.entities.push(new Zombie(this.scene, this.world, x, y, z));
            else if (roll < 0.75) this.entities.push(new Skeleton(this.scene, this.world, x, y, z));
            else this.entities.push(new Spider(this.scene, this.world, x, y, z));
        } else if (!isNight && Math.random() < 0.4) {
            this.entities.push(new Cow(this.scene, this.world, x, y, z));
        }
    }

    update(dt, playerPos, isNight) {
        this.spawnTimer += dt;
        if (this.spawnTimer > 5) {
            this.spawnTimer = 0;
            this.trySpawn(playerPos.x, playerPos.y, playerPos.z, isNight);
        }

        // Remove dead and far entities
        this.entities = this.entities.filter(e => {
            if (e.dead) return false;
            const dist = e.position.distanceTo(playerPos);
            if (dist > 80) { e.die(); return false; }
            return true;
        });

        for (const e of this.entities) e.update(dt, playerPos);
    }

    getHostileNear(pos, range) {
        return this.entities.filter(e => e.hostile && !e.dead && e.position.distanceTo(pos) < range);
    }

    hitEntity(entity, damage) {
        entity.takeDamage(damage);
        const knockDir = new THREE.Vector3().subVectors(entity.position, entity.position).normalize();
        entity.velocity.x += knockDir.x * 5;
        entity.velocity.z += knockDir.z * 5;
        entity.velocity.y = 5;
        return entity.dead;
    }
}
