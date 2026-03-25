const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG = {
    mcVersion: '1.21.11',
    fabricLoaderVersion: '',
    baseFileUrl: 'https://NvdaAnsel.github.io/TokiwaLauncher/repo',
    outputDir: './repo',
    userAgent: 'TokiwaLauncher/1.0.0 (contact@gradex.games)',
    servers: [
        { id: 'gradex-main-1.21.11', name: 'get0', description: 'mc.GradeX.games', address: 'mc.GradeX.games:25565', mcVersion: '1.21.11', mainServer: true, includeMods: true },
        { id: 'gradex-meme-TBD', name: 'meme', description: 'meme.gradex.games', address: 'meme.gradex.games:25565', mcVersion: 'TBD', mainServer: false, includeMods: false },
        { id: 'gradex-private-TBD', name: 'private', description: 'private.gradex.games', address: 'private.gradex.games:25565', mcVersion: 'TBD', mainServer: false, includeMods: false },
        { id: 'gradex-haruto-TBD', name: 'Haruto', description: 'haruto.gradex.games', address: 'haruto.gradex.games:25565', mcVersion: 'TBD', mainServer: false, includeMods: false },
        { id: 'nyancraft-1.21.11', name: 'にゃんクラ', description: 'にゃんクラ サーバー', address: '172.234.80.42:46400', mcVersion: '1.21.11', mainServer: false, includeMods: true }
    ],
    mods: [
        { slug: 'sodium', name: 'Sodium', required: true },
        { slug: 'lithium', name: 'Lithium', required: true },
        { slug: 'iris', name: 'Iris Shaders', required: true },
        { slug: 'fabric-api', name: 'Fabric API', required: true }
    ],
    discord: { clientId: '', smallImageText: 'GradeX', smallImageKey: 'gradex-icon' }
};

const MODRINTH_API = 'https://api.modrinth.com/v2';

async function modrinthFetch(endpoint) {
    const res = await fetch(MODRINTH_API + endpoint, { headers: { 'User-Agent': CONFIG.userAgent } });
    if (!res.ok) throw new Error('Modrinth API error: ' + res.status + ' ' + endpoint);
    return res.json();
}

async function getLatestVersion(slug, mcVersion) {
    const versions = await modrinthFetch('/project/' + slug + '/version?loaders=["fabric"]&game_versions=["' + mcVersion + '"]');
    if (!versions.length) throw new Error('No fabric version found for ' + slug + ' on MC ' + mcVersion);
    return versions.find(function(v) { return v.version_type === 'release'; }) || versions[0];
}

async function getLatestFabricLoaderVersion() {
    const res = await fetch('https://meta.fabricmc.net/v2/versions/loader', { headers: { 'User-Agent': CONFIG.userAgent } });
    var loaders = await res.json();
    var stable = loaders.find(function(l) { return l.stable; }) || loaders[0];
    return stable.version;
}

async function getFabricVersionJson(mcVersion, loaderVersion) {
    var url = 'https://meta.fabricmc.net/v2/versions/loader/' + mcVersion + '/' + loaderVersion + '/profile/json';
    var res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
    if (!res.ok) throw new Error('Failed to get Fabric version JSON: ' + res.status);
    return res.json();
}

async function downloadFile(url, destPath) {
    var res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
    if (!res.ok) throw new Error('Download failed: ' + res.status + ' ' + url);
    var buffer = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
    return buffer;
}

