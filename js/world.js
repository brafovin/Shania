class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.blocks = new Map();
        this.meshes = new Map();
        this.chunkSize = 16;
        this.worldHeight = 64;
        this.seaLevel = 20;
        this.noise = new SimplexNoise(Date.now() * 0.001);
        this.noise2 = new SimplexNoise(Date.now() * 0.002 + 999);
        this.loadedChunks = new Set();
        this.dirtyChunks = new Set();
        this.cropGrowthTimer = 0;
        this.blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    }

    key(x, y, z) { return `${x},${y},${z}`; }
    chunkKey(cx, cz) { return `${cx},${cz}`; }

    getChunkCoords(x, z) {
        return { cx: Math.floor(x / this.chunkSize), cz: Math.floor(z / this.chunkSize) };
    }

    getBlock(x, y, z) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        return this.blocks.get(this.key(x, y, z)) ?? BLOCKS.AIR;
    }

    setBlock(x, y, z, type) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        const k = this.key(x, y, z);
        if (type === BLOCKS.AIR) this.blocks.delete(k);
        else this.blocks.set(k, type);
        const { cx, cz } = this.getChunkCoords(x, z);
        this.dirtyChunks.add(this.chunkKey(cx, cz));
        for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
                this.dirtyChunks.add(this.chunkKey(cx + dx, cz + dz));
    }

    getHeight(x, z) {
        const scale = 0.015, scale2 = 0.04;
        const base = this.noise.octave(x * scale, z * scale, 6, 0.5, 2);
        const detail = this.noise2.octave(x * scale2, z * scale2, 3, 0.5, 2);
        const h = Math.floor(this.seaLevel + base * 18 + detail * 5);
        return Math.max(2, Math.min(h, this.worldHeight - 5));
    }

    getBiome(x, z) {
        const t = this.noise2.octave(x * 0.005, z * 0.005, 2, 0.5, 2);
        if (t > 0.4) return 'snow';
        if (t < -0.4) return 'desert';
        return 'plains';
    }

    generateChunk(cx, cz) {
        const key = this.chunkKey(cx, cz);
        if (this.loadedChunks.has(key)) return;
        this.loadedChunks.add(key);

        const ox = cx * this.chunkSize, oz = cz * this.chunkSize;

        for (let lx = 0; lx < this.chunkSize; lx++) {
            for (let lz = 0; lz < this.chunkSize; lz++) {
                const wx = ox + lx, wz = oz + lz;
                const h = this.getHeight(wx, wz);
                const biome = this.getBiome(wx, wz);

                this.blocks.set(this.key(wx, 0, wz), BLOCKS.BEDROCK);

                for (let y = 1; y < h - 3; y++) {
                    const stoneChance = this.noise.noise2D(wx * 0.1 + y, wz * 0.1);
                    let bt = BLOCKS.STONE;
                    if (stoneChance > 0.7 && y < 10) bt = BLOCKS.GRAVEL;
                    this.blocks.set(this.key(wx, y, wz), bt);
                }

                // Ores
                for (let y = 1; y < h - 3; y++) {
                    const oreN = this.noise.noise2D(wx * 0.3 + y * 0.5, wz * 0.3 + 13);
                    if (y < 30 && oreN > 0.75) this.blocks.set(this.key(wx, y, wz), BLOCKS.COAL_ORE);
                    else if (y < 20 && oreN > 0.82) this.blocks.set(this.key(wx, y, wz), BLOCKS.IRON_ORE);
                    else if (y < 10 && oreN > 0.88) this.blocks.set(this.key(wx, y, wz), BLOCKS.GOLD_ORE);
                }

                // Surface layers
                if (h <= this.seaLevel + 1) {
                    // Underwater
                    this.blocks.set(this.key(wx, h-3, wz), BLOCKS.SAND);
                    this.blocks.set(this.key(wx, h-2, wz), BLOCKS.SAND);
                    this.blocks.set(this.key(wx, h-1, wz), BLOCKS.SAND);
                    for (let y = h; y <= this.seaLevel; y++) this.blocks.set(this.key(wx, y, wz), BLOCKS.WATER);
                } else if (biome === 'desert') {
                    this.blocks.set(this.key(wx, h-3, wz), BLOCKS.SAND);
                    this.blocks.set(this.key(wx, h-2, wz), BLOCKS.SAND);
                    this.blocks.set(this.key(wx, h-1, wz), BLOCKS.SAND);
                    this.blocks.set(this.key(wx, h, wz), BLOCKS.SAND);
                } else if (biome === 'snow') {
                    this.blocks.set(this.key(wx, h-2, wz), BLOCKS.DIRT);
                    this.blocks.set(this.key(wx, h-1, wz), BLOCKS.DIRT);
                    this.blocks.set(this.key(wx, h, wz), BLOCKS.SNOW);
                } else {
                    this.blocks.set(this.key(wx, h-2, wz), BLOCKS.DIRT);
                    this.blocks.set(this.key(wx, h-1, wz), BLOCKS.DIRT);
                    this.blocks.set(this.key(wx, h, wz), BLOCKS.GRASS);
                }

                // Trees
                if (biome === 'plains' && h > this.seaLevel + 1) {
                    const treeN = this.noise.noise2D(wx * 0.4 + 77, wz * 0.4 + 55);
                    if (treeN > 0.85 && lx > 2 && lx < this.chunkSize - 2 && lz > 2 && lz < this.chunkSize - 2) {
                        this.placeTree(wx, h + 1, wz);
                    }
                }

                // Cactus in desert
                if (biome === 'desert') {
                    const cN = this.noise.noise2D(wx * 0.6 + 33, wz * 0.6 + 44);
                    if (cN > 0.9) {
                        const ch = 2 + Math.floor(Math.random() * 3);
                        for (let cy = 0; cy < ch; cy++) this.blocks.set(this.key(wx, h + 1 + cy, wz), BLOCKS.CACTUS);
                    }
                }
            }
        }

        this.dirtyChunks.add(key);
    }

    placeTree(x, y, z) {
        const h = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < h; i++) this.blocks.set(this.key(x, y + i, z), BLOCKS.WOOD);
        for (let lx = -2; lx <= 2; lx++)
            for (let lz = -2; lz <= 2; lz++)
                for (let ly = -1; ly <= 1; ly++) {
                    if (lx === 0 && lz === 0 && ly <= 0) continue;
                    if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly) <= 3)
                        if (!this.blocks.has(this.key(x+lx, y+h+ly, z+lz)))
                            this.blocks.set(this.key(x+lx, y+h+ly, z+lz), BLOCKS.LEAVES);
                }
    }

    isBlockVisible(x, y, z) {
        const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        for (const [dx,dy,dz] of neighbors) {
            const n = this.getBlock(x+dx, y+dy, z+dz);
            const nd = BLOCK_DATA[n];
            if (n === BLOCKS.AIR || (nd && (nd.transparent || nd.liquid))) return true;
        }
        return false;
    }

    buildChunkMesh(cx, cz) {
        const key = this.chunkKey(cx, cz);
        if (this.meshes.has(key)) {
            this.meshes.get(key).forEach(m => { this.scene.remove(m); m.geometry.dispose(); });
        }

        const ox = cx * this.chunkSize, oz = cz * this.chunkSize;
        const meshMap = new Map();

        for (let lx = 0; lx < this.chunkSize; lx++) {
            for (let lz = 0; lz < this.chunkSize; lz++) {
                for (let y = 0; y < this.worldHeight; y++) {
                    const wx = ox + lx, wz = oz + lz;
                    const type = this.getBlock(wx, y, wz);
                    if (type === BLOCKS.AIR) continue;
                    const data = BLOCK_DATA[type];
                    if (!data) continue;
                    if (!this.isBlockVisible(wx, y, wz)) continue;

                    const matKey = type;
                    if (!meshMap.has(matKey)) meshMap.set(matKey, []);
                    meshMap.get(matKey).push(new THREE.Vector3(wx, y, wz));
                }
            }
        }

        const chunkMeshes = [];
        meshMap.forEach((positions, type) => {
            if (positions.length === 0) return;
            const mat = createBlockMaterial(type, 'side');
            const dummy = new THREE.Object3D();
            const mesh = new THREE.InstancedMesh(this.blockGeometry, mat, positions.length);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            positions.forEach((pos, i) => {
                dummy.position.copy(pos);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            mesh.userData = { type, positions };
            this.scene.add(mesh);
            chunkMeshes.push(mesh);
        });

        this.meshes.set(key, chunkMeshes);
    }

    update(playerX, playerZ, dt) {
        const renderDist = 4;
        const { cx: pcx, cz: pcz } = this.getChunkCoords(playerX, playerZ);

        for (let dx = -renderDist; dx <= renderDist; dx++) {
            for (let dz = -renderDist; dz <= renderDist; dz++) {
                if (dx*dx + dz*dz > renderDist*renderDist) continue;
                const cx = pcx + dx, cz = pcz + dz;
                this.generateChunk(cx, cz);
            }
        }

        // Rebuild dirty chunks
        let rebuilt = 0;
        for (const key of [...this.dirtyChunks]) {
            if (rebuilt >= 2) break;
            const [cx, cz] = key.split(',').map(Number);
            if (Math.abs(cx - pcx) <= renderDist + 1 && Math.abs(cz - pcz) <= renderDist + 1) {
                this.buildChunkMesh(cx, cz);
                this.dirtyChunks.delete(key);
                rebuilt++;
            } else {
                this.dirtyChunks.delete(key);
            }
        }

        // Crop growth
        this.cropGrowthTimer += dt;
        if (this.cropGrowthTimer > 5) {
            this.cropGrowthTimer = 0;
            this.growCrops();
        }
    }

    growCrops() {
        const crops = [BLOCKS.WHEAT_0, BLOCKS.WHEAT_1, BLOCKS.WHEAT_2];
        const nextStage = { [BLOCKS.WHEAT_0]: BLOCKS.WHEAT_1, [BLOCKS.WHEAT_1]: BLOCKS.WHEAT_2, [BLOCKS.WHEAT_2]: BLOCKS.WHEAT_FULL };
        for (const [key, type] of this.blocks) {
            if (crops.includes(type) && Math.random() < 0.1) {
                const [x, y, z] = key.split(',').map(Number);
                this.setBlock(x, y, z, nextStage[type]);
            }
        }
    }

    raycast(origin, direction, maxDist = 6) {
        const step = 0.05;
        let dist = 0;
        let prev = null;
        while (dist < maxDist) {
            const x = Math.floor(origin.x + direction.x * dist);
            const y = Math.floor(origin.y + direction.y * dist);
            const z = Math.floor(origin.z + direction.z * dist);
            const type = this.getBlock(x, y, z);
            if (type !== BLOCKS.AIR && type !== BLOCKS.WATER) {
                const data = BLOCK_DATA[type];
                if (!data || !data.liquid) {
                    return { x, y, z, type, prev, dist };
                }
            }
            prev = { x, y, z };
            dist += step;
        }
        return null;
    }
}
