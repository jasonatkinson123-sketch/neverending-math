const [major, minor, patch] = process.versions.node.split(".").map(Number);
const supported = major === 22 && (minor > 22 || (minor === 22 && patch >= 2));

if (!supported) {
  console.error(
    `Browser tests require Node 22.22.2 or newer within the Node 22 release line; received ${process.version}. ` +
    "Playwright 1.51.1 stalls during test discovery under Node 24.",
  );
  process.exit(1);
}

console.log(`Browser-test runtime verified: ${process.version}`);
