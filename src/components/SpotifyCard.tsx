// src/components/SpotifyCard/SpotifyCard.tsx
import { useEffect, useState } from "react";
import { useQrGenerator } from "../hooks/useQrGenerator";
import type { LanguageCode } from "../hooks/useLanguage";
import { translations } from "../locales/translations";

type SpotifyCardProps = {
  trackID: number;
  trackUrl: string;
  language: LanguageCode;
};

export default function SpotifyCard({ trackUrl, language }: SpotifyCardProps) {
  const { generateQr } = useQrGenerator();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const i18n = translations[language] || translations.en;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qr = await generateQr(trackUrl);
      if (!cancelled) setQrDataUrl(qr);
    })();
    return () => {
      cancelled = true;
    };
  }, [trackUrl, generateQr]);

  return (
    <div className="spotify-card flex flex-col items-center justify-center text-center p-4">

      {qrDataUrl ? (
        <img src={qrDataUrl} alt="Spotify Track QR Code" className="w-48 h-48" />
      ) : (
        <p className="text-gray-500">{i18n.ui.loadingQr}</p>
      )}

      <a
        href={trackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 text-green-500 underline"
      >
        {i18n.ui.openInSpotify}
      </a>
    </div>
  );
}
