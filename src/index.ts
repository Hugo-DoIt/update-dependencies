import * as core from "@actions/core";
import path from "path";
import {
  createBranch,
  createPR,
  downloadPackageFile,
  getLatestPackageVersion,
  readDependenciesInfo,
  remoteBranchExists,
  saveFile,
} from "./helpers";
import simpleGit from "simple-git";
const git = simpleGit();

const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";

core.info(`API_ENDPOINT: ${API_ENDPOINT}`);
core.info(`CDN_ENDPOINT: ${CDN_ENDPOINT}`);
core.info(`dependencies.json: ${DEPENDENCIES_JSON}`);

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

  // configure git user.name and user.email
  await git.addConfig("user.email", "noreply@github.com");
  await git.addConfig("user.name", "GitHub");
  for (let i = 0; i < deps.dependencies.length; i++) {
    const dependency = deps.dependencies[i];
    const packageName = dependency.name;
    core.startGroup(`Processing ${packageName}`);
    const version = dependency.version;
    core.info(`${packageName} - current version ${version}`);
    const latestVersion = await getLatestPackageVersion(packageName);
    core.info(`${packageName} - latest version ${latestVersion}`);
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
      `Bumps [${packageName}](https://npmjs.com/package/${packageName}) from ${version} to ${latestVersion}.`
    );
    core.info("pr is created");
    core.endGroup();
  }
};

try {
  main();
} catch (err: any) {
  core.setFailed(err);
}
