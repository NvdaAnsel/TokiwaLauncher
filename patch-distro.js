/**
 * patch-distro.js
 * 
 * Fabric version.json の libraries を読み取り、
 * distribution.json の Fabric モジュールの subModules に
 * type: "Library" として追加するパッチスクリプト。
 * 
 * これにより helios-core の DistributionIndexProcessor が
 * ASM 等の Fabric 依存ライブラリを自動ダウンロード・検証し、
 * processbuilder.js の _resolveServerLibraries → _resolveModuleLibraries が
 * クラスパスに追加するようになる。
 * 
 * 使い方:
 *   node patch-distro.js
 * 
 * 前提:
 *   - repo/versions/1.21.4-fabric-0.18.4/1.21.4-fabric-0.18.4.json が存在
 *   - distribution.json が存在
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// ============================================================
// 設定
// ============================================================
const DISTRO_PATH = path.join(__dirname, 'distribution.json');
const VERSION_JSON_DIR = path.join(__dirname, 'repo', 'versions');
const LIB_OUTPUT_DIR = path.join(__dirname, 'repo', 'lib');
const BASE_FILE_URL = 'https://NvdaAnsel.github.io/TokiwaLauncher/repo';

// ============================================================
// ユーティリティ
// ============================================================

function mavenToPath(name) {
    // org.ow2.asm:asm-tree:9.9 → org/ow2/asm/asm-tree/9.9/asm-tree-9.9.jar
    const parts = name.split(':');
    const group = parts[0].replace(/\./g, '/');
    const artifact = parts[1];
    const version = parts[2];
    return `${group}/${artifact}/${version}/${artifact}-${version}.jar`;
}

function getMD5(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

function download(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return download(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
    console.log('=== Fabric Libraries Patcher ===\n');

    // 1. distribution.json を読み込む
    const distro = JSON.parse(fs.readFileSync(DISTRO_PATH, 'utf-8'));

    for (const server of distro.servers) {
        // 2. Fabric モジュールを探す
        const fabricModule = server.modules.find(m => m.type === 'Fabric');
        if (!fabricModule) {
            console.log(`[${server.name}] Fabric モジュールなし、スキップ`);
            continue;
        }

        // 3. VersionManifest subModule を探す
        const versionManifestSub = fabricModule.subModules.find(
            sm => sm.type === 'VersionManifest'
        );
        if (!versionManifestSub) {
            console.log(`[${server.name}] VersionManifest なし、スキップ`);
            continue;
        }

        // 4. version.json を読み込む
        const versionId = versionManifestSub.id;
        const versionJsonPath = path.join(VERSION_JSON_DIR, versionId, `${versionId}.json`);
        if (!fs.existsSync(versionJsonPath)) {
            console.log(`[${server.name}] ${versionJsonPath} が見つかりません、スキップ`);
            continue;
        }
        const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
        console.log(`[${server.name}] version.json 読み込み: ${versionJson.libraries.length} ライブラリ`);

        // 5. 既存の Library subModules の ID を収集（重複防止）
        const existingIds = new Set(
            fabricModule.subModules
                .filter(sm => sm.type === 'Library')
                .map(sm => sm.id)
        );

        // 6. 各 Fabric ライブラリを処理
        let added = 0;
        for (const lib of versionJson.libraries) {
            const mavenId = lib.name;

            // バニラ Minecraft のライブラリは除外（Mojang側で処理される）
            if (!lib.url && !lib.name.startsWith('net.fabricmc')) {
                continue;
            }

            // 既に追加済みなら skip
            const libId = mavenId.replace(/:/g, ':') + '@jar';
            if (existingIds.has(libId) || existingIds.has(mavenId)) {
                console.log(`  [SKIP] ${mavenId} (既に存在)`);
                continue;
            }

            // Maven URL を組み立てる
            const mavenPath = mavenToPath(mavenId);
            const baseUrl = (lib.url || 'https://libraries.minecraft.net/').replace(/\/$/, '');
            const downloadUrl = `${baseUrl}/${mavenPath}`;

            // ダウンロード
            console.log(`  [DL] ${mavenId} ...`);
            let jarBuffer;
            try {
                jarBuffer = await download(downloadUrl);
            } catch (err) {
                // fabricmc.net で失敗したら Maven Central を試す
                const fallbackUrl = `https://repo1.maven.org/maven2/${mavenPath}`;
                console.log(`    → fabricmc.net 失敗、Maven Central にフォールバック...`);
                try {
                    jarBuffer = await download(fallbackUrl);
                } catch (err2) {
                    console.error(`    ✗ ダウンロード失敗: ${err2.message}`);
                    continue;
                }
            }

            // ローカルに保存
            const localPath = path.join(LIB_OUTPUT_DIR, mavenPath.replace(/\//g, path.sep));
            fs.mkdirSync(path.dirname(localPath), { recursive: true });
            fs.writeFileSync(localPath, jarBuffer);

            const md5 = getMD5(jarBuffer);
            console.log(`    ✓ ${jarBuffer.length} bytes, MD5: ${md5}`);

            // subModule エントリを作成
            const libraryEntry = {
                id: mavenId,
                name: mavenId.split(':').slice(0, 2).join(':'),
                type: 'Library',
                artifact: {
                    size: jarBuffer.length,
                    MD5: md5,
                    url: `${BASE_FILE_URL}/lib/${mavenPath}`
                }
            };

            fabricModule.subModules.push(libraryEntry);
            existingIds.add(mavenId);
            added++;
        }

        console.log(`[${server.name}] ${added} ライブラリ追加完了\n`);
    }

    // 7. distribution.json を保存
    fs.writeFileSync(DISTRO_PATH, JSON.stringify(distro, null, 4));
    console.log(`✅ distribution.json 更新完了`);
    console.log('\n次のステップ:');
    console.log('  1. repo/ フォルダを GitHub Pages にプッシュ');
    console.log('  2. キャッシュクリア & テスト:');
    console.log('     Remove-Item -Recurse -Force "$env:APPDATA\\Tokiwa Launcher" -ErrorAction SilentlyContinue');
    console.log('     npm start');
}

main().catch(err => {
    console.error('\n❌ エラー:', err.message);
    process.exit(1);
});