function getMD5(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

async function main() {
    console.log('Tokiwa Launcher Distribution Generator');
    console.log('=========================================\n');

    var loaderVersion = CONFIG.fabricLoaderVersion || await getLatestFabricLoaderVersion();
    console.log('Fabric Loader: ' + loaderVersion);

    console.log('Fetching Fabric version.json for MC ' + CONFIG.mcVersion + '...');
    var versionJson = await getFabricVersionJson(CONFIG.mcVersion, loaderVersion);
    var versionId = CONFIG.mcVersion + '-fabric-' + loaderVersion;
    var versionJsonPath = path.join(CONFIG.outputDir, 'versions', versionId, versionId + '.json');
    fs.mkdirSync(path.dirname(versionJsonPath), { recursive: true });
    var versionJsonStr = JSON.stringify(versionJson, null, 2);
    fs.writeFileSync(versionJsonPath, versionJsonStr);
    var versionJsonBuffer = Buffer.from(versionJsonStr);
    console.log('  Saved: ' + versionJsonPath);

    console.log('\nDownloading Fabric Loader ' + loaderVersion + '...');
    var fabricLoaderUrl = 'https://maven.fabricmc.net/net/fabricmc/fabric-loader/' + loaderVersion + '/fabric-loader-' + loaderVersion + '.jar';
    var fabricLoaderPath = path.join(CONFIG.outputDir, 'lib', 'net', 'fabricmc', 'fabric-loader', loaderVersion, 'fabric-loader-' + loaderVersion + '.jar');
    var fabricLoaderBuffer = await downloadFile(fabricLoaderUrl, fabricLoaderPath);
    console.log('  Fabric Loader: ' + fabricLoaderBuffer.length + ' bytes');

    console.log('\nDownloading mods from Modrinth...');
    var modModules = [];

    for (var i = 0; i < CONFIG.mods.length; i++) {
        var mod = CONFIG.mods[i];
        console.log('  ' + mod.name + ' (' + mod.slug + ')...');
        var version = await getLatestVersion(mod.slug, CONFIG.mcVersion);
        var primaryFile = version.files.find(function(f) { return f.primary; }) || version.files[0];
        var fileName = primaryFile.filename;
        var modPath = path.join(CONFIG.outputDir, 'mods', 'fabric', fileName);
        var buffer = await downloadFile(primaryFile.url, modPath);
        var md5 = getMD5(buffer);
        console.log('  OK: ' + fileName + ' (' + buffer.length + ' bytes, MD5: ' + md5 + ')');

        modModules.push({
            id: mod.slug + ':' + mod.slug + ':' + version.version_number + '@jar',
            name: mod.name,
            type: 'FabricMod',
            required: { value: mod.required, def: true },
            artifact: {
                size: buffer.length,
                MD5: md5,
                path: fileName,
                url: CONFIG.baseFileUrl + '/mods/fabric/' + fileName
            }
        });
    }

    console.log('\nGenerating distribution.json...');

    var fabricModule = {
        id: 'net.fabricmc:fabric-loader:' + loaderVersion,
        name: 'Fabric Loader ' + loaderVersion,
        type: 'Fabric',
        artifact: {
            size: fabricLoaderBuffer.length,
            MD5: getMD5(fabricLoaderBuffer),
            url: CONFIG.baseFileUrl + '/lib/net/fabricmc/fabric-loader/' + loaderVersion + '/fabric-loader-' + loaderVersion + '.jar'
        },
        subModules: [
            {
                id: versionId,
                name: 'Fabric (version.json)',
                type: 'VersionManifest',
                artifact: {
                    size: versionJsonBuffer.length,
                    MD5: getMD5(versionJsonBuffer),
                    url: CONFIG.baseFileUrl + '/versions/' + versionId + '/' + versionId + '.json'
                }
            }
        ].concat(modModules)
    };

    var servers = CONFIG.servers.map(function(srv) {
        return {
            id: srv.id,
            name: srv.name,
            description: srv.description,
            icon: '',
            version: '1.0.0',
            address: srv.address,
            minecraftVersion: srv.mcVersion,
            discord: { shortId: srv.name, largeImageText: srv.name + ' Server', largeImageKey: srv.id },
            mainServer: srv.mainServer,
            autoconnect: true,
            modules: srv.includeMods ? [fabricModule] : []
        };
    });

    var distribution = {
        version: '1.0.0',
        discord: CONFIG.discord,
        rss: '',
        servers: servers
    };

    var distroPath = path.join('.', 'distribution.json');
    fs.writeFileSync(distroPath, JSON.stringify(distribution, null, 4));
    console.log('  Saved: ' + distroPath);

    console.log('\n=========================================');
    console.log('Done!\n');
    console.log('Generated files:');
    console.log('  distribution.json');
    console.log('  ' + CONFIG.outputDir + '/  (Mod & Loader files)\n');
    console.log('Next steps:');
    console.log('  1. Check baseFileUrl in distribution.json');
    console.log('  2. Upload repo/ folder to hosting');
    console.log('  3. Update REMOTE_DISTRO_URL in distromanager.js');
    console.log('  4. Run: npm start');
}

main().catch(function(err) {
    console.error('Error:', err.message);
    process.exit(1);
});
