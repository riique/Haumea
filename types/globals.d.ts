// Declarações globais para o ambiente do navegador

interface Window {
  Plotly?: {
    toImage: (gd: HTMLElement, opts?: {
      format?: 'png' | 'jpeg' | 'webp' | 'svg';
      width?: number;
      height?: number;
      scale?: number;
    }) => Promise<string>;
    newPlot: (root: HTMLElement, data: any[], layout?: any, config?: any) => Promise<any>;
    react: (root: HTMLElement, data: any[], layout?: any, config?: any) => Promise<any>;
    purge: (root: HTMLElement) => void;
    downloadImage: (gd: HTMLElement, opts?: any) => Promise<string>;
  };
}
