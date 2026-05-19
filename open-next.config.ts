// Configuration for @opennextjs/cloudflare
// Used by Cloudflare Pages build environment
const config = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
    },
  },
};

export default config;
