import core from "@actions/core";
import github from "@actions/github";
import simpleGit from "simple-git";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const git = simpleGit();
const GITHUB_TOKEN = core.getInput("token");
const octokit = github.getOctokit(GITHUB_TOKEN);

const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";

core.info(`API_ENDPOINT: ${API_ENDPOINT}`);
core.info(`CDN_ENDPOINT: ${CDN_ENDPOINT}`);
core.info(`dependencies.json: ${DEPENDENCIES_JSON}`);

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

const createPR = async (
  head: string,
  base: string,
  title: string,
  body: string
) => {
  const repository = github.context.payload.repository;
  if (repository === undefined) {
    throw new Error("Undefined Repo!");
  }
  const owner = repository.owner.login;
  const repo = repository.name;
  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    head,
    base,
    title,
    body,
  });
  // response.status
};

const main = async () => {
  // load dependencies.json
  const deps = readDependenciesInfo(DEPENDENCIES_JSON);
  core.info(`dependencies.json is loaded`);

  // configure local bask path
  const LOCAL_BASE_PATH = deps.localBasePath;
  core.info(`LOCAL_BASE_PATH: ${LOCAL_BASE_PATH}`);

  // refresh git remote branches
  // git remote update origin --prune
  await git.remote(["update", "origin", "--prune"]);

  for (let i = 0; i < deps.dependencies.length; i++) {
    const dependency = deps.dependencies[i];
    const packageName = dependency.name;
    core.startGroup(`Processing ${packageName}`);
    const version = dependency.version;
    core.info(`${packageName} - current version ${version}`);
    const latestVersion = await getLatestPackageVersion(packageName);
    core.info(`${packageName} - latest version ${version}`);
    if (latestVersion === version) {
      core.info(`${packageName} is up to date, skipping`);
      core.endGroup();
      continue;
    }

    core.info(`${packageName} has a newer version ${latestVersion}`);

    const branchName = `update-dependencies/${packageName}-${latestVersion}`;
    if (await remoteBranchExists(branchName)) {
      core.info(`Remote branch origin/${branchName} exists, skipping`);
      core.endGroup();
      continue;
    }

    await createBranch(branchName);
    core.info(`Branch ${branchName} is created`);
    const fileList: string[] = [DEPENDENCIES_JSON];
    const files = dependency.files;
    core.info(`Start downloading files`);
    for (const file of files) {
      const localPath = path.join(LOCAL_BASE_PATH, file.local);
      core.info(`Start downloading ${localPath}`);
      await downloadPackageFile(
        packageName,
        latestVersion,
        file.remote,
        localPath
      );
      fileList.push(localPath);
      core.info(`Finish downloading ${localPath}`);
    }
    core.info(`All files downloaded`);

    const updatedDependencies = readDependenciesInfo(DEPENDENCIES_JSON);
    dependency.version = latestVersion;
    updatedDependencies.dependencies[i] = dependency;
    saveFile("dependencies.json", JSON.stringify(updatedDependencies, null, 4));
    core.info(`dependencies.json has been saved saved`);
    await git.add(fileList);
    core.info(`${fileList} have been staged`);
    await git.commit(
      `chore(deps): bump ${packageName} from ${version} to ${latestVersion}`
    );
    core.info(`commit is created`);
    await git.push("origin", branchName, ["--set-upstream"]);
    core.info(`pushed to the origin`);
    // git checkout main
    await git.checkout(["main"]);
    // create pr
    await createPR(
      branchName,
      "main",
      `chore(deps): bump ${packageName} from ${version} to ${latestVersion}`,
      "body: TODO"
    );
    core.info('pr is created')
    core.endGroup();
  }
};

try {
  main();
} catch (err: any) {
  core.setFailed(err);
}
