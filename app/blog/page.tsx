import { BlogListingPage } from "@/components/marketing/blog-listing-page";

export const revalidate = 3600;

export default function Blog() {
  return <BlogListingPage locale="pl" />;
}
