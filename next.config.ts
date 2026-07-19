import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * This project lives on /mnt/e, a Windows drive mounted into WSL2, where inotify
   * events don't fire. Without polling, Next never sees file edits: pages serve stale
   * output and newly created routes 404 until the server is restarted.
   */
  watchOptions: {
    pollIntervalMs: 1000,
  },
};

export default nextConfig;
