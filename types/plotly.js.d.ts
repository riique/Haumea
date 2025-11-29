declare module 'plotly.js' {
  export interface ToImageOptions {
    format?: 'png' | 'jpeg' | 'webp' | 'svg';
    width?: number;
    height?: number;
    scale?: number;
  }

  export interface PlotlyHTMLElement extends HTMLElement {
    on(event: string, callback: (data: any) => void): void;
    removeAllListeners(event?: string): void;
  }

  export function toImage(
    gd: HTMLElement,
    opts?: ToImageOptions
  ): Promise<string>;

  export function newPlot(
    root: HTMLElement,
    data: any[],
    layout?: any,
    config?: any
  ): Promise<PlotlyHTMLElement>;

  export function react(
    root: HTMLElement,
    data: any[],
    layout?: any,
    config?: any
  ): Promise<PlotlyHTMLElement>;

  export function purge(root: HTMLElement): void;
  
  export function downloadImage(
    gd: HTMLElement,
    opts?: ToImageOptions & { filename?: string }
  ): Promise<string>;

  export const Icons: any;
  export const PlotSchema: any;
}
