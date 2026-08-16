import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.acepredict.app",
  appName: "ACE PREDICT",
  webDir: "dist-mobile",
  backgroundColor: "#17191f",
  server: {
    url: "https://theacepredict.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
