// Main game loop
let renderer, scene, camera, world, player, entityManager, craftingSystem;
let keys = {};
let mouseButtons = {};
let dayTime = 0; // 0-1, 0.5=noon
let gameRunning = false;
let lastTime = 0;
let ambientLight, sunLight, moonLight, fog;
let miningTarget = null;
let miningBar = null;
let blockBreakParticles = [];

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.025);
    fog = scene.fog;

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

    // Lighting
    ambientLight = new THREE.AmbientLight(0x606080, 0.4);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    scene.add(sunLight);

    moonLight = new THREE.DirectionalLight(0x8899cc, 0.2);
    scene.add(moonLight);

    // Sky sphere
    const skyGeo = new THREE.SphereGeometry(200, 16, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.name = 'sky';
    scene.add(sky);

    // World
    world = new World(scene);

    // Player
    player = new Player(world);

    // Entity Manager
    entityManager = new EntityManager(scene, world);

    // Crafting
    craftingSystem = new CraftingSystem(player);

    // Mining bar
    const barGeo = new THREE.PlaneGeometry(1, 0.08);
    miningBar = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    miningBar.visible = false;
    scene.add(miningBar);

    // Generate initial world
    generateInitialWorld();
}

function generateInitialWorld() {
    const progress = document.getElementById('progress');
    let p = 0;
    const interval = setInterval(() => {
        p += 5;
        progress.style.width = p + '%';
        if (p >= 100) {
            clearInterval(interval);
            startGame();
        }
    }, 50);

    // Pre-generate chunks around spawn
    for (let cx = -3; cx <= 3; cx++)
        for (let cz = -3; cz <= 3; cz++)
            world.generateChunk(cx, cz);

    // Find spawn
    const spawnH = world.getHeight(0, 0);
    player.position.set(0, spawnH + 3, 0);
}

function startGame() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    entityManager.spawnInitial(player.position.x, player.position.z);

    // Build initial meshes
    for (const key of world.dirtyChunks) {
        const [cx, cz] = key.split(',').map(Number);
        world.buildChunkMesh(cx, cz);
    }
    world.dirtyChunks.clear();

    updateHotbarUI(player);
    setupInputHandlers();
    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

function setupInputHandlers() {
    document.addEventListener('keydown', e => {
        keys[e.code] = true;
        // Hotbar slots 1-9
        const slot = parseInt(e.key) - 1;
        if (slot >= 0 && slot <= 8) {
            player.hotbarSlot = slot;
            updateHotbarUI(player);
        }
        // Inventory
        if (e.code === 'KeyE') {
            const inv = document.getElementById('inventory-screen');
            if (inv.style.display === 'none' || !inv.style.display) {
                inv.style.display = 'flex';
                document.exitPointerLock();
                updateInventoryUI(player);
            } else {
                inv.style.display = 'none';
                document.getElementById('game-canvas').requestPointerLock();
            }
        }
        // Eat (F)
        if (e.code === 'KeyF') {
            const held = player.getHeldItem();
            if (held) {
                const itemData = ITEMS[held.id];
                if (itemData && itemData.food) {
                    if (player.hunger < player.maxHunger) {
                        player.eat(itemData);
                        held.count--;
                        if (held.count <= 0) player.inventory[player.hotbarSlot] = null;
                        updateHotbarUI(player);
                        showMessage(`${itemData.emoji} ${itemData.name} gegessen!`);
                    } else showMessage('Du bist satt!');
                }
            }
        }
        // Escape
        if (e.code === 'Escape') {
            document.getElementById('inventory-screen').style.display = 'none';
        }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });

    // Mouse look
    document.getElementById('game-canvas').addEventListener('click', () => {
        if (document.getElementById('inventory-screen').style.display !== 'flex') {
            document.getElementById('game-canvas').requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {});

    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement === document.getElementById('game-canvas')) {
            const sens = 0.002;
            player.yaw -= e.movementX * sens;
            player.pitch -= e.movementY * sens;
            player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
        }
    });

    // Left click - mine
    document.addEventListener('mousedown', e => {
        mouseButtons[e.button] = true;
        if (e.button === 2 && document.pointerLockElement === document.getElementById('game-canvas')) {
            handleRightClick();
        }
    });
    document.addEventListener('mouseup', e => {
        mouseButtons[e.button] = false;
        if (e.button === 0) {
            player.miningProgress = 0;
            miningTarget = null;
            miningBar.visible = false;
        }
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
        if (document.pointerLockElement === document.getElementById('game-canvas')) {
            player.hotbarSlot = (player.hotbarSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
            updateHotbarUI(player);
        }
    });

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    document.getElementById('respawn-btn').addEventListener('click', () => {
        player.respawn();
        player.inventory = new Array(36).fill(null);
        player.giveItem('wood', 5, true);
        player.giveItem('apple', 3, true);
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('game-canvas').requestPointerLock();
        updateHotbarUI(player);
    });
}

