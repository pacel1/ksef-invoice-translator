"use client";

import * as React from "react";
import { motion, useAnimation, useInView, useReducedMotion, type Variants } from "framer-motion";
import { Quote, Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface Testimonial {
  id: number | string;
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  avatar?: string;
}

export interface AnimatedTestimonialsProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  testimonials?: ReadonlyArray<Testimonial>;
  autoRotateInterval?: number;
  trustedCompanies?: ReadonlyArray<string>;
  trustedCompaniesTitle?: string;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export function AnimatedTestimonials({
  title = "Co mówią pierwsi użytkownicy",
  subtitle = "Tłumacz KSeF jest w wersji beta — poniższe opinie pochodzą od pierwszych firm korzystających z narzędzia.",
  badgeText = "Beta — pierwsze opinie",
  testimonials = [],
  autoRotateInterval = 6000,
  trustedCompanies = [],
  trustedCompaniesTitle,
  className
}: AnimatedTestimonialsProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const prefersReducedMotion = useReducedMotion();

  const sectionRef = React.useRef<HTMLElement | null>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const controls = useAnimation();

  React.useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  React.useEffect(() => {
    if (autoRotateInterval <= 0 || testimonials.length <= 1 || prefersReducedMotion) {
      return;
    }
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, autoRotateInterval);
    return () => clearInterval(interval);
  }, [autoRotateInterval, testimonials.length, prefersReducedMotion]);

  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className={cn("overflow-hidden bg-surface-muted py-24", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={controls}
          variants={containerVariants}
          className="grid w-full grid-cols-1 gap-16 md:grid-cols-2 lg:gap-24"
        >
          {/* Left: heading + nav dots */}
          <motion.div variants={itemVariants} className="flex flex-col justify-center">
            <div className="space-y-6">
              {badgeText ? (
                <div className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                  <Star className="mr-1.5 h-3.5 w-3.5 fill-accent" />
                  <span>{badgeText}</span>
                </div>
              ) : null}

              <h2 className="text-3xl font-bold tracking-tight text-text-strong sm:text-4xl md:text-5xl">
                {title}
              </h2>

              <p className="max-w-[600px] text-text-muted md:text-lg md:leading-relaxed">
                {subtitle}
              </p>

              <div className="flex items-center gap-3 pt-4" role="tablist" aria-label="Testimonials">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={activeIndex === index}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-300 cursor-pointer",
                      activeIndex === index ? "w-10 bg-accent" : "w-2.5 bg-border-strong hover:bg-text-muted"
                    )}
                    aria-label={`Pokaż opinię ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: testimonial cards */}
          <motion.div
            variants={itemVariants}
            className="relative mr-10 h-full min-h-[320px] md:min-h-[400px]"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                className="absolute inset-0"
                initial={{ opacity: 0, x: 100 }}
                animate={{
                  opacity: activeIndex === index ? 1 : 0,
                  x: activeIndex === index ? 0 : 100,
                  scale: activeIndex === index ? 1 : 0.95
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ zIndex: activeIndex === index ? 10 : 0 }}
                aria-hidden={activeIndex !== index}
              >
                <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-8 shadow-md">
                  <div className="mb-6 flex gap-1.5">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  <div className="relative mb-6 flex-1">
                    <Quote className="absolute -left-2 -top-2 h-8 w-8 rotate-180 text-accent/20" aria-hidden="true" />
                    <p className="relative z-10 text-lg font-medium leading-relaxed text-text-strong">
                      „{testimonial.content}”
                    </p>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-border">
                      {testimonial.avatar ? (
                        <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                      ) : null}
                      <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-text-strong">{testimonial.name}</h3>
                      <p className="text-sm text-text-muted">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Decorative blocks */}
            <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-xl bg-accent-soft" aria-hidden="true" />
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-xl bg-warning-soft" aria-hidden="true" />
          </motion.div>
        </motion.div>

        {/* Optional logo cloud */}
        {trustedCompanies.length > 0 ? (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate={controls}
            className="mt-20 text-center"
          >
            {trustedCompaniesTitle ? (
              <h3 className="mb-8 text-sm font-medium text-text-muted">{trustedCompaniesTitle}</h3>
            ) : null}
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-6">
              {trustedCompanies.map((company) => (
                <div
                  key={company}
                  className="text-xl font-semibold text-text-muted/70 md:text-2xl"
                >
                  {company}
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}

export default AnimatedTestimonials;
