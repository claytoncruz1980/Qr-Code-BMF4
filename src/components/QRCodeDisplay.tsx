import React, { useEffect, useState, useMemo, useRef } from 'react';
import QRCode, { QRCodeErrorCorrectionLevel } from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
  margin?: number;
  className?: string;
  showBorder?: boolean;
  showSecurityBadge?: boolean;
}

/**
 * High-performance, ISO/IEC 18004 compliant QR Code generator using standard vector SVG.
 * Optimized for TV projections, smartphone camera autofocus, and distant scanning.
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 220,
  label,
  sublabel,
  errorCorrectionLevel = 'medium',
  margin = 2,
  className = '',
  showBorder = true,
  showSecurityBadge = false,
}) => {
  const [svgString, setSvgString] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const lastValidSvgRef = useRef<string>('');

  useEffect(() => {
    let isMounted = true;

    async function generateQRCode() {
      try {
        setError(null);
        if (!value || typeof value !== 'string' || value.trim().length === 0) return;

        // Generate SVG string with high contrast and optimal quiet zone margin
        const svg = await QRCode.toString(value, {
          type: 'svg',
          errorCorrectionLevel: errorCorrectionLevel || 'medium',
          margin: margin,
          color: {
            dark: '#000000',  // 100% black for highest camera sensor contrast
            light: '#ffffff', // 100% white
          },
          width: size,
        } as any);

        if (isMounted) {
          setSvgString(svg);
          lastValidSvgRef.current = svg;
        }
      } catch (err) {
        console.error('Failed to generate standard QR code', err);
        if (isMounted && !lastValidSvgRef.current) {
          setError('Erro ao renderizar QR Code.');
        }
      }
    }

    generateQRCode();

    return () => {
      isMounted = false;
    };
  }, [value, size, errorCorrectionLevel, margin]);

  // Clean SVG rendering with crisp pixel edges (shapeRendering="crispEdges")
  const formattedSvg = useMemo(() => {
    const raw = svgString || lastValidSvgRef.current;
    if (!raw) return '';
    // Ensure shape-rendering is crisp for scanner clarity
    return raw.replace('<svg ', `<svg style="width: 100%; height: 100%; display: block;" shape-rendering="crispEdges" `);
  }, [svgString]);

  return (
    <div className={`flex flex-col items-center select-none w-full max-w-full overflow-hidden ${className}`}>
      <div 
        className={`bg-white transition-all w-full h-full aspect-square flex items-center justify-center ${
          showBorder ? 'border-2 border-slate-900 rounded-2xl p-1.5 sm:p-2.5 shadow-md' : 'rounded-xl p-0.5 sm:p-1'
        }`}
        style={{ maxWidth: `min(${size + 16}px, 100%)`, maxHeight: `min(${size + 16}px, 100%)` }}
      >
        {error ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-rose-500 font-bold p-2 text-center">
            {error}
          </div>
        ) : formattedSvg ? (
          <div 
            className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
            dangerouslySetInnerHTML={{ __html: formattedSvg }} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {label && (
        <p className="mt-2 text-[11px] sm:text-xs font-black text-slate-800 tracking-wider text-center uppercase font-mono max-w-full truncate px-1">
          {label}
        </p>
      )}
      {sublabel && (
        <p className="text-[10px] sm:text-[11px] text-slate-500 text-center font-medium max-w-full truncate px-1">
          {sublabel}
        </p>
      )}
    </div>
  );
};
