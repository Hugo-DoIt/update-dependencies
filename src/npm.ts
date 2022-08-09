import axios from "axios";

const API_ENDPOINT = "https://data.jsdelivr.com/v1/package/npm";
const CDN_ENDPOINT = "https://cdn.jsdelivr.net/npm";
const DEPENDENCIES_JSON = "dependencies.json";


/**
 * Get the lastest package version from API
 * @param {string} packageName the name of the package
 * @returns the latest version of the package in a string
 */
export const getLatestPackageVersion = async (packageName: string) => {
  const response = await axios.get(API_ENDPOINT + `/${packageName}`);
  return response.data.tags.latest
};
