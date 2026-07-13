import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="page placeholder-page">
      <div className="placeholder-icon">
        <Construction size={30} />
      </div>

      <p className="eyebrow">
        Frontend integration
      </p>

      <h1>{title}</h1>

      <p>{description}</p>
    </div>
  );
}
