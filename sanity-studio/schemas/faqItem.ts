import { defineField, defineType } from "sanity";

export default defineType({
  name: "faqItem",
  title: "FAQ",
  type: "document",
  fields: [
    defineField({
      name: "question",
      title: "Pytanie",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "shortAnswer",
      title: "Krótka odpowiedź",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "fullAnswer",
      title: "Pełna odpowiedź",
      type: "text",
      rows: 5,
    }),
    defineField({
      name: "category",
      title: "Kategoria",
      type: "string",
    }),
    defineField({
      name: "priority",
      title: "Priorytet",
      type: "string",
      options: {
        list: [
          { title: "Wysoki", value: "Wysoki" },
          { title: "Średni", value: "Średni" },
          { title: "Niski", value: "Niski" },
        ],
      },
    }),
    defineField({
      name: "tags",
      title: "Tagi",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "section",
      title: "Sekcja docelowa",
      type: "string",
      options: {
        list: [
          { title: "Landing page", value: "Landing page" },
          { title: "FAQ / Pomoc", value: "FAQ / Pomoc" },
          { title: "SEO / Blog / Pomoc", value: "SEO / Blog / Pomoc" },
        ],
      },
    }),
    defineField({
      name: "order",
      title: "Kolejność wyświetlania",
      type: "number",
    }),
  ],
  preview: {
    select: { title: "question", subtitle: "category" },
  },
});
