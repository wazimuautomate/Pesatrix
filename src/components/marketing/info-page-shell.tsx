import { HomepageFooter, HomepageHeader } from "@/components/marketing/homepage-chrome";

export interface InfoSection {
  title: string;
  body: string[];
}

interface InfoPageShellProps {
  title: string;
  eyebrow: string;
  intro: string;
  updated: string;
  sections: InfoSection[];
}

export function InfoPageShell({
  title,
  eyebrow,
  intro,
  updated,
  sections,
}: InfoPageShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-navy selection:bg-teal-container selection:text-navy">
      <HomepageHeader />
      <main>
        <section className="px-5 pb-14 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase text-secondary">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-[1.02] tracking-normal text-navy sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-on-surface-variant sm:text-xl">
              {intro}
            </p>
            <p className="mt-6 text-sm font-bold text-on-surface-variant">
              Last updated: {updated}
            </p>
          </div>
        </section>

        <section className="border-t border-outline-variant/20 bg-surface-container-lowest px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl">
            {sections.map((section) => (
              <section
                key={section.title}
                className="border-t border-outline-variant/30 py-10 first:border-t-0 first:pt-0 last:pb-0"
              >
                <h2 className="font-display text-2xl font-black tracking-normal text-navy">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-base font-medium leading-relaxed text-on-surface-variant"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
      <HomepageFooter />
    </div>
  );
}
