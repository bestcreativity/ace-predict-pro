import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.acepredict.app",
  appName: "ACE PREDICT",
  webDir: "dist-mobile",
  backgroundColor: "#17191f",
  android: {
    allowMixedContent: false,
  },
};

export default config;
