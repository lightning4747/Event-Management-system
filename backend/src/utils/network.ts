import os from 'os';

export function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  const physicalMatches: string[] = [];
  const fallbackMatches: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (name.startsWith('docker') || name.startsWith('br-') || name.startsWith('veth')) {
          fallbackMatches.push(iface.address);
        } else {
          physicalMatches.push(iface.address);
        }
      }
    }
  }

  return physicalMatches[0] || fallbackMatches[0] || '127.0.0.1';
}
