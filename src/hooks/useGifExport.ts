import { useState, useCallback } from 'react';
import gifshot from 'gifshot';

/** Options for the useGifExport hook. */
export interface UseGifExportOptions {
  /** Base filename for the downloaded GIF (without extension). */
  filename: string;
  /** Maximum width of the exported GIF. Defaults to 800. */
  maxWidth?: number;
}

/** Handle returned by the useGifExport hook. */
export interface GifExportHandle {
  /** Whether a GIF export is currently in progress. */
  isExporting: boolean;
  /**
   * Start GIF export.
   * @param captureFrame - Callback implemented by the mode component to capture
   *   a frame as a data URL. Receives `withAnswer` flag and the target export dimensions.
   */
  exportGif: (
    captureFrame: (withAnswer: boolean, width: number, height: number) => string,
  ) => void;
}

/**
 * Hook that handles GIF export using the gifshot library.
 *
 * Captures two frames (without answer, then with answer), composites them into
 * an animated GIF, and triggers a browser download.
 *
 * @param options - Export options including filename and optional maxWidth.
 * @returns A {@link GifExportHandle} with exporting state and the export trigger.
 */
const useGifExport = ({ filename, maxWidth = 800 }: UseGifExportOptions): GifExportHandle => {
  const [isExporting, setIsExporting] = useState(false);

  const exportGif = useCallback(
    (captureFrame: (withAnswer: boolean, width: number, height: number) => string) => {
      if (isExporting) return;

      setIsExporting(true);

      const scale = Math.min(1, maxWidth / window.innerWidth);
      const exportWidth = Math.round(window.innerWidth * scale);
      const exportHeight = Math.round(window.innerHeight * scale);

      const frameWithoutAnswer = captureFrame(false, exportWidth, exportHeight);
      const frameWithAnswer = captureFrame(true, exportWidth, exportHeight);

      gifshot.createGIF(
        {
          images: [frameWithoutAnswer, frameWithAnswer],
          gifWidth: exportWidth,
          gifHeight: exportHeight,
          interval: 1,
        },
        (result: { error: boolean; image?: string }) => {
          if (result.error || !result.image) {
            alert('GIF生成に失敗しました。');
          } else {
            const a = document.createElement('a');
            a.href = result.image;
            a.download = filename.endsWith('.gif') ? filename : `${filename}.gif`;
            a.click();
          }
          setIsExporting(false);
        },
      );
    },
    [isExporting, maxWidth, filename],
  );

  return { isExporting, exportGif };
};

export default useGifExport;
