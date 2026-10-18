const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class MbtilesServer {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const mbtilesPath = path.join(process.env.SENTINEL_DATA_DIR || path.join(__dirname, '../../data'), 'map.mbtiles');
        if (fs.existsSync(mbtilesPath)) {
            try {
                this.db = new Database(mbtilesPath, { readonly: true });
                console.log('MBTiles offline map database loaded successfully.');
            } catch (err) {
                console.error('Failed to load MBTiles database:', err);
            }
        } else {
            console.log('No map.mbtiles found in data/ folder. Offline maps will use fallback tactical grid.');
        }
    }

    getTile(z, x, y) {
        if (!this.db) return null;

        try {
            // MBTiles uses TMS coordinates for Y (inverted)
            const tmsY = Math.pow(2, z) - 1 - y;
            
            const row = this.db.prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?').get(z, x, tmsY);
            return row ? row.tile_data : null;
        } catch (err) {
            console.error('Error fetching tile:', err);
            return null;
        }
    }
}

module.exports = new MbtilesServer();