function handleRightClick() {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const hit = world.raycast(origin, direction);
    if (!hit || !hit.prev) return;

    const held = player.getHeldItem();
    if (!held) return;

    const itemData = ITEMS[held.id];
    if (!itemData) return;

    // Plant seeds on farmland
    if (held.id === 'seeds') {
        const below = world.getBlock(hit.prev.x, hit.prev.y - 1, hit.prev.z);
        if (below === BLOCKS.FARMLAND || below === BLOCKS.DIRT || below === BLOCKS.GRASS) {
            world.setBlock(hit.prev.x, hit.prev.y - 1, hit.prev.z, BLOCKS.FARMLAND);
            world.setBlock(hit.prev.x, hit.prev.y, hit.prev.z, BLOCKS.WHEAT_0);
            held.count--;
            if (held.count <= 0) player.inventory[player.hotbarSlot] = null;
            updateHotbarUI(player);
            showMessage('🌱 Samen gepflanzt!');
            return;
        }
    }

    // Place block
    if (itemData.placeable !== undefined) {
        const px = hit.prev.x, py = hit.prev.y, pz = hit.prev.z;
        // Don't place on player
        const ppx = Math.floor(player.position.x), ppz = Math.floor(player.position.z);
        const ppy0 = Math.floor(player.position.y), ppy1 = Math.floor(player.position.y + 1);
        if (px === ppx && pz === ppz && (py === ppy0 || py === ppy1)) return;

        world.setBlock(px, py, pz, itemData.placeable);
        held.count--;
        if (held.count <= 0) player.inventory[player.hotbarSlot] = null;
        updateHotbarUI(player);
    }
}

