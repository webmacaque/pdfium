import { Octokit } from "@octokit/rest";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import axios from "axios";
import { createGunzip } from "zlib";
import { extract } from "tar";
import { pipeline as _pipeline } from "stream";
import { promisify } from "util";

const pipeline = promisify(_pipeline);

// eslint-disable-next-line no-undef
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

async function checkForUpdates() {
  // Get latest release
  const { data: lastRelease } = await octokit.repos.getLatestRelease({
    owner: "paulocoutinhox",
    repo: "pdfium-lib",
  });
  const lastReleaseTag = lastRelease.tag_name;

  console.info(`Got latest release: "${lastReleaseTag}"`);

  const lastCheckedReleaseFile = await fs.readFile(
    "src/vendor/LAST_RELEASE.txt",
    "utf-8"
  );
  const lastCheckedReleaseTag = lastCheckedReleaseFile.trim();
  console.log(`Last checked release: "${lastCheckedReleaseTag}"`);

  if (lastReleaseTag === lastCheckedReleaseTag) {
    console.log("No new release found", lastReleaseTag, lastCheckedReleaseTag);
    return;
  }

  try {
    // Download wasm asset
    const wasmAssetUrl = lastRelease.assets.find(
      (asset) => asset.name === "wasm.tgz"
    ).browser_download_url;
    console.log(`Downloading wasm asset: ${wasmAssetUrl}`);

    const response = await axios({
      url: wasmAssetUrl,
      method: "GET",
      responseType: "stream",
    });
    console.log(`Downloaded wasm asset: ${response.status}`);

    // Unzip archive
    await pipeline(
      response.data,
      createGunzip(),
      extract({ cwd: "src/vendor" })
    );
    console.log("Unzipped wasm asset to src/vendor folder");

    // Copy files
    await fs.copyFile(
      "src/vendor/release/node/pdfium.js",
      "src/vendor/pdfium.js"
    );
    await fs.copyFile(
      "src/vendor/release/node/pdfium.wasm",
      "src/vendor/pdfium.wasm"
    );
    console.log("Copied files to src/vendor folder");

    execSync(`npx prettier --write src/vendor`);
    console.log("Formatted files");

    await fs.writeFile("LAST_RELEASE", lastReleaseTag);

    execSync(
      `git config --global user.email "github-actions[bot]@users.noreply.github.com" && git config --global user.name "github-actions[bot]"`
    );
    execSync(
      `git remote set-url --push origin https://hyzyla:${GITHUB_TOKEN}@github.com/hyzyla/pdfium`
    );
    execSync(`git add . && git commit -m "Update to ${lastReleaseTag}"`);
    execSync(
      `git push origin "refs/heads/main:refs/heads/update-to-${lastReleaseTag}"`
    );
    console.log("Created commit and pushed to GitHub");

    await octokit.pulls.create({
      owner: "hyzyla",
      repo: "pdfium",
      title: `Update to ${lastReleaseTag}`,
      head: `update-to-${lastReleaseTag}`,
      base: "main",
    });
    console.log("Created pull request");
  } finally {
    // Remove archive folder
    await fs.rm("src/vendor/release", {
      recursive: true,
      force: true,
    });
  }
}

checkForUpdates();
