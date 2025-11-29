'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { BarChart3, Download, AlertCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-muted rounded-lg border border-border">
      <div className="flex flex-col items-center gap-2">
        <BarChart3 className="w-8 h-8 text-muted-foreground animate-pulse" />
        <p className="text-sm text-muted-foreground">Carregando gráfico...</p>
      </div>
    </div>
  ),
});

interface GraphBlockProps {
  graphData: string;
  className?: string;
}

interface GraphDataSeries {
  x: (number | string)[];
  y: (number | string)[];
  z?: (number | string)[] | (number | string)[][];
  type?: string;
  mode?: string;
  name?: string;
  line?: Record<string, unknown>;
  marker?: Record<string, unknown>;
  colorscale?: string;
}

interface GraphConfig {
  type?: string;
  title?: string;
  data: GraphDataSeries[];
  layout?: Record<string, unknown>;
}

export function GraphBlock({ graphData, className = '' }: GraphBlockProps) {
  const { effectiveTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);

  const { config, parsedData, parsedLayout } = useMemo(() => {
    try {
      const parsed: GraphConfig = JSON.parse(graphData);
      
      // Validação básica
      if (!parsed.data || !Array.isArray(parsed.data)) {
        throw new Error('Campo "data" é obrigatório e deve ser um array');
      }

      if (parsed.data.length === 0) {
        throw new Error('Array "data" não pode estar vazio');
      }

      // Validar cada série de dados
      parsed.data.forEach((series, idx) => {
        if (!series.x || !Array.isArray(series.x)) {
          throw new Error(`Série ${idx}: campo "x" é obrigatório e deve ser um array`);
        }
        if (!series.y || !Array.isArray(series.y)) {
          throw new Error(`Série ${idx}: campo "y" é obrigatório e deve ser um array`);
        }
        if (series.x.length !== series.y.length) {
          throw new Error(`Série ${idx}: arrays "x" e "y" devem ter o mesmo tamanho`);
        }
        // Para gráficos 3D, validar Z
        if (series.z && series.x.length !== series.z.length) {
          throw new Error(`Série ${idx}: arrays "x", "y" e "z" devem ter o mesmo tamanho`);
        }
      });

      // Detectar se é 3D
      const is3D = parsed.data.some(series => 
        series.type === 'scatter3d' || 
        series.type === 'surface' || 
        series.type === 'mesh3d' ||
        series.z !== undefined
      );

      // Configurar layout padrão
      const defaultLayout: Record<string, unknown> = {
        title: parsed.title || '',
        autosize: true,
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
          family: 'system-ui, -apple-system, sans-serif',
        },
        hovermode: 'closest',
        showlegend: parsed.data.length > 1,
      };

      // Layout específico para 3D
      if (is3D) {
        defaultLayout.margin = { l: 0, r: 0, t: 50, b: 0 };
        // Configurar scene padrão para gráficos 3D se não existir
        if (!parsed.layout?.scene) {
          defaultLayout.scene = {
            camera: {
              eye: { x: 1.5, y: 1.5, z: 1.5 }
            }
          };
        }
        // Habilitar rotação 3D
        defaultLayout.dragmode = 'orbit';
      }

      // Merge com layout customizado
      const finalLayout: Record<string, unknown> = {
        ...defaultLayout,
        ...parsed.layout,
      };

      // Aplicar tema baseado no contexto da aplicação
      const isDark = effectiveTheme === 'dark';
      
      if (isDark) {
        finalLayout.paper_bgcolor = 'rgba(0, 0, 0, 0)';
        finalLayout.plot_bgcolor = 'rgba(0, 0, 0, 0)';
        finalLayout.font = {
          ...(typeof finalLayout.font === 'object' ? finalLayout.font : {}),
          color: '#e5e7eb',
          size: 13,
        };
        
        if (finalLayout.xaxis) {
          finalLayout.xaxis = {
            ...(typeof finalLayout.xaxis === 'object' ? finalLayout.xaxis : {}),
            gridcolor: '#374151',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#e5e7eb', size: 12 },
            titlefont: { color: '#e5e7eb', size: 13 },
          };
        }
        
        if (finalLayout.yaxis) {
          finalLayout.yaxis = {
            ...(typeof finalLayout.yaxis === 'object' ? finalLayout.yaxis : {}),
            gridcolor: '#374151',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#e5e7eb', size: 12 },
            titlefont: { color: '#e5e7eb', size: 13 },
          };
        }

        // Para gráficos 3D
        if (finalLayout.scene && typeof finalLayout.scene === 'object') {
          const scene = finalLayout.scene as Record<string, unknown>;
          finalLayout.scene = {
            ...scene,
            xaxis: {
              ...(typeof scene.xaxis === 'object' ? scene.xaxis : {}),
              gridcolor: '#374151',
              zerolinecolor: '#6b7280',
              tickfont: { color: '#e5e7eb', size: 11 },
              titlefont: { color: '#e5e7eb', size: 12 },
            },
            yaxis: {
              ...(typeof scene.yaxis === 'object' ? scene.yaxis : {}),
              gridcolor: '#374151',
              zerolinecolor: '#6b7280',
              tickfont: { color: '#e5e7eb', size: 11 },
              titlefont: { color: '#e5e7eb', size: 12 },
            },
            zaxis: {
              ...(typeof scene.zaxis === 'object' ? scene.zaxis : {}),
              gridcolor: '#374151',
              zerolinecolor: '#6b7280',
              tickfont: { color: '#e5e7eb', size: 11 },
              titlefont: { color: '#e5e7eb', size: 12 },
            },
          };
        }
      } else {
        finalLayout.paper_bgcolor = 'rgba(255, 255, 255, 0)';
        finalLayout.plot_bgcolor = 'rgba(255, 255, 255, 0)';
        finalLayout.font = {
          ...(typeof finalLayout.font === 'object' ? finalLayout.font : {}),
          color: '#111827',
          size: 13,
        };

        if (finalLayout.xaxis) {
          finalLayout.xaxis = {
            ...(typeof finalLayout.xaxis === 'object' ? finalLayout.xaxis : {}),
            gridcolor: '#d1d5db',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#111827', size: 12 },
            titlefont: { color: '#111827', size: 13 },
          };
        }
        
        if (finalLayout.yaxis) {
          finalLayout.yaxis = {
            ...(typeof finalLayout.yaxis === 'object' ? finalLayout.yaxis : {}),
            gridcolor: '#d1d5db',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#111827', size: 12 },
            titlefont: { color: '#111827', size: 13 },
          };
        }

        // Para gráficos 3D
        if (finalLayout.scene && typeof finalLayout.scene === 'object') {
          const scene = finalLayout.scene as Record<string, unknown>;
          finalLayout.scene = {
            ...scene,
            xaxis: {
              ...(typeof scene.xaxis === 'object' ? scene.xaxis : {}),
              gridcolor: '#d1d5db',
              zerolinecolor: '#6b7280',
              tickfont: { color: '#111827', size: 11 },
              titlefont: { color: '#111827', size: 12 },
            },
            yaxis: {
              ...(typeof scene.yaxis === 'object' ? scene.yaxis : {}),
              gridcolor: '#d1d5db',
              zerolinecolor: '#6b7280',
              tickfont: { color: '#111827', size: 11 },
              titlefont: { color: '#111827', size: 12 },
            },
            zaxis: {
              ...(typeof scene.zaxis === 'object' ? scene.zaxis : {}),
              gridcolor: '#d1d5db',
              zerolinecolor: '#6b7280',
              tickfont: { color: '#111827', size: 11 },
              titlefont: { color: '#111827', size: 12 },
            },
          };
        }
      }

      setError(null);
      return {
        config: parsed,
        parsedData: parsed.data,
        parsedLayout: finalLayout,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar JSON do gráfico';
      setError(errorMessage);
      return {
        config: null,
        parsedData: [],
        parsedLayout: {},
      };
    }
  }, [graphData, effectiveTheme]);

  const handleDownload = useCallback(async () => {
    if (!plotRef.current) {
      console.error('Referência ao gráfico não encontrada');
      return;
    }

    try {
      // Buscar o elemento do gráfico Plotly dentro do container
      const plotlyDiv = plotRef.current.querySelector('.js-plotly-plot') as HTMLElement;
      
      if (!plotlyDiv) {
        console.error('Elemento do gráfico Plotly não encontrado');
        alert('Erro: gráfico ainda não foi renderizado.');
        return;
      }

      // Usar o Plotly global que é carregado pelo react-plotly.js
      if (typeof window.Plotly === 'undefined') {
        console.error('Plotly não está carregado');
        alert('Erro: biblioteca de gráficos não está carregada.');
        return;
      }

      // Criar layout otimizado para exportação (fundo branco, texto escuro)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layoutObj = parsedLayout as Record<string, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportLayout: Record<string, any> = {
        ...parsedLayout,
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: {
          ...(typeof layoutObj.font === 'object' && layoutObj.font !== null ? layoutObj.font : {}),
          color: '#000000',
          size: 14,
        },
      };

      // Atualizar eixos para exportação
      if (exportLayout.xaxis) {
        exportLayout.xaxis = {
          ...(typeof exportLayout.xaxis === 'object' ? exportLayout.xaxis : {}),
          gridcolor: '#d1d5db',
          zerolinecolor: '#6b7280',
          tickfont: { color: '#000000', size: 13 },
          titlefont: { color: '#000000', size: 14 },
        };
      }

      if (exportLayout.yaxis) {
        exportLayout.yaxis = {
          ...(typeof exportLayout.yaxis === 'object' ? exportLayout.yaxis : {}),
          gridcolor: '#d1d5db',
          zerolinecolor: '#6b7280',
          tickfont: { color: '#000000', size: 13 },
          titlefont: { color: '#000000', size: 14 },
        };
      }

      // Para gráficos 3D
      if (exportLayout.scene && typeof exportLayout.scene === 'object') {
        const scene = exportLayout.scene as Record<string, unknown>;
        exportLayout.scene = {
          ...scene,
          xaxis: {
            ...(typeof scene.xaxis === 'object' ? scene.xaxis : {}),
            gridcolor: '#d1d5db',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#000000', size: 12 },
            titlefont: { color: '#000000', size: 13 },
          },
          yaxis: {
            ...(typeof scene.yaxis === 'object' ? scene.yaxis : {}),
            gridcolor: '#d1d5db',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#000000', size: 12 },
            titlefont: { color: '#000000', size: 13 },
          },
          zaxis: {
            ...(typeof scene.zaxis === 'object' ? scene.zaxis : {}),
            gridcolor: '#d1d5db',
            zerolinecolor: '#6b7280',
            tickfont: { color: '#000000', size: 12 },
            titlefont: { color: '#000000', size: 13 },
          },
        };
      }

      // Aplicar layout temporário para exportação
      await window.Plotly.react(plotlyDiv, parsedData, exportLayout);

      // Exportar imagem
      const imgData = await window.Plotly.toImage(plotlyDiv, {
        format: 'png',
        width: 1200,
        height: 800,
        scale: 2, // Maior resolução
      });

      // Restaurar layout original
      await window.Plotly.react(plotlyDiv, parsedData, parsedLayout);

      // Criar link de download
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `grafico-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Erro ao exportar gráfico:', err);
      alert('Erro ao exportar o gráfico. Tente novamente.');
    }
  }, [parsedData, parsedLayout]);

  if (error) {
    return (
      <div className={`graph-error my-4 p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 ${className}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Erro ao renderizar gráfico</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            <details className="mt-3">
              <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:text-red-800 dark:hover:text-red-300 select-none">
                Ver JSON original
              </summary>
              <pre className="mt-2 text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-800 overflow-x-auto">
                <code>{graphData}</code>
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  // Detectar tipo de gráfico para o badge
  const graphType = config.type || parsedData[0]?.type || 'scatter';
  const is3D = parsedData.some(series => 
    series.type === 'scatter3d' || 
    series.type === 'surface' || 
    series.type === 'mesh3d' ||
    series.z !== undefined
  );

  const graphTypeLabel = is3D ? `${graphType} (3D)` : graphType;

  return (
    <div className={`graph-display my-4 rounded-lg border border-border bg-muted/30 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">Gráfico Interativo</h4>
            <p className="text-xs text-muted-foreground">
              Tipo: <span className="font-mono">{graphTypeLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="Baixar como PNG"
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="p-4 bg-background/50" ref={plotRef}>
        <Plot
          data={parsedData}
          layout={parsedLayout}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['toImage'],
            scrollZoom: true,
            // Habilitar rotação para gráficos 3D
            ...(is3D && {
              modeBarButtonsToAdd: [],
            }),
          }}
          style={{ width: '100%', height: is3D ? '600px' : '500px' }}
          useResizeHandler={true}
        />
      </div>

      {/* Footer com detalhes */}
      <details className="border-t border-border">
        <summary 
          className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/30 select-none transition-colors"
          onClick={() => setShowJson(!showJson)}
        >
          Ver especificação JSON
        </summary>
        {showJson && (
          <pre className="px-4 py-3 text-xs text-muted-foreground bg-muted/50 overflow-x-auto border-t border-border">
            <code>{JSON.stringify(config, null, 2)}</code>
          </pre>
        )}
      </details>
    </div>
  );
}