function updateDayNight(dt) {
    dayTime = (dayTime + dt / 240) % 1; // 4-minute day
    const angle = dayTime * Math.PI * 2;
    const isDay = dayTime < 0.5;
    const brightness = Math.sin(dayTime * Math.PI);

    sunLight.position.set(Math.cos(angle) * 100, Math.sin(angle) * 100, 50);
    sunLight.intensity = Math.max(0, brightness * 1.2);
    moonLight.position.set(-Math.cos(angle) * 100, -Math.sin(angle) * 100, 50);
    moonLight.intensity = Math.max(0, -brightness * 0.3 + 0.15);
    ambientLight.intensity = 0.15 + brightness * 0.5;

    // Sky color
    const sky = scene.getObjectByName('sky');
    if (sky) {
        const dayColor = new THREE.Color(0x87ceeb);
        const nightColor = new THREE.Color(0x050515);
        const sunsetColor = new THREE.Color(0xff6633);
        const t = brightness;
        let skyColor;
        if (t > 0.3) skyColor = dayColor.lerp(new THREE.Color(0x87ceeb), t);
        else if (t > 0) skyColor = sunsetColor.lerp(dayColor, t / 0.3);
        else skyColor = nightColor;
        sky.material.color.set(skyColor);
        fog.color.set(skyColor);
    }

    // Day/night display
    const hour = Math.floor(dayTime * 24);
    const min = Math.floor((dayTime * 24 - hour) * 60);
    document.getElementById('day-time').textContent =
        `${isDay ? '☀️' : '🌙'} ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;

    return !isDay;
}

function handleMining(dt) {
    if (!mouseButtons[0] || document.pointerLockElement !== document.getElementById('game-canvas')) {
        miningTarget = null;
        player.miningProgress = 0;
        miningBar.visible = false;
        return;
    }

    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    const hit = world.raycast(origin, direction);

    if (!hit) {
        miningTarget = null;
        player.miningProgress = 0;
        miningBar.visible = false;
        return;
    }

    const hitKey = `${hit.x},${hit.y},${hit.z}`;
    if (!miningTarget || miningTarget !== hitKey) {
        miningTarget = hitKey;
        player.miningProgress = 0;
        player.startMining(hit.type);
    }

    const blockData = BLOCK_DATA[hit.type];
    if (blockData.hardness === Infinity) {
        miningBar.visible = false;
        return;
    }

    const done = player.updateMining(dt, hit);

    // Mining bar above block
    miningBar.position.set(hit.x, hit.y + 0.7, hit.z);
    miningBar.lookAt(camera.position);
    miningBar.scale.x = player.miningProgress;
    miningBar.visible = true;

    if (done) {
        breakBlock(hit.x, hit.y, hit.z, hit.type);
        miningTarget = null;
        player.miningProgress = 0;
        miningBar.visible = false;
    }
}

function breakBlock(x, y, z, type) {
    const data = BLOCK_DATA[type];
    if (!data || data.hardness === Infinity) return;

    world.setBlock(x, y, z, BLOCKS.AIR);

    // Drops
    let dropId = null, dropCount = 1;
    if (data.drops) { dropId = data.drops; dropCount = data.dropCount || 1; }
    else if (data.drop !== undefined) { dropId = blockToItemId(data.drop); dropCount = 1; }
    else { dropId = blockToItemId(type); dropCount = 1; }

    if (dropId) {
        if (player.giveItem(dropId, dropCount)) {
            const itemData = ITEMS[dropId] || {};
            showMessage(`+ ${itemData.emoji || '?'} ${dropCount > 1 ? dropCount + 'x ' : ''}${itemData.name || dropId}`);
        }
    }

    // Crop drops seeds
    if (data.crop) {
        if (data.stage === 3 && player.giveItem('seeds', 1)) showMessage('+ 🌱 Samen');
    }

    // Leaves drop apples
    if (type === BLOCKS.LEAVES && Math.random() < 0.1) {
        player.giveItem('apple', 1);
        showMessage('+ 🍎 Apfel gefunden!');
    }

    updateHotbarUI(player);
    spawnBreakParticles(x, y, z, data.color || 0x888888);
}

function blockToItemId(blockType) {
    if (blockType === null || blockType === undefined) return null;
    const data = BLOCK_DATA[blockType];
    if (!data) return null;
    // Find matching item
    for (const [id, item] of Object.entries(ITEMS)) {
        if (item.placeable === blockType) return id;
    }
    // Try by name
    const name = Object.keys(BLOCKS).find(k => BLOCKS[k] === blockType);
    return name ? name.toLowerCase() : null;
}

function spawnBreakParticles(x, y, z, color) {
    for (let i = 0; i < 8; i++) {
        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const mat = new THREE.MeshBasicMaterial({ color });
        const p = new THREE.Mesh(geo, mat);
        p.position.set(x + Math.random() - 0.5, y + Math.random(), z + Math.random() - 0.5);
        p.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 5 + 2,
            (Math.random() - 0.5) * 4
        );
        p.life = 0.6;
        scene.add(p);
        blockBreakParticles.push(p);
    }
}

function updateParticles(dt) {
    blockBreakParticles = blockBreakParticles.filter(p => {
        p.life -= dt;
        p.velocity.y -= 20 * dt;
        p.position.addScaledVector(p.velocity, dt);
        p.material.opacity = p.life;
        if (p.life <= 0) { scene.remove(p); p.geometry.dispose(); return false; }
        return true;
    });
}

function handleEntityAttack() {
    if (!mouseButtons[0] || player.attackCooldown > 0) return;
    if (document.pointerLockElement !== document.getElementById('game-canvas')) return;

    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);

    const held = player.getHeldItem();
    const itemData = held ? ITEMS[held.id] : null;
    const attackDmg = itemData && itemData.damage ? itemData.damage : 1;

    // Check entity hits
    for (const entity of entityManager.entities) {
        if (entity.dead) continue;
        const dist = entity.position.distanceTo(camera.position);
        if (dist > 5) continue;

        const toEntity = new THREE.Vector3().subVectors(entity.position, camera.position).normalize();
        const dot = toEntity.dot(direction);
        if (dot > 0.9) {
            entity.takeDamage(attackDmg);
            entity.velocity.x += direction.x * 3;
            entity.velocity.z += direction.z * 3;
            entity.velocity.y = 3;
            player.attackCooldown = 0.5;

            if (entity.dead) {
                const loot = entity.getLoot();
                loot.forEach(l => {
                    if (player.giveItem(l.item, l.count)) {
                        const idata = ITEMS[l.item] || {};
                        showMessage(`+ ${idata.emoji || '?'} ${idata.name || l.item} x${l.count}`);
                    }
                });
                updateHotbarUI(player);
            }
            break;
        }
    }
}

function updateEntityAttacks(playerPos) {
    for (const entity of entityManager.entities) {
        if (!entity.hostile || entity.dead) continue;
        if (entity.attackCooldown > 0) continue;
        const dist = entity.position.distanceTo(playerPos);
        if (dist < entity.attackRange + 0.5) {
            const died = player.takeDamage(entity.attackDamage || 2, entity.type);
            entity.attackCooldown = 1.5;
            if (died) {
                document.getElementById('death-screen').style.display = 'flex';
                document.getElementById('death-message').textContent = `Getötet von einem ${entity.type === 'zombie' ? 'Zombie' : entity.type === 'skeleton' ? 'Skelett' : 'Spinne'}!`;
                document.exitPointerLock();
            }
        }
    }
}

function updateHUD() {
    const hp = (player.health / player.maxHealth) * 100;
    const hn = (player.hunger / player.maxHunger) * 100;
    document.getElementById('health-fill').style.width = hp + '%';
    document.getElementById('hunger-fill').style.width = hn + '%';
    document.getElementById('health-text').textContent = `${Math.ceil(player.health)}/${player.maxHealth}`;
    document.getElementById('hunger-text').textContent = `${Math.ceil(player.hunger)}/${player.maxHunger}`;

    const p = player.position;
    document.getElementById('coords').innerHTML =
        `X: ${p.x.toFixed(1)}<br>Y: ${p.y.toFixed(1)}<br>Z: ${p.z.toFixed(1)}`;
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (!player.dead) {
        player.update(dt, keys, camera);
        world.update(player.position.x, player.position.z, dt);

        const isNight = updateDayNight(dt);

        handleMining(dt);
        handleEntityAttack();

        entityManager.update(dt, player.position, isNight);
        updateEntityAttacks(player.position);

        updateParticles(dt);
        updateHUD();

        // Falling damage
        if (player.onGround && player.velocity.y === 0) {
            // handled via velocity check elsewhere
        }

        // Sun follows player for shadows
        sunLight.target.position.copy(player.position);
        sunLight.target.updateMatrixWorld();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

// Boot
window.addEventListener('load', init);
