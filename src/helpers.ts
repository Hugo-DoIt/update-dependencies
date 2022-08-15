import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from "axios";
import hostedGitInfo from "hosted-git-info";
import fs from "fs";
import simpleGit from "simple-git";
import { Dependencies } from "./types";
const git = simpleGit();

const NPM_REGISTRY = "https://registry.npmjs.com";
const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";

const getOctokit = () => {
  const GITHUB_TOKEN = core.getInput("token");
  const octokit = github.getOctokit(GITHUB_TOKEN);
  return octokit;
};

/**
 * Read the dependencies.json from the disk
 * @param {string} path to dependencies.json
 * @returns an object contains the dependencies
 */
export const readDependenciesInfo = (path: string): Dependencies => {
  return JSON.parse(fs.readFileSync(path, "utf8"));
};

/**
 * Get a file within a package
 * @param {string} packageName the name of the package
 * @param {string} version the version of the package
 * @param {string} path the path to the file in the package
 * @returns the file as plain text
 */
export const getPackageFile = async (
  packageName: string,
  version: string,
  path: string
) => {
  const response = await axios.get(
    CDN_ENDPOINT + `/${packageName}@${version}/${path}`
  );
  return response.data;
};

/**
 * Get the lastest package version from API
 * @param packageName the name of the package
 * @returns the latest version of the package in a string
 */
export const getLatestPackageVersion = async (packageName: string) => {
  const response = await axios.get(`${API_ENDPOINT}/${packageName}`);
  return response.data.tags.latest;
};

/**
 * Save plain text to disk
 * @param {string} path the path to the destination
 * @param {string} text plain text to be saved
 */
export const saveFile = (path: string, text: string) => {
  fs.writeFileSync(path, text);
};


/**
 * Download a package file and save to the disk
 * @param {string} name the name of the package
 * @param {string} version the version of the package
 * @param {string} remotePath the remote file path
 * @param {string} localPath the local file path
 */
export const downloadPackageFile = async (
  name: string,
  version: string,
  remotePath: string,
  localPath: string
) => {
  const file = await getPackageFile(name, version, remotePath);
  saveFile(localPath, file);
};

export const remoteBranchExists = async (name: string) => {
  const branches = await git.branch(["-r"]);
  return branches.all.includes("origin/" + name);
};

export const createBranch = async (name: string) => {
  await git.checkoutLocalBranch(name);
};


/**
 * Get the GitHub repo url of the package
 * @param packageName
 * @returns
 */
export const getPackageGitHubRepo = async (packageName: string) => {
  const response = await axios.get(`${NPM_REGISTRY}/${packageName}`);
  const url = response.data.repository?.url;
  if (typeof url !== "string") return null;

  const info = hostedGitInfo.fromUrl(url);
  if (info === undefined || info === null) return null;
  if (info.type !== "github") return null;
  return `${info.domain}/${info.user}/${info.project}`;
};

/**
 * Create a pull request and set labels and assignees
 * @param head
 * @param base
 * @param title
 * @param body
 */
export const createPR = async (
  head: string,
  base: string,
  title: string,
  body: string
) => {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo
  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    head,
    base,
    title,
    body,
  });
  const prNumber = response.data.number;
  // Add labels
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: prNumber,
    labels: core.getMultilineInput("labels"),
  });
  // Request review
  await octokit.rest.pulls.requestReviewers({
    owner,
    repo,
    pull_number: prNumber,
    reviewers: core.getMultilineInput("reviewers"),
  });
};

export const closePR = async () => {
  const octokit = getOctokit()
  const { owner, repo } = github.context.repo

  // TODO
  // await octokit.rest.pulls.list({
  //   owner,
  //   repo,
  //   state: 'open',

  // })
}