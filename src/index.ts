// const core = require('@actions/core')
// const github = require('@actions/github')
import simpleGit from "simple-git";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const git = simpleGit();
const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";
console.log(`API_ENDPOINT: ${API_ENDPOINT}`);
console.log(`CDN_ENDPOINT: ${CDN_ENDPOINT}`);
console.log(`dependencies.json: ${DEPENDENCIES_JSON}`);
type File = {
  remote: string;
  local: string;
};

type Dependency = {
  name: string;
  version: string;
  files: File[];
};

type Dependencies = {
  localBasePath: string;
  dependencies: Dependency[];
};

/**
 * Get the lastest package version from API
 * @param {string} packageName the name of the package
 * @returns the latest version of the package in a string
 */
const getLatestPackageVersion = async (packageName: string) => {
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
const getPackageFile = async (
  packageName: string,
  version: string,
  path: string
) => {
  const response = await fetch(
    CDN_ENDPOINT + `/${packageName}@${version}/${path}`
  );
  return response.text();
};

/**
 * Save plain text to disk
 * @param {string} path the path to the destination
 * @param {string} text plain text to be saved
 */
const saveFile = (path: string, text: string) => {
  fs.writeFileSync(path, text);
};

/**
 * Download a package file and save to the disk
 * @param {string} name the name of the package
 * @param {string} version the version of the package
 * @param {string} remotePath the remote file path
 * @param {string} localPath the local file path
 */
const downloadPackageFile = async (
  name: string,
  version: string,
  remotePath: string,
  localPath: string
) => {
  const file = await getPackageFile(name, version, remotePath);
  saveFile(localPath, file);
};

/**
 * Read the dependencies.json from the disk
 * @param {string} path to dependencies.json
 * @returns an object contains the dependencies
 */
const readDependenciesInfo = (path: string): Dependencies => {
  return JSON.parse(fs.readFileSync(path, "utf8"));
};

const remoteBranchExists = async (name: string) => {
  const branches = await git.branch(["-r"]);
  return branches.all.includes("origin/" + name);
};

const createBranch = async (name: string) => {
  await git.checkoutLocalBranch(name);
};


const main = async () => {
  
  // load dependencies.json
  const deps = readDependenciesInfo(DEPENDENCIES_JSON);
  console.log(`dependencies.json loaded`);
  
  // configure local bask path
  const LOCAL_BASE_PATH = deps.localBasePath;
  console.log(`LOCAL_BASE_PATH: ${LOCAL_BASE_PATH}`);
  
  // refresh git remote branches
  // git remote update origin --prune
  git.remote(["update", "origin", "--prune"]);
  
  for (let i = 0; i < deps.dependencies.length; i++) {
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
  
    console.log(
      `${packageName} - ${version} has a newer version ${latestVersion}`
    );
  
    const branchName = `update-dependencies/${packageName}-${latestVersion}`;
    if (await remoteBranchExists(branchName)) {
      console.log(`Remote branch origin/${branchName} exists, skipping`);
      continue;
    }
  
    await createBranch(branchName);
    console.log(`Branch created ${branchName}`);
    const fileList: string[] = [DEPENDENCIES_JSON];
    const files = dependency.files;
    console.log(`Start downloading files`);
    for (const file of files) {
      const localPath = path.join(LOCAL_BASE_PATH, file.local);
      console.log(`Start downloading ${localPath}`);
      await downloadPackageFile(
        packageName,
        latestVersion,
        file.remote,
        localPath
      );
      fileList.push(localPath);
      console.log(`Finish downloading ${localPath}`);
    }
    console.log(`All files downloaded`);
  
    const updatedDependencies = readDependenciesInfo(DEPENDENCIES_JSON);
    dependency.version = latestVersion;
    updatedDependencies.dependencies[i] = dependency;
    saveFile("dependencies.json", JSON.stringify(updatedDependencies, null, 4));
    console.log(`dependencies.json saved`);
    await git.add(fileList);
    console.log(`${fileList} have been staged`);
    await git.commit(
      `chore(deps): bump ${packageName} from ${version} to ${latestVersion}`
    );
    console.log(`commit is created`);
    await git.push("origin", branchName, ["--set-upstream"]);
    console.log(`pushed to the origin`);
    // git checkout main
    await git.checkout(["main"]);
  }
    
  // `who-to-greet` input defined in action metadata file
  // const nameToGreet = core.getInput('who-to-greet')
  // console.log(`Hello ${nameToGreet}!`)
  // const time = (new Date).toTimeString();
  // core.setOutput('time', time);
  // Get the JSON webhook payload for the event that triggered the workflow
  // const payload = JSON.stringify(github.context.payload, undefined, 2)
  // console.log(`The event payload: ${payload}`)
  // const branchName = core.getInput('branch-name')
}
