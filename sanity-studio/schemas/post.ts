import { defineField, defineType } from "sanity";

export default defineType({
  name: "post",
  title: "Artykuł",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Tytuł",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug (URL)",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Data publikacji",
      type: "datetime",
    }),
    defineField({
      name: "excerpt",
      title: "Opis skrócony",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "body",
      title: "Treść",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "metaTitle",
      title: "Meta title (SEO)",
      type: "string",
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description (SEO)",
      type: "text",
      rows: 2,
    }),
  ],
  orderings: [
    {
      name: "publishedAtDesc",
      title: "Data publikacji (najnowsze)",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "publishedAt" },
  },
});
