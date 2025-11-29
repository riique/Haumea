'use client';

import { X, Download, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { useState } from 'react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
}

export function ImageViewerModal({ isOpen, onClose, imageUrl, imageName }: ImageViewerModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName || 'image.jpg';
    link.click();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-[60] animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative inset-0 flex items-center justify-center p-4 h-full">
        {/* Header Controls */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {imageName && (
            <span className="px-3 text-sm font-medium text-foreground">{imageName}</span>
          )}

          <div className="h-6 w-px bg-border" />

          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-4 h-4 text-foreground" />
          </button>

          <span className="px-2 text-sm font-mono text-muted-foreground">{zoom}%</span>

          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-4 h-4 text-foreground" />
          </button>

          <div className="h-6 w-px bg-border" />

          <button
            onClick={handleRotate}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
            title="Rotacionar"
          >
            <RotateCw className="w-4 h-4 text-foreground" />
          </button>

          <button
            onClick={handleReset}
            className="p-2 hover:bg-muted rounded-lg transition-colors duration-150"
            title="Resetar"
          >
            <Maximize2 className="w-4 h-4 text-foreground" />
          </button>

          <div className="h-6 w-px bg-border" />

          <button
            onClick={handleDownload}
            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors duration-150"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors duration-150"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Container */}
        <div className="max-w-[90vw] max-h-[90vh] overflow-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageName || 'Image'}
            className="max-w-none transition-all duration-300"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}
