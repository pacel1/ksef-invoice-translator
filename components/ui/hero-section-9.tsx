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

const floatingVariants: Variants = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  }
};

export function HeroSection({
  title,
  subtitle,
  note,
  actions,
  stats,
  images,
  translationLabel,
  className
}: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const floatAnim = prefersReducedMotion ? undefined : "animate";

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
          initial="hidden"
          animate="visible"
        >
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
            className="mt-10 flex flex-wrap items-start justify-center gap-x-8 gap-y-6 lg:justify-start"
            variants={itemVariants}
          >
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  {stat.icon}
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold leading-tight text-text-strong">{stat.value}</p>
                  <p className="text-xs text-text-muted">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right column — before/after translation visual */}
        <motion.div
          className="relative mx-auto h-[440px] w-full max-w-[520px] sm:h-[480px]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Soft decorative shapes (project palette) */}
          <motion.div
            className="absolute -top-3 left-[8%] h-14 w-14 rounded-full bg-accent-soft"
            variants={floatingVariants}
            animate={floatAnim}
          />
          <motion.div
            className="absolute -bottom-2 right-[10%] h-10 w-10 rounded-lg bg-warning-soft"
            variants={floatingVariants}
            animate={floatAnim}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          />
          <motion.div
            className="absolute right-2 top-[34%] h-5 w-5 rounded-full bg-accent/20"
            variants={floatingVariants}
            animate={floatAnim}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
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
