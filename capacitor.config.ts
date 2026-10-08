import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.deloci.app',
  appName: 'Déloci',
  webDir: 'out',
  server: {
    url: 'https://deloci.online',
    cleartext: true
  }
};

export default config;