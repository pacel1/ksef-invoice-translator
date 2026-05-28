export const ALL_POSTS_QUERY = `*[_type == "post"] | order(publishedAt desc) {
  _id,
  title,
  slug,
  publishedAt,
  excerpt,
  metaTitle,
  metaDescription
}`;

export const POST_BY_SLUG_QUERY = `*[_type == "post" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  publishedAt,
  excerpt,
  body,
  metaTitle,
  metaDescription
}`;

export const ALL_SLUGS_QUERY = `*[_type == "post"] { "slug": slug.current }`;

export const ALL_FAQ_ITEMS_QUERY = `*[_type == "faqItem"] | order(order asc) {
  _id,
  question,
  shortAnswer,
  fullAnswer,
  category,
  priority,
  tags,
  section,
  order
}`;
