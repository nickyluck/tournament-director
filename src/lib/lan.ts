import os from "os";

export type LanInfo = {
  port: number;
  localUrl: string;
  lanUrls: string[];
};

function isPrivateIpv4(ip: string): boolean {
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1] ?? 0);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function getLanInfo(port = Number(process.env.PORT) || 43123): LanInfo {
  const interfaces = os.networkInterfaces();
  const lanUrls: string[] = [];

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (isPrivateIpv4(entry.address)) {
        lanUrls.push(`http://${entry.address}:${port}`);
      }
    }
  }

  return {
    port,
    localUrl: `http://127.0.0.1:${port}`,
    lanUrls: [...new Set(lanUrls)],
  };
}
