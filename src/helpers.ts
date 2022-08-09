import axios from "axios";
import hostedGitInfo from "hosted-git-info";

const NPM_REGISTRY = "https://registry.npmjs.com";
const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";


/**
 * Get the lastest package version from API
 * @param packageName the name of the package
 * @returns the latest version of the package in a string
 */
export const getLatestPackageVersion = async (packageName: string) => {
  const response = await axios.get(`${API_ENDPOINT}/${packageName}`);
  return response.data.tags.latest
};

/**
 * Get the GitHub repo url of the package
 * @param packageName 
 * @returns 
 */
export const getPackageGitHubRepo = async (packageName: string) => {
  const response = await axios.get(`${NPM_REGISTRY}/${packageName}`)
  const url = response.data.repository.url
  if (typeof url !== 'string') return null

  const info = hostedGitInfo.fromUrl(url)
  if (info === undefined || info === null) return null
  if (info.type !== 'github') return null
  return `${info.domain}/${info.user}/${info.project}`
}