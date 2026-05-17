import { readFile } from "fs/promises";
import path from "path";
import { StitchScreenEmbed } from "./stitch-screen-embed";

interface StitchScreenPageProps {
  folder: string;
  title: string;
  stripDashboardChrome?: boolean;
}

function stripEmbeddedChrome(html: string) {
  return html
    .replace(/<nav[^>]*top-0[^>]*>[\s\S]*?<\/nav>/i, "")
    .replace(/<header[^>]*top-0[^>]*>[\s\S]*?<\/header>/i, "")
    .replace(/<nav[^>]*fixed\s+bottom-0[^>]*>[\s\S]*?<\/nav>/i, "");
}

export async function StitchScreenPage({
  folder,
  title,
  stripDashboardChrome = false,
}: StitchScreenPageProps) {
  const filePath = path.join(
    process.cwd(),
    "stitch_ui_screens",
    "user_ui_screen",
    folder,
    "code.html"
  );

  const rawHtml = await readFile(filePath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  });

  if (!rawHtml) {
    return (
      <div className="rounded-xl border border-outline-variant/40 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-navy">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is being rebuilt as a native Pesatrix screen.
        </p>
      </div>
    );
  }

  const html = stripDashboardChrome ? stripEmbeddedChrome(rawHtml) : rawHtml;

  return <StitchScreenEmbed html={html} title={title} />;
}
