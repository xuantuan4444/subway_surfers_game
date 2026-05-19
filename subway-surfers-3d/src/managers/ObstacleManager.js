// src/managers/TrackManager.js
export class TrackManager {
    constructor(scene) {
        this.scene = scene;
        this.tiles = [];
        this.tileLength = 10;
        this.visibleTiles = 10;
        this.poolSize = 15;
        
        this.tilePool = [];
        this.activeTiles = [];
        
        this.initPool();
    }
    
    initPool() {
        // Object pooling pattern để tái sử dụng tiles [[16]][[18]]
        for (let i = 0; i < this.poolSize; i++) {
            const tile = this.createTrackTile();
            tile.visible = false;
            this.tilePool.push(tile);
        }
    }
    
    createTrackTile() {
        const group = new THREE.Group();
        
        // Road
        const roadGeo = new THREE.BoxGeometry(9, 0.1, this.tileLength);
        const roadMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.8 
        });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.y = 0;
        group.add(road);
        
        // Lane markers
        for (let i = -1; i <= 1; i++) {
            const markerGeo = new THREE.BoxGeometry(0.2, 0.05, this.tileLength);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(i * 3, 0.03, 0);
            group.add(marker);
        }
        
        this.scene.add(group);
        return group;
    }
    
    getTileFromPool() {
        const tile = this.tilePool.find(t => !t.visible);
        if (tile) {
            tile.visible = true;
            return tile;
        }
        // Create new if pool exhausted
        return this.createTrackTile();
    }
    
    update(speed, delta) {
        // Spawn new tiles ahead
        const furthestZ = this.activeTiles.length > 0 
            ? Math.min(...this.activeTiles.map(t => t.position.z))
            : 0;
            
        if (furthestZ > -this.visibleTiles * this.tileLength) {
            const newTile = this.getTileFromPool();
            newTile.position.set(0, 0, furthestZ - this.tileLength);
            this.activeTiles.push(newTile);
            
            // Add obstacles and coins
            this.addObstaclesToTile(newTile);
            this.addCoinsToTile(newTile);
        }
        
        // Recycle tiles behind player
        this.activeTiles = this.activeTiles.filter(tile => {
            if (tile.position.z > 10) { // Behind player
                tile.visible = false;
                this.tilePool.push(tile);
                return false;
            }
            return true;
        });
    }
    
    addObstaclesToTile(tile) {
        // Random obstacles in lanes
        const lane = Math.floor(Math.random() * 3);
        const obstacle = new Obstacle(this.scene, lane);
        obstacle.mesh.position.z = tile.position.z;
        tile.add(obstacle.mesh);
    }
}