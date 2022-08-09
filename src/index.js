// const core = require('@actions/core')
// const github = require('@actions/github')
import simpleGit from "simple-git";
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
const git = simpleGit();
const API_ENDPOINT = 'https://data.jsdelivr.com/v1/package/npm';
const CDN_ENDPOINT = 'https://cdn.jsdelivr.net/npm';
const DEPENDENCIES_JSON = 'dependencies.json';
console.log(`API_ENDPOINT: ${API_ENDPOINT}`);
console.log(`CDN_ENDPOINT: ${CDN_ENDPOINT}`);
console.log(`dependencies.json: ${DEPENDENCIES_JSON}`);
/**
 * Get the lastest package version from API
 * @param {string} packageName the name of the package
 * @returns the latest version of the package in a string
 */
const getLatestPackageVersion = async (packageName) => {
    const response = await fetch(API_ENDPOINT + `/${packageName}`);
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
    const response = await fetch(CDN_ENDPOINT + `/${packageName}@${version}/${path}`);
    return response.text();
};
/**
 * Save plain text to disk
 * @param {string} path the path to the destination
 * @param {string} text plain text to be saved
 */
const saveFile = (path, text) => {
    fs.writeFileSync(path, text);
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
    return JSON.parse(fs.readFileSync(path, 'utf8'));
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
console.log(`dependencies.json loaded`);
// configure local bask path
const LOCAL_BASE_PATH = deps.localBasePath;
console.log(`LOCAL_BASE_PATH: ${LOCAL_BASE_PATH}`);
for (let i = 0; i < deps.dependencies.length; i++) {
    await git.checkout(['main']);
    const dependency = deps.dependencies[i];
    const packageName = dependency.name;
    const version = dependency.version;
    console.log(`Processing ${packageName} current version ${version}`);
    const latestVersion = await getLatestPackageVersion(packageName);
    console.log(`Processing ${packageName} latest version ${version}`);
    if (latestVersion === version) {
        console.log(`${packageName} is up to date, skipping`);
        continue;
    }
    console.log(`${packageName} - ${version} has a newer version ${latestVersion}`);
    const branchName = `update-dependencies/${packageName}-${latestVersion}`;
    if (await remoteBranchExists(branchName)) {
        console.log(`Remote branch origin/${branchName} exists, skipping`);
        continue;
    }
    await createBranch(branchName);
    console.log(`Branch created ${branchName}`);
    const fileList = [DEPENDENCIES_JSON];
    const files = dependency.files;
    console.log(`Start downloading files`);
    for (const file of files) {
        const localPath = path.join(LOCAL_BASE_PATH, file.local);
        console.log(`Start downloading ${localPath}`);
        await downloadPackageFile(packageName, latestVersion, file.remote, localPath);
        fileList.push(localPath);
        console.log(`Finish downloading ${localPath}`);
    }
    console.log(`All files downloaded`);
    const updatedDependencies = readDependenciesInfo(DEPENDENCIES_JSON);
    updatedDependencies.dependencies[i] = dependency;
    saveFile('dependencies.json', JSON.stringify(deps, null, 4));
    console.log(`dependencies.json saved`);
    await git.add(fileList);
    console.log(`${fileList} have been staged`);
    await git.commit(`chore(deps): bump ${packageName} from ${version} to ${latestVersion}`);
    console.log(`commit is created`);
    await git.push('origin', branchName, ['--set-upstream']);
    console.log(`pushed to the origin`);
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
