// src/components/SpotifyCard/SpotifyCard.tsx
import { useEffect, useState } from "react";
import { useQrGenerator } from "../hooks/useQrGenerator";
import type { LanguageCode } from "../hooks/useLanguage";
import { translations } from "../locales/translations";
import "../index-ifi-skitur.css";
import Button from "./Button";

type SpotifyCardProps = {
  trackID: number;
  trackUrl: string;
  language: LanguageCode;
  selectedPlayer?: string | null;
};

export default function SpotifyCard({ trackUrl, language, selectedPlayer }: SpotifyCardProps) {
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
    <div className="card-container"> 
        {selectedPlayer && <p className="selected-player">{selectedPlayer}, {i18n.ui.spotifyRules}</p>}
        <Button
            label="Click to play song"
            color="accent"
            onClick={() => window.open(trackUrl, "_blank")}
            size="large"
            disabled={false}
        />

        {/* <div className="qr-code">
        {/* {qrDataUrl ? (
            <img src={qrDataUrl} alt="Spotify Track QR Code" className="w-48 h-48" />
        ) : (
            <p> {i18n.ui.loadingQr} </p>
        )} */}

        {/* </div> */}
        
    </div>
  );
}
