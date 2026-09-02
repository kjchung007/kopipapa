import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage } from "@/lib/content";
import { PublishedPage } from "@/components/PublishedPage";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return {};
  return { title:page.seoTitle || page.title, description:page.seoDescription || undefined };
}

export default async function DynamicWebsitePage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return <PublishedPage page={page}/>;
}
