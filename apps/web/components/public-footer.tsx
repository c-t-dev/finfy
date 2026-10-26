import { getTranslations } from "next-intl/server";

export async function PublicFooter() {
  const t = await getTranslations("public.home");
  return (
    <footer className="border-t border-border/60 py-6 text-center text-[12px] text-muted-foreground">
      {t("footer", { year: new Date().getFullYear() })}
    </footer>
  );
}
