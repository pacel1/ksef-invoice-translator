"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatProps {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface ActionProps {
  text: string;
  href?: string;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
  className?: string;
}

interface HeroImage {
  src: string;
  alt: string;
}

interface HeroSectionProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** Small uppercase pill shown above the H1 (e.g. a compliance cue). */
  eyebrow?: React.ReactNode;
  note?: React.ReactNode;
  actions: ActionProps[];
  stats: StatProps[];
  /**
   * Two side-by-side cards rendered in the right column (before/after style).
   * The first image is the source, the second is the translation result.
   */
  images: [HeroImage, HeroImage];
  /** Optional badge label shown on the translation arrow. */
  translationLabel?: string;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const imageVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

export function HeroSection({
  title,
  subtitle,
  eyebrow,
  note,
  actions,
  stats,
  images,
  translationLabel,
  className
}: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const initial = prefersReducedMotion ? false : "hidden";

  const ActionButton = ({ action }: { action: ActionProps }) => {
    if (action.href) {
      return (
        <Button asChild variant={action.variant} size="lg" className={action.className}>
          <a href={action.href}>{action.text}</a>
        </Button>
      );
    }
    return (
      <Button onClick={action.onClick} variant={action.variant} size="lg" className={action.className}>
        {action.text}
      </Button>
    );
  };

  return (
    <section className={cn("w-full overflow-hidden bg-surface py-12 sm:py-20 lg:py-24", className)}>
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-5 md:px-8 lg:grid-cols-2 lg:gap-12">
        {/* Left column — copy */}
        <motion.div
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
          variants={containerVariants}
          initial={initial}
          animate="visible"
        >
          {eyebrow ? (
            <motion.span
              className="mb-4 inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-micro font-semibold uppercase tracking-wide text-accent"
              variants={itemVariants}
            >
              {eyebrow}
            </motion.span>
          ) : null}

          <motion.h1
            className="text-4xl font-bold tracking-tight text-text-strong sm:text-5xl lg:text-6xl"
            variants={itemVariants}
          >
            {title}
          </motion.h1>

          <motion.p
            className="mt-5 max-w-xl text-base text-text-muted sm:text-lg"
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            variants={itemVariants}
          >
            {actions.map((action, i) => (
              <ActionButton key={i} action={action} />
            ))}
          </motion.div>

          {note ? (
            <motion.p
              className="mt-4 text-sm text-text-muted"
              variants={itemVariants}
            >
              {note}
            </motion.p>
          ) : null}

          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 lg:justify-start"
            variants={itemVariants}
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2",
                  i > 0 && "sm:border-l sm:border-border sm:pl-5"
                )}
              >
                <span className="text-accent [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
                  {stat.icon}
                </span>
                <span className="text-small font-semibold tabular-nums text-text-strong">
                  {stat.value}
                </span>
                <span className="text-small text-text-muted">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right column — before/after translation visual */}
        <motion.div
          className="relative mx-auto h-[440px] w-full max-w-[520px] sm:h-[480px]"
          variants={containerVariants}
          initial={initial}
          animate="visible"
        >
          {/* Static, subtle wash behind the document pair (no animation). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_42%,hsl(var(--accent-soft)),transparent_70%)]"
          />

          {/* Source card — top-left */}
          <motion.div
            className="absolute left-0 top-0 w-[44%] overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-lg"
            style={{ transformOrigin: "bottom right" }}
            variants={imageVariants}
          >
            <Image
              src={images[0].src}
              alt={images[0].alt}
              width={320}
              height={400}
              priority
              className="block h-auto w-full rounded-xl"
            />
          </motion.div>

          {/* Translation arrow — sits in the gap between cards */}
          <motion.div
            className="absolute left-1/2 top-[46%] z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-surface text-accent shadow-md sm:h-14 sm:w-14"
            variants={imageVariants}
            aria-hidden="true"
          >
            <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </motion.div>
          {translationLabel ? (
            <motion.div
              className="absolute left-1/2 top-[46%] z-10 mt-9 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm sm:mt-10"
              variants={imageVariants}
            >
              {translationLabel}
            </motion.div>
          ) : null}

          {/* Result card — bottom-right */}
          <motion.div
            className="absolute bottom-0 right-0 w-[44%] overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-lg"
            style={{ transformOrigin: "top left" }}
            variants={imageVariants}
          >
            <Image
              src={images[1].src}
              alt={images[1].alt}
              width={320}
              height={400}
              className="block h-auto w-full rounded-xl"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default HeroSection;
