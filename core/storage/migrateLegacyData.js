const fs = require('node:fs');
const path = require('node:path');

/** Preserve an existing source checkout's data when moving to the writable app data directory. */
function migrateLegacyData(legacyDirectory, destinationDirectory) {
    if (path.resolve(legacyDirectory) === path.resolve(destinationDirectory)) return;
    fs.mkdirSync(destinationDirectory, { recursive: true });
    const copyIfPresent = name => {
        const source = path.join(legacyDirectory, name), target = path.join(destinationDirectory, name);
        if (fs.existsSync(source) && !fs.existsSync(target)) fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    };
    if (!fs.existsSync(path.join(destinationDirectory, 'cop_database.sqlite'))) {
        // Preserve an uncheckpointed SQLite WAL before opening its copied database.
        copyIfPresent('cop_database.sqlite-wal');
        copyIfPresent('cop_database.sqlite');
    }
    copyIfPresent('map.mbtiles');
}
module.exports = migrateLegacyData;
