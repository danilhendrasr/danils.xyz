import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import pagefind from "astro-pagefind";
import type { AstroIntegration } from "astro";
import fs from "fs";
import parseFrontmatter from "gray-matter";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { format, parse } from "date-fns";

const render = (title: string, subtitle: string, date: string) => ({
  type: "div",
  props: {
    style: {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#f5f5f5",
      padding: "55px 70px",
      color: "#000",
      fontFamily: "Geist Sans",
      fontSize: 72,
      justifyContent: "center",
    },
    children: [
      {
        type: "span",
        props: {
          style: {
            fontSize: "2rem",
            fontWeight: 600,
            position: "absolute",
            top: 60,
            left: 70,
            opacity: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 10,
          },
          children: [
            {
              type: "img",
              props: {
                src: "https://dhsrlab.com/self-portrait.png",
                width: 50,
                height: 50,
                style: {
                  borderRadius: "50%",
                  objectFit: "cover",
                },
              },
            },
            {
              type: "span",
              props: {
                children: "dhsrlab",
              },
            },
          ],
        },
      },
      {
        type: "div",
        props: {
          style: {
            fontWeight: 800,
          },
          children: title,
        },
      },
      {
        type: "div",
        props: {
          style: {
            fontSize: "2rem",
            opacity: 0.75,
          },
          children: subtitle,
        },
      },
      {
        type: "span",
        props: {
          style: {
            fontSize: "1.5rem",
            marginTop: 20,
            opacity: 0.5,
          },
          children: date,
        },
      },
    ],
  },
});

const og = (): AstroIntegration => ({
  name: "satori-og",
  hooks: {
    "astro:build:done": async ({ dir, pages }) => {
      try {
        for (const { pathname } of pages) {
          if (!pathname.startsWith("blog/") || pathname === "blog/") continue;

          const file = fs.readFileSync(`src/content/${pathname}/index.mdx`);
          // const file = fs.readFileSync("src/content/" + path + ".mdx");
          const { title, description, date } = parseFrontmatter(file).data;
          const formattedDate = format(
            parse(date, "yyyy-MM-dd", new Date()),
            "MMMM dd, yyyy",
          );

          const svg = await satori(render(title, description, formattedDate), {
            width: 1200,
            height: 630,
            fonts: [
              {
                name: "Geist Sans",
                data: fs.readFileSync("public/geist-sans-latin-400-normal.ttf"),
                weight: 400,
                style: "normal",
              },
              {
                name: "Geist Sans",
                data: fs.readFileSync("public/geist-sans-latin-600-normal.ttf"),
                weight: 600,
                style: "normal",
              },
            ],
          });

          const resvg = new Resvg(svg, {
            fitTo: {
              mode: "width",
              value: 1200,
            },
          });
          fs.writeFileSync(
            `${dir.pathname}${pathname}og.png`,
            resvg.render().asPng(),
          );
        }

        console.log(`\x1b[32mog:\x1b[0m Generated OpenGraph images\n`);
      } catch (e) {
        console.error(e);
        console.log(`\x1b[31mog:\x1b[0m OpenGraph image generation failed\n`);
      }
    },
  },
});

// https://astro.build/config
export default defineConfig({
  site: "https://dhsrlab.com",
  integrations: [tailwind(), sitemap(), mdx(), pagefind(), og()],
  markdown: {
    shikiConfig: {
      theme: "css-variables",
    },
  },
});
