const fs = require("fs");
const path = require("path");

const pngHex = "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082";
const pngBuffer = Buffer.from(pngHex, "hex");

["apps/customer-mobile/assets", "apps/operations-mobile/assets"].forEach((dir) => {
  const fullDir = path.resolve(dir);
  fs.mkdirSync(fullDir, { recursive: true });
  ["icon.png", "splash-icon.png", "adaptive-icon.png", "favicon.png"].forEach((name) => {
    fs.writeFileSync(path.join(fullDir, name), pngBuffer);
  });
});

console.log("Generated valid PNG assets for both mobile apps");
