import * as core from "@actions/core";
import * as github from "@actions/github";
import axios from "axios";
import hostedGitInfo from "hosted-git-info";


const NPM_REGISTRY = "https://registry.npmjs.com";
const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";

const getOctokit = () => {
  const GITHUB_TOKEN = core.getInput("token");
  const octokit = github.getOctokit(GITHUB_TOKEN);
  return octokit  
}

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
  const octokit = getOctokit()
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
