import Image from "next/image";

export interface FounderCardProps {
  name: string;
  photoUrl: string;
  statement: string;
  contactEmail: string;
}

export function FounderCard({ name, photoUrl, statement, contactEmail }: FounderCardProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full">
        <Image
          src={photoUrl}
          alt={name}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className="space-y-2">
        <p className="text-h3 text-text-strong">{name}</p>
        <p className="text-small text-text">{statement}</p>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
        >
          {contactEmail}
        </a>
      </div>
    </div>
  );
}
