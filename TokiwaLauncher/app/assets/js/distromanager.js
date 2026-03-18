const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

// TODO: Host your distribution.json and set the URL here
// Example: 'https://your-github-username.github.io/TokiwaLauncher/distribution.json'
exports.REMOTE_DISTRO_URL = 'https://NvdaAnsel.github.io/TokiwaLauncher/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

exports.DistroAPI = api