"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const core = require('@actions/core')
// const github = require('@actions/github')
const simple_git_1 = __importDefault(require("simple-git"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const git = (0, simple_git_1.default)();
const API_ENDPOINT = 'https://data.jsdelivr.com/v1/package/npm';
const CDN_ENDPOINT = 'https://cdn.jsdelivr.net/npm';
const DEPENDENCIES_JSON = 'dependencies.json';
/**
 * Get the lastest package version from API
 * @param {string} packageName the name of the package
 * @returns the latest version of the package in a string
 */
const getLatestPackageVersion = async (packageName) => {
    const response = await (0, node_fetch_1.default)(API_ENDPOINT + `/${packageName}`);
    const json = await response.json();
    return json.tags.latest;
};
/**
 * Get a file within a package
 * @param {string} packageName the name of the package
 * @param {string} version the version of the package
 * @param {string} path the path to the file in the package
 * @returns the file as plain text
 */
const getPackageFile = async (packageName, version, path) => {
    const response = await (0, node_fetch_1.default)(CDN_ENDPOINT + `/${packageName}@${version}/${path}`);
    return response.text();
};
/**
 * Save plain text to disk
 * @param {string} path the path to the destination
 * @param {string} text plain text to be saved
 */
const saveFile = (path, text) => {
    fs_1.default.writeFileSync(path, text);
};
/**
 * Download a package file and save to the disk
 * @param {string} name the name of the package
 * @param {string} version the version of the package
 * @param {string} remotePath the remote file path
 * @param {string} localPath the local file path
 */
const downloadPackageFile = async (name, version, remotePath, localPath) => {
    const file = await getPackageFile(name, version, remotePath);
    saveFile(localPath, file);
};
/**
 * Read the dependencies.json from the disk
 * @param {string} path to dependencies.json
 * @returns an object contains the dependencies
 */
const readDependenciesInfo = (path) => {
    return JSON.parse(fs_1.default.readFileSync(path, 'utf8'));
};
const remoteBranchExists = async (name) => {
    const branches = await git.branch(['-r']);
    return branches.all.includes('origin/' + name);
};
const createBranch = async (name) => {
    await git.checkoutLocalBranch(name);
};
// load dependencies.json
const deps = readDependenciesInfo(DEPENDENCIES_JSON);
// configure local bask path
const LOCAL_BASE_PATH = deps.localBasePath;
for (let i = 0; i < deps.dependencies.length; i++) {
    const dependency = deps.dependencies[i];
    const packageName = dependency.name;
    const version = dependency.version;
    const files = dependency.files;
    const latestVersion = await getLatestPackageVersion(packageName);
    if (latestVersion === version)
        continue;
    const branchName = `update-dependencies/${packageName}-${version}`;
    if (await remoteBranchExists(branchName))
        continue;
    const fileList = [DEPENDENCIES_JSON];
    createBranch(branchName);
    for (const file of files) {
        const localPath = path_1.default.join(LOCAL_BASE_PATH, file.local);
        await downloadPackageFile(packageName, latestVersion, file.remote, localPath);
        fileList.push(localPath);
    }
    const updatedDependencies = readDependenciesInfo(DEPENDENCIES_JSON);
    updatedDependencies.dependencies[i] = dependency;
    saveFile('dependencies.json', JSON.stringify(deps, null, 4));
    git.add(fileList);
    git.commit(`chore(deps): bump ${packageName} from ${version} to ${latestVersion}`);
    git.push('origin', branchName, ['--set-upstream']);
}
// const updatedDependencies = await Promise.all(deps.dependencies.map(async dependency => {
//   const packageName = dependency.name
//   const version = dependency.version
//   const files = dependency.files
//   const latestVersion = await getLatestPackageVersion(packageName)
//   if (latestVersion === version) return dependency
//   files.forEach(async file => {
//     await downloadPackageFile(packageName, latestVersion, file.remote, path.join(LOCAL_BASE_PATH, file.local))
//   })
//   dependency.version = latestVersion
//   return dependency
// }))
// save the updated dependencies to disk
// deps.dependencies = updatedDependencies
// saveFile('./dependencies.json', JSON.stringify(deps, null, 4))
// `who-to-greet` input defined in action metadata file
// const nameToGreet = core.getInput('who-to-greet')
// console.log(`Hello ${nameToGreet}!`)
// const time = (new Date).toTimeString();
// core.setOutput('time', time);
// Get the JSON webhook payload for the event that triggered the workflow
// const payload = JSON.stringify(github.context.payload, undefined, 2)
// console.log(`The event payload: ${payload}`)
// const branchName = core.getInput('branch-name')