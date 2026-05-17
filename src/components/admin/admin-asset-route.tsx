import { readFile } from "fs/promises";
import path from "path";
import { cache } from "react";

import { AdminAssetFrame } from "@/components/admin/admin-asset-frame";

type AdminAssetRouteProps = {
  asset: string;
  title: string;
};

const readAdminAssetHtml = cache(async (asset: string) => {
  const assetPath = path.join(
    process.cwd(),
    "stitch_ui_screens",
    "admin_ui_screen",
    asset,
    "code.html"
  );

  return readFile(assetPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  });
});

export async function AdminAssetRoute({
  asset,
  title,
}: AdminAssetRouteProps) {
  const html = await readAdminAssetHtml(asset);

  if (!html) {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-navy">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This admin page is being rebuilt as a native Pesatrix screen.
        </p>
      </div>
    );
  }

  return <AdminAssetFrame html={html} title={title} />;
}
