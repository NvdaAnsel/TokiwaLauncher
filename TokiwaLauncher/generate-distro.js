#!/usr/bin/env node

/**
 * Tokiwa Launcher - Distribution.json Generator
 * 
 * Usage:
 *   node generate-distro.js
 * 
 * 縺薙・繧ｹ繧ｯ繝ｪ繝励ヨ縺ｯ莉･荳九ｒ閾ｪ蜍輔〒陦後＞縺ｾ縺・
 * 1. Modrinth API 縺九ｉ蜷Мod縺ｮ譛譁ｰ繝舌・繧ｸ繝ｧ繝ｳ・・.21.4 + Fabric・峨ｒ蜿門ｾ・ * 2. Mod jar繝輔ぃ繧､繝ｫ繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝・ * 3. MD5繝上ャ繧ｷ繝･繝ｻ繝輔ぃ繧､繝ｫ繧ｵ繧､繧ｺ繧定ｨ育ｮ・ * 4. Fabric Loader縺ｮversion.json繧堤函謌・ * 5. distribution.json 繧貞・蜉・ * 
 * 蜑肴署: Node.js v18+ (fetch API縺悟ｿ・ｦ・
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// 險ｭ螳・- 蠢・ｦ√↓蠢懊§縺ｦ螟画峩縺励※縺上□縺輔＞
// ============================================================
const CONFIG = {
    // Minecraft 繝舌・繧ｸ繝ｧ繝ｳ
    mcVersion: '1.21.4',

    // Fabric Loader 繝舌・繧ｸ繝ｧ繝ｳ (遨ｺ縺ｮ蝣ｴ蜷医・譛譁ｰ繧定・蜍募叙蠕・
    fabricLoaderVersion: '',

    // Mod繝輔ぃ繧､繝ｫ縺ｮ繝帙せ繝・ぅ繝ｳ繧ｰ蜈医・繝ｼ繧ｹURL
    // GitHub Pages縺ｮ蝣ｴ蜷・ https://<username>.github.io/TokiwaLauncher/repo
    // 閾ｪ蜑阪し繝ｼ繝舌・縺ｮ蝣ｴ蜷・ https://files.yourserver.com
    baseFileUrl: 'https://NvdaAnsel.github.io/TokiwaLauncher/repo',

    // 繝繧ｦ繝ｳ繝ｭ繝ｼ繝牙・繝・ぅ繝ｬ繧ｯ繝医Μ
    outputDir: './repo',

    // Modrinth User-Agent (蠢・・
    userAgent: 'TokiwaLauncher/1.0.0 (contact@gradex.games)',

    // 繧ｵ繝ｼ繝舌・險ｭ螳・    servers: [
        {
            id: 'gradex-main-1.21.4',
            name: 'GradeX Main',
            description: 'GradeX 繝｡繧､繝ｳ繧ｵ繝ｼ繝舌・',
            address: 'mc.GradeX.games:25565',
            mcVersion: '1.21.4',
            mainServer: true,
            includeMods: true  // Mod繧貞性繧√ｋ縺・        },
        {
            id: 'gradex-meme-TBD',
            name: 'GradeX Meme',
            description: 'GradeX Meme 繧ｵ繝ｼ繝舌・',
            address: 'meme.gradex.games:25565',
            mcVersion: 'TBD',
            mainServer: false,
            includeMods: false
        },
        {
            id: 'gradex-private-TBD',
            name: 'GradeX Private',
            description: 'GradeX 繝励Λ繧､繝吶・繝医し繝ｼ繝舌・',
            address: 'private.gradex.games:25565',
            mcVersion: 'TBD',
            mainServer: false,
            includeMods: false
        },
        {
            id: 'gradex-yoruha-TBD',
            name: 'Yoruha',
            description: 'Yoruha 繧ｵ繝ｼ繝舌・',
            address: 'Yoruha.gradex.games:25565',
            mcVersion: 'TBD',
            mainServer: false,
            includeMods: false
        },
        {
            id: 'gradex-haruto-TBD',
            name: 'Haruto',
            description: 'Haruto 繧ｵ繝ｼ繝舌・',
            address: 'haruto.gradex.games:25565',
            mcVersion: 'TBD',
            mainServer: false,
            includeMods: false
        }
    ],

    // 繧､繝ｳ繧ｹ繝医・繝ｫ縺吶ｋMod (Modrinth slug)
    mods: [
        { slug: 'sodium',    name: 'Sodium',  required: true },
        { slug: 'lithium',   name: 'Lithium', required: true },
        { slug: 'iris',      name: 'Iris Shaders', required: true },
        { slug: 'fabric-api', name: 'Fabric API', required: true },
    ],

    // Discord Rich Presence (繧ｪ繝励す繝ｧ繝ｳ - 荳崎ｦ√↑繧臥ｩｺ譁・ｭ・
    discord: {
        clientId: '',
        smallImageText: 'GradeX',
        smallImageKey: 'gradex-icon'
    }
};

// ============================================================
// Modrinth API
// ============================================================
const MODRINTH_API = 'https://api.modrinth.com/v2';

async function modrinthFetch(endpoint) {
    const res = await fetch(`${MODRINTH_API}${endpoint}`, {
        headers: { 'User-Agent': CONFIG.userAgent }
    });
    if (!res.ok) throw new Error(`Modrinth API error: ${res.status} ${endpoint}`);
    return res.json();
}

async function getLatestVersion(slug, mcVersion, loader = 'fabric') {
    const versions = await modrinthFetch(
        `/project/${slug}/version?loaders=["${loader}"]&game_versions=["${mcVersion}"]`
    );
    if (!versions.length) {
        throw new Error(`No ${loader} version found for ${slug} on MC ${mcVersion}`);
    }
    // 譛譁ｰ縺ｮ繝ｪ繝ｪ繝ｼ繧ｹ迚医ｒ霑斐☆
    const release = versions.find(v => v.version_type === 'release') || versions[0];
    return release;
}

async function getLatestFabricLoaderVersion() {
    // Fabric Meta API
    const res = await fetch('https://meta.fabricmc.net/v2/versions/loader', {
        headers: { 'User-Agent': CONFIG.userAgent }
    });
    const loaders = await res.json();
    const stable = loaders.find(l => l.stable) || loaders[0];
    return stable.version;
}

async function getFabricVersionJson(mcVersion, loaderVersion) {
    const res = await fetch(
        `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`,
        { headers: { 'User-Agent': CONFIG.userAgent } }
    );
    if (!res.ok) throw new Error(`Failed to get Fabric version JSON: ${res.status}`);
    return res.json();
}

// ============================================================
// 繝輔ぃ繧､繝ｫ繝繧ｦ繝ｳ繝ｭ繝ｼ繝・& 繝上ャ繧ｷ繝･險育ｮ・// ============================================================
async function downloadFile(url, destPath) {
    const res = await fetch(url, {
        headers: { 'User-Agent': CONFIG.userAgent }
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, buffer);
    
    return buffer;
}

function getMD5(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

// ============================================================
// 繝｡繧､繝ｳ蜃ｦ逅・// ============================================================
async function main() {
    console.log('噫 Tokiwa Launcher Distribution Generator');
    console.log('=========================================\n');

    // 1. Fabric Loader 繝舌・繧ｸ繝ｧ繝ｳ蜿門ｾ・    const loaderVersion = CONFIG.fabricLoaderVersion || await getLatestFabricLoaderVersion();
    console.log(`逃 Fabric Loader: ${loaderVersion}`);

    // 2. Fabric version.json 蜿門ｾ・& 菫晏ｭ・    console.log(`塘 Fetching Fabric version.json for MC ${CONFIG.mcVersion}...`);
    const versionJson = await getFabricVersionJson(CONFIG.mcVersion, loaderVersion);
    const versionId = `${CONFIG.mcVersion}-fabric-${loaderVersion}`;
    const versionJsonPath = path.join(CONFIG.outputDir, 'versions', versionId, `${versionId}.json`);
    fs.mkdirSync(path.dirname(versionJsonPath), { recursive: true });
    const versionJsonStr = JSON.stringify(versionJson, null, 2);
    fs.writeFileSync(versionJsonPath, versionJsonStr);
    const versionJsonBuffer = Buffer.from(versionJsonStr);
    console.log(`   笨・Saved: ${versionJsonPath}`);

    // 3. Fabric Loader jar 繝繧ｦ繝ｳ繝ｭ繝ｼ繝・    console.log(`\n踏 Downloading Fabric Loader ${loaderVersion}...`);
    const fabricLoaderUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-loader/${loaderVersion}/fabric-loader-${loaderVersion}.jar`;
    const fabricLoaderPath = path.join(
        CONFIG.outputDir, 'lib', 'net', 'fabricmc', 'fabric-loader', loaderVersion,
        `fabric-loader-${loaderVersion}.jar`
    );
    const fabricLoaderBuffer = await downloadFile(fabricLoaderUrl, fabricLoaderPath);
    console.log(`   笨・Fabric Loader: ${fabricLoaderBuffer.length} bytes`);

    // 4. 蜷Мod繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝・    console.log('\n踏 Downloading mods from Modrinth...');
    const modModules = [];

    for (const mod of CONFIG.mods) {
        console.log(`   剥 ${mod.name} (${mod.slug})...`);
        const version = await getLatestVersion(mod.slug, CONFIG.mcVersion);
        const primaryFile = version.files.find(f => f.primary) || version.files[0];

        // Mod繝輔ぃ繧､繝ｫ蜷阪°繧盈aven鬚ｨ繝代せ繧剃ｽ懊ｋ
        const fileName = primaryFile.filename;
        const modDir = path.join(CONFIG.outputDir, 'mods', 'fabric');
        const modPath = path.join(modDir, fileName);

        const buffer = await downloadFile(primaryFile.url, modPath);
        const md5 = getMD5(buffer);

        console.log(`   笨・${fileName} (${buffer.length} bytes, MD5: ${md5})`);

        // Maven ID 繧呈ｧ狗ｯ・        const mavenId = `${mod.slug}:${mod.slug}:${version.version_number}@jar`;

        modModules.push({
            id: mavenId,
            name: mod.name,
            type: 'FabricMod',
            required: {
                value: mod.required,
                def: true
            },
            artifact: {
                size: buffer.length,
                MD5: md5,
                path: fileName,
                url: `${CONFIG.baseFileUrl}/mods/fabric/${fileName}`
            }
        });
    }

    // 5. Distribution.json 繧堤ｵ・∩遶九※
    console.log('\n統 Generating distribution.json...');

    const fabricModule = {
        id: `net.fabricmc:fabric-loader:${loaderVersion}`,
        name: `Fabric Loader ${loaderVersion}`,
        type: 'Fabric',
        artifact: {
            size: fabricLoaderBuffer.length,
            MD5: getMD5(fabricLoaderBuffer),
            url: `${CONFIG.baseFileUrl}/lib/net/fabricmc/fabric-loader/${loaderVersion}/fabric-loader-${loaderVersion}.jar`
        },
        subModules: [
            {
                id: versionId,
                name: 'Fabric (version.json)',
                type: 'VersionManifest',
                artifact: {
                    size: versionJsonBuffer.length,
                    MD5: getMD5(versionJsonBuffer),
                    url: `${CONFIG.baseFileUrl}/versions/${versionId}/${versionId}.json`
                }
            },
            ...modModules
        ]
    };

    const servers = CONFIG.servers.map(srv => ({
        id: srv.id,
        name: srv.name,
        description: srv.description,
        icon: '',
        version: '1.0.0',
        address: srv.address,
        minecraftVersion: srv.mcVersion,
        discord: {
            shortId: srv.name,
            largeImageText: `${srv.name} Server`,
            largeImageKey: srv.id
        },
        mainServer: srv.mainServer,
        autoconnect: true,
        modules: srv.includeMods ? [fabricModule] : []
    }));

    const distribution = {
        version: '1.0.0',
        discord: CONFIG.discord,
        rss: '',
        servers
    };

    const distroPath = path.join(CONFIG.outputDir, '..', 'distribution.json');
    fs.writeFileSync(distroPath, JSON.stringify(distribution, null, 4));
    console.log(`   笨・Saved: ${distroPath}`);

    // 6. 繧ｵ繝槭Μ繝ｼ陦ｨ遉ｺ
    console.log('\n=========================================');
    console.log('笨・螳御ｺ・ｼ―n');
    console.log('刀 逕滓・縺輔ｌ縺溘ヵ繧｡繧､繝ｫ:');
    console.log(`   ${distroPath}`);
    console.log(`   ${CONFIG.outputDir}/  (Mod & Loader繝輔ぃ繧､繝ｫ)\n`);
    console.log('搭 谺｡縺ｮ繧ｹ繝・ャ繝・');
    console.log('   1. distribution.json 縺ｮ baseFileUrl 繧堤｢ｺ隱阪・菫ｮ豁｣');
    console.log('   2. repo/ 繝輔か繝ｫ繝縺斐→繝帙せ繝・ぅ繝ｳ繧ｰ蜈医↓繧｢繝・・繝ｭ繝ｼ繝・);
    console.log('      - GitHub Pages: 繝ｪ繝昴ず繝医Μ縺ｫpush 竊・Settings 竊・Pages譛牙柑蛹・);
    console.log('      - 縺ｾ縺溘・莉ｻ諢上・HTTP繧ｵ繝ｼ繝舌・縺ｫ驟咲ｽｮ');
    console.log('   3. distromanager.js 縺ｮ REMOTE_DISTRO_URL 繧呈峩譁ｰ');
    console.log('   4. npm start 縺ｧ蜍穂ｽ懃｢ｺ隱・);
    console.log('=========================================');
}

main().catch(err => {
    console.error('\n笶・Error:', err.message);
    process.exit(1);
});
