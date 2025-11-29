'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface ChemBlockProps {
  smiles: string;
  className?: string;
}

export function ChemBlock({ smiles, className = '' }: ChemBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [molecularFormula, setMolecularFormula] = useState<string>('');
  const [molecularWeight, setMolecularWeight] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // Estados para zoom e pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Ref para armazenar a imagem renderizada
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const renderMolecule = async () => {
      try {
        const mod = await import('openchemlib');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const OCL = (mod as { default?: any }).default || (mod as any);
        const molecule = OCL.Molecule.fromSmiles(smiles);
        
        if (!molecule || molecule.getAllAtoms() === 0) {
          throw new Error('SMILES inválido ou molécula vazia');
        }

        setMolecularFormula(molecule.getMolecularFormula().formula);
        setMolecularWeight(molecule.getMolecularFormula().absoluteWeight.toFixed(2));

        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            const dpi = window.devicePixelRatio || 1;
            const width = 400;
            const height = 300;
            
            canvas.width = width * dpi;
            canvas.height = height * dpi;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            
            ctx.scale(dpi, dpi);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            try {
              const svg = molecule.toSVG(width, height, null, {
                autoCrop: true,
                autoCropMargin: 20,
                suppressChiralText: false,
                suppressESR: false,
                suppressCIPParity: false,
                noStereoProblem: false,
              });

              const img = new Image();
              const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(svgBlob);

              img.onload = () => {
                imageRef.current = img;
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
              };

              img.onerror = () => {
                URL.revokeObjectURL(url);
                throw new Error('Erro ao renderizar SVG');
              };

              img.src = url;
            } catch (renderError) {
              console.error('Erro no rendering:', renderError);
              ctx.fillStyle = '#000000';
              ctx.font = '14px system-ui';
              ctx.textAlign = 'center';
              ctx.fillText('Estrutura renderizada via OpenChemLib', width / 2, height / 2);
            }
          }
        }

        setError(null);
      } catch (err) {
        console.error('Erro ao processar SMILES:', err);
        setError(err instanceof Error ? err.message : 'Erro ao processar SMILES');
      }
    };

    renderMolecule();
  }, [smiles]);

  // Efeito para re-renderizar com zoom e pan
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpi = window.devicePixelRatio || 1;
    const width = 400;
    const height = 300;

    // Limpar canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Aplicar transformações com DPI
    ctx.save();
    ctx.scale(dpi, dpi);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(imageRef.current, 0, 0, width, height);
    ctx.restore();
  }, [zoom, pan]);

  // Prevenir scroll da página ao fazer zoom no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: WheelEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', preventScroll);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(smiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // Handler para zoom com scroll
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calcular novo zoom
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(Math.max(0.5, zoom + delta), 5); // Limitar entre 0.5x e 5x

    // Ajustar pan para zoom centrado no cursor
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - pan.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - pan.y) * zoomRatio;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Handlers para pan com drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Botão esquerdo
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (error) {
    return (
      <div className={`chem-error my-4 p-4 rounded-lg border border-red-300 bg-red-50 ${className}`}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Erro ao renderizar estrutura química</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded border border-red-200 overflow-x-auto">
              <code>{smiles}</code>
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chem-display my-4 p-4 rounded-lg border border-gray-200 bg-gray-50 ${className}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Estrutura Molecular</h4>
          {molecularFormula && (
            <div className="flex gap-4 text-xs text-gray-600">
              <span>
                <strong>Fórmula:</strong> {molecularFormula}
              </span>
              {molecularWeight && (
                <span>
                  <strong>Peso:</strong> {molecularWeight} g/mol
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
          title="Copiar SMILES"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      
      <div className="flex justify-center items-center bg-white rounded border border-gray-300 p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="chem-structure max-w-full h-auto"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      <div className="flex justify-between items-center mt-2 text-xs text-gray-600">
        <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        <button
          onClick={handleReset}
          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
          title="Resetar zoom e posição"
        >
          Resetar
        </button>
      </div>

      <details className="mt-3">
        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800 select-none">
          Ver SMILES
        </summary>
        <pre className="mt-2 text-xs text-gray-700 bg-white p-2 rounded border border-gray-300 overflow-x-auto">
          <code>{smiles}</code>
        </pre>
      </details>
    </div>
  );
}
