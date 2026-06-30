import os from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Prefer real LAN IPs; skip link-local 169.254.x.x (unreachable from phones). */
function getLanIp(): string | undefined {
  const candidates: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue;
      candidates.push(addr.address);
    }
  }
  return (
    candidates.find((ip) => ip.startsWith('192.168.')) ??
    candidates.find((ip) => ip.startsWith('10.')) ??
    candidates[0]
  );
}

function printPhoneUrl(port: number) {
  return {
    name: 'print-phone-url',
    configureServer(server: { httpServer?: { once(event: string, cb: () => void): void } }) {
      server.httpServer?.once('listening', () => {
        const ip = getLanIp();
        if (ip) {
          console.log(`\n  ➜  Phone:   http://${ip}:${port}/\n`);
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), printPhoneUrl(5173)],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
